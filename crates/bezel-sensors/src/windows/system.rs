//! Windows system information, default audio endpoint and power status.
use std::time::Instant;

use bezel_core::domain::sensor::{Category, Quantity, Reading, SensorInfo, Snapshot, keys};
use sysinfo::System as SysSystem;

use crate::provider::{Provider, describe, put};

pub(super) struct System {
    catalog: Vec<SensorInfo>,
    processes: SysSystem,
}

impl System {
    pub fn new() -> Self {
        let catalog = [
            (keys::UPTIME, "Uptime", Quantity::Seconds),
            (keys::HOSTNAME, "Host name", Quantity::Text),
            (keys::SYSTEM_OS, "Windows version", Quantity::Text),
            (
                keys::SYSTEM_PROCESSES,
                "Running processes",
                Quantity::Number,
            ),
            (keys::SYSTEM_VOLUME, "Output volume", Quantity::Percent),
            (keys::SYSTEM_AUDIO_MUTED, "Output muted", Quantity::Number),
            (keys::SYSTEM_AUDIO_DEVICE, "Output device", Quantity::Text),
            (
                keys::SYSTEM_POWER_AC,
                "Connected to power",
                Quantity::Number,
            ),
            (keys::SYSTEM_BATTERY_PERCENT, "Battery", Quantity::Percent),
            (
                keys::SYSTEM_BATTERY_CHARGING,
                "Battery charging",
                Quantity::Number,
            ),
            (
                keys::SYSTEM_BATTERY_REMAINING,
                "Battery time remaining",
                Quantity::Seconds,
            ),
        ]
        .into_iter()
        .filter_map(|(key, label, quantity)| {
            describe(key, Category::System, label, quantity, "Windows")
        })
        .collect();
        Self {
            catalog,
            processes: SysSystem::new(),
        }
    }
}

impl Provider for System {
    fn catalog(&self) -> Vec<SensorInfo> {
        self.catalog.clone()
    }

    fn sample(&mut self, _now: Instant, out: &mut Snapshot) {
        put(
            out,
            keys::UPTIME,
            Reading::Value(SysSystem::uptime() as f64),
        );
        put(
            out,
            keys::HOSTNAME,
            text(SysSystem::host_name(), "Windows did not report a host name"),
        );
        put(
            out,
            keys::SYSTEM_OS,
            text(SysSystem::long_os_version(), "Windows version unavailable"),
        );
        self.processes.refresh_processes_specifics(
            sysinfo::ProcessesToUpdate::All,
            true,
            sysinfo::ProcessRefreshKind::nothing(),
        );
        put(
            out,
            keys::SYSTEM_PROCESSES,
            Reading::Value(self.processes.processes().len() as f64),
        );
        match audio() {
            Ok((volume, muted, device)) => {
                put(
                    out,
                    keys::SYSTEM_VOLUME,
                    Reading::Value(f64::from(volume) * 100.),
                );
                put(
                    out,
                    keys::SYSTEM_AUDIO_MUTED,
                    Reading::Value(f64::from(u8::from(muted))),
                );
                put(out, keys::SYSTEM_AUDIO_DEVICE, device);
            }
            Err(_) => {
                for key in [
                    keys::SYSTEM_VOLUME,
                    keys::SYSTEM_AUDIO_MUTED,
                    keys::SYSTEM_AUDIO_DEVICE,
                ] {
                    put(
                        out,
                        key,
                        Reading::Unavailable("default audio output unavailable".into()),
                    );
                }
            }
        }
        // SAFETY: Windows writes only into this initialized, correctly sized structure.
        #[allow(unsafe_code)]
        let power = unsafe {
            let mut status = std::mem::zeroed();
            (windows_sys::Win32::System::Power::GetSystemPowerStatus(&mut status) != 0)
                .then_some(status)
        };
        for (key, reading) in power_readings(power.as_ref()) {
            put(out, key, reading);
        }
    }
}

fn text(value: Option<String>, reason: &str) -> Reading {
    value
        .filter(|s| !s.trim().is_empty())
        .map_or_else(|| Reading::Unavailable(reason.into()), Reading::Text)
}

fn power_readings(
    status: Option<&windows_sys::Win32::System::Power::SYSTEM_POWER_STATUS>,
) -> Vec<(&'static str, Reading)> {
    let missing = || Reading::Unavailable("Windows did not report power status".into());
    let battery = status.filter(|s| s.BatteryFlag != 255 && s.BatteryFlag & 128 == 0);
    let no_battery = || Reading::Unavailable("no battery or battery status unavailable".into());
    vec![
        (
            keys::SYSTEM_POWER_AC,
            status
                .filter(|s| s.ACLineStatus <= 1)
                .map_or_else(missing, |s| Reading::Value(f64::from(s.ACLineStatus))),
        ),
        (
            keys::SYSTEM_BATTERY_PERCENT,
            battery
                .filter(|s| s.BatteryLifePercent <= 100)
                .map_or_else(no_battery, |s| {
                    Reading::Value(f64::from(s.BatteryLifePercent))
                }),
        ),
        (
            keys::SYSTEM_BATTERY_CHARGING,
            battery.map_or_else(no_battery, |s| {
                Reading::Value(f64::from(u8::from(s.BatteryFlag & 8 != 0)))
            }),
        ),
        (
            keys::SYSTEM_BATTERY_REMAINING,
            battery
                .filter(|s| s.BatteryLifeTime != u32::MAX)
                .map_or_else(
                    || Reading::Unavailable("battery time estimate unavailable".into()),
                    |s| Reading::Value(f64::from(s.BatteryLifeTime)),
                ),
        ),
    ]
}

// No COM interface escapes this call or crosses threads. Reacquire the default
// endpoint each time so unplugging headphones or changing output recovers naturally.
#[allow(unsafe_code)]
fn audio() -> windows::core::Result<(f32, bool, Reading)> {
    use windows::Win32::{
        Devices::FunctionDiscovery::PKEY_Device_FriendlyName,
        Media::Audio::{
            Endpoints::IAudioEndpointVolume, IMMDeviceEnumerator, MMDeviceEnumerator, eConsole,
            eRender,
        },
        System::Com::{
            CLSCTX_ALL, COINIT_MULTITHREADED, CoCreateInstance, CoInitializeEx, CoTaskMemFree,
            CoUninitialize, STGM_READ,
            StructuredStorage::{PropVariantClear, PropVariantToStringAlloc},
        },
    };
    struct Apartment(bool);
    impl Drop for Apartment {
        fn drop(&mut self) {
            // SAFETY: balanced on the same thread only after a successful initialization.
            if self.0 {
                unsafe { CoUninitialize() };
            }
        }
    }
    // SAFETY: all COM pointers and allocated property values stay on this thread;
    // property and string allocations are released before the apartment guard.
    unsafe {
        let hr = CoInitializeEx(None, COINIT_MULTITHREADED);
        // RPC_E_CHANGED_MODE means the caller already owns a valid STA apartment.
        if hr.is_err() && hr.0 != 0x80010106u32 as i32 {
            hr.ok()?;
        }
        let _apartment = Apartment(hr.is_ok());
        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
        let device = enumerator.GetDefaultAudioEndpoint(eRender, eConsole)?;
        let endpoint: IAudioEndpointVolume = device.Activate(CLSCTX_ALL, None)?;
        let volume = endpoint.GetMasterVolumeLevelScalar()?;
        let muted = endpoint.GetMute()?.as_bool();
        let name = (|| -> windows::core::Result<String> {
            let properties = device.OpenPropertyStore(STGM_READ)?;
            let mut value = properties.GetValue(&PKEY_Device_FriendlyName)?;
            let allocated = PropVariantToStringAlloc(&value);
            let _ = PropVariantClear(&mut value);
            let allocated = allocated?;
            let name = allocated.to_string();
            CoTaskMemFree(Some(allocated.0.cast()));
            Ok(name?)
        })();
        Ok((
            volume,
            muted,
            text(name.ok(), "audio device name unavailable"),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use windows_sys::Win32::System::Power::SYSTEM_POWER_STATUS;

    #[test]
    #[ignore = "reads the default audio output on a Windows PC with an audio device"]
    fn the_default_output_reports_volume_mute_and_device_name() {
        let (volume, _muted, device) = audio().expect("default audio output");
        assert!((0.0..=1.0).contains(&volume));
        assert!(matches!(device, Reading::Text(name) if !name.trim().is_empty()));
    }

    fn status(flag: u8, percent: u8, remaining: u32) -> SYSTEM_POWER_STATUS {
        SYSTEM_POWER_STATUS {
            ACLineStatus: 1,
            BatteryFlag: flag,
            BatteryLifePercent: percent,
            SystemStatusFlag: 0,
            BatteryLifeTime: remaining,
            BatteryFullLifeTime: u32::MAX,
        }
    }
    #[test]
    fn no_battery_and_unknown_values_are_not_zeroes() {
        for s in [status(128, 255, u32::MAX), status(255, 255, u32::MAX)] {
            let values = power_readings(Some(&s));
            assert_eq!(values[0].1, Reading::Value(1.));
            assert!(
                values[1..]
                    .iter()
                    .all(|(_, r)| matches!(r, Reading::Unavailable(_)))
            );
        }
        assert!(
            power_readings(None)
                .iter()
                .all(|(_, r)| matches!(r, Reading::Unavailable(_)))
        );
    }
    #[test]
    fn battery_reports_charge_and_preserves_missing_estimate() {
        let values = power_readings(Some(&status(8, 75, u32::MAX)));
        assert_eq!(values[1].1, Reading::Value(75.));
        assert_eq!(values[2].1, Reading::Value(1.));
        assert!(matches!(values[3].1, Reading::Unavailable(_)));
        assert_eq!(
            power_readings(Some(&status(0, 20, 600)))[3].1,
            Reading::Value(600.)
        );
    }
}
