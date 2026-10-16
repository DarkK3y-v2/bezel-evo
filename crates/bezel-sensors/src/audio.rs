//! Windows process loopback. PCM is bounded in RAM and never logged or persisted.
//! Process association rejects ambiguity; no system-output or microphone fallback.
#![allow(unsafe_code)]
use bezel_core::{
    domain::spectrum::{AudioBlock, AudioState},
    ports::{AudioCapture, AudioCaptureFactory},
};
use std::{
    sync::{Arc, Condvar, Mutex},
    time::Duration,
};
use windows::{
    Win32::{
        Foundation::{CloseHandle, HANDLE},
        Media::Audio::*,
        Storage::Packaging::Appx::GetApplicationUserModelId,
        System::{
            Com::{
                BLOB, COINIT_MULTITHREADED, CoInitializeEx, CoUninitialize,
                StructuredStorage::{
                    PROPVARIANT, PROPVARIANT_0, PROPVARIANT_0_0, PROPVARIANT_0_0_0,
                },
            },
            Diagnostics::ToolHelp::{
                CreateToolhelp32Snapshot, PROCESSENTRY32W, Process32FirstW, Process32NextW,
                TH32CS_SNAPPROCESS,
            },
            Threading::{
                GetExitCodeProcess, OpenProcess, PROCESS_NAME_WIN32,
                PROCESS_QUERY_LIMITED_INFORMATION, QueryFullProcessImageNameW,
            },
            Variant::VT_BLOB,
        },
    },
    core::{Interface, implement},
};
use windows_core::{HRESULT, Ref};
/// Stateless factory; construction does not enumerate or capture anything.
pub struct ProcessAudio;
#[derive(Clone, Debug)]
struct Process {
    pid: u32,
    parent: u32,
    name: String,
    aumid: Option<String>,
}
fn resolve(source: &str, processes: &[Process]) -> Option<u32> {
    let packaged = source.contains('!');
    let name = bezel_core::domain::playback::app_name(source);
    let matches: Vec<_> = processes
        .iter()
        .filter(|p| {
            if packaged {
                p.aumid
                    .as_ref()
                    .is_some_and(|a| a.eq_ignore_ascii_case(source))
            } else {
                bezel_core::domain::playback::app_name(&p.name) == name
            }
        })
        .collect();
    let roots: Vec<_> = matches
        .iter()
        .filter(|p| {
            let mut parent = p.parent;
            let mut seen = std::collections::BTreeSet::new();
            while parent != 0 && seen.insert(parent) {
                if matches.iter().any(|other| other.pid == parent) {
                    return false;
                }
                let Some(next) = processes.iter().find(|other| other.pid == parent) else {
                    break;
                };
                parent = next.parent;
            }
            true
        })
        .collect();
    (roots.len() == 1).then(|| roots[0].pid)
}
struct Handle(HANDLE);
impl Drop for Handle {
    fn drop(&mut self) {
        // SAFETY: this wrapper uniquely owns a valid snapshot/process handle.
        unsafe {
            let _ = CloseHandle(self.0);
        }
    }
}
fn processes() -> windows_core::Result<Vec<Process>> {
    // SAFETY: Toolhelp returns an owned snapshot; initialized entry has the required size.
    unsafe {
        let snapshot = Handle(CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0)?);
        let mut entry = PROCESSENTRY32W {
            dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
            ..Default::default()
        };
        let mut result = Vec::new();
        let mut next = Process32FirstW(snapshot.0, &mut entry);
        while next.is_ok() && result.len() < 16384 {
            let name = String::from_utf16_lossy(
                &entry.szExeFile[..entry
                    .szExeFile
                    .iter()
                    .position(|v| *v == 0)
                    .unwrap_or(entry.szExeFile.len())],
            );
            let aumid = OpenProcess(
                PROCESS_QUERY_LIMITED_INFORMATION,
                false,
                entry.th32ProcessID,
            )
            .ok()
            .and_then(|raw| {
                let process = Handle(raw);
                let mut size = 0;
                let _ = GetApplicationUserModelId(process.0, &mut size, None);
                if size == 0 || size > 4096 {
                    return None;
                }
                let mut text = vec![0u16; size as usize];
                if GetApplicationUserModelId(
                    process.0,
                    &mut size,
                    Some(windows_core::PWSTR(text.as_mut_ptr())),
                )
                .0 != 0
                {
                    return None;
                }
                Some(String::from_utf16_lossy(
                    &text[..text.iter().position(|v| *v == 0).unwrap_or(text.len())],
                ))
            });
            result.push(Process {
                pid: entry.th32ProcessID,
                parent: entry.th32ParentProcessID,
                name,
                aumid,
            });
            next = Process32NextW(snapshot.0, &mut entry);
        }
        Ok(result)
    }
}
fn supported_build(major: u32, build: u32) -> bool {
    major > 10 || (major == 10 && build >= 20348)
}
fn supported() -> bool {
    // SAFETY: initialized version structure is writable for its declared size; RtlGetVersion is manifest-independent.
    unsafe {
        let mut version = windows_sys::Win32::System::SystemInformation::OSVERSIONINFOW {
            dwOSVersionInfoSize: std::mem::size_of::<
                windows_sys::Win32::System::SystemInformation::OSVERSIONINFOW,
            >() as u32,
            ..std::mem::zeroed()
        };
        windows_sys::Wdk::System::SystemServices::RtlGetVersion(&mut version) >= 0
            && (supported_build(version.dwMajorVersion, version.dwBuildNumber))
    }
}
#[implement(IActivateAudioInterfaceCompletionHandler)]
struct Completion {
    _params: Arc<AUDIOCLIENT_ACTIVATION_PARAMS>,
    done: Arc<(Mutex<bool>, Condvar)>,
}
impl IActivateAudioInterfaceCompletionHandler_Impl for Completion_Impl {
    fn ActivateCompleted(
        &self,
        _operation: Ref<IActivateAudioInterfaceAsyncOperation>,
    ) -> windows_core::Result<()> {
        *self
            .done
            .0
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner) = true;
        self.done.1.notify_one();
        Ok(())
    }
}
struct Apartment;
impl Drop for Apartment {
    fn drop(&mut self) {
        // SAFETY: one successful CoInitializeEx belongs to this worker thread.
        unsafe {
            CoUninitialize();
        }
    }
}
struct Capture {
    client: IAudioClient,
    reader: IAudioCaptureClient,
    process: Handle,
    _apartment: Apartment,
}
impl Drop for Capture {
    fn drop(&mut self) {
        // SAFETY: client was initialized and started on this same MTA worker.
        unsafe {
            let _ = self.client.Stop();
        }
    }
}
impl AudioCaptureFactory for ProcessAudio {
    fn availability(&self) -> AudioState {
        if supported() {
            AudioState::Live
        } else {
            AudioState::Unsupported
        }
    }
    fn open(&self, source: &str) -> Result<Box<dyn AudioCapture>, AudioState> {
        if !supported() {
            return Err(AudioState::Unsupported);
        }
        if source.is_empty() || source.len() > 4096 {
            return Err(AudioState::Unavailable);
        }
        let pid = resolve(source, &processes().map_err(|_| AudioState::Unavailable)?)
            .ok_or(AudioState::Unavailable)?;
        open(pid, source)
            .map(|c| Box::new(c) as Box<dyn AudioCapture>)
            .map_err(|_| AudioState::Unavailable)
    }
}
fn open(pid: u32, source: &str) -> windows_core::Result<Capture> {
    // SAFETY: all COM calls and releases happen on the dedicated MTA analysis thread.
    // Parameters and PCM format are initialized; the completion retains the blob even on timeout.
    unsafe {
        CoInitializeEx(None, COINIT_MULTITHREADED).ok()?;
        let apartment = Apartment;
        let process = Handle(OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid)?);
        // Recheck the held process after enumeration: a stale PID must never capture another app.
        if source.contains('!') {
            let mut count = 4096u32;
            let mut id = vec![0u16; count as usize];
            if GetApplicationUserModelId(
                process.0,
                &mut count,
                Some(windows_core::PWSTR(id.as_mut_ptr())),
            )
            .0 != 0
            {
                return Err(windows_core::Error::from_thread());
            }
            let name = String::from_utf16_lossy(
                &id[..id.iter().position(|v| *v == 0).unwrap_or(id.len())],
            );
            if !name.eq_ignore_ascii_case(source) {
                return Err(windows_core::Error::from_hresult(HRESULT(
                    0x80070005u32 as i32,
                )));
            }
        } else {
            let mut count = 32768u32;
            let mut path = vec![0u16; count as usize];
            QueryFullProcessImageNameW(
                process.0,
                PROCESS_NAME_WIN32,
                windows_core::PWSTR(path.as_mut_ptr()),
                &mut count,
            )?;
            let name = String::from_utf16_lossy(&path[..count as usize]);
            let name = name.rsplit(['\\', '/']).next().unwrap_or("");
            if bezel_core::domain::playback::app_name(name)
                != bezel_core::domain::playback::app_name(source)
            {
                return Err(windows_core::Error::from_hresult(HRESULT(
                    0x80070005u32 as i32,
                )));
            }
        }

        let params = Arc::new(AUDIOCLIENT_ACTIVATION_PARAMS {
            ActivationType: AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK,
            Anonymous: AUDIOCLIENT_ACTIVATION_PARAMS_0 {
                ProcessLoopbackParams: AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS {
                    TargetProcessId: pid,
                    ProcessLoopbackMode: PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE,
                },
            },
        });
        // Borrowed activation blob: never call PropVariantClear on this non-owning variant.
        let variant = PROPVARIANT {
            Anonymous: PROPVARIANT_0 {
                Anonymous: std::mem::ManuallyDrop::new(PROPVARIANT_0_0 {
                    vt: VT_BLOB,
                    Anonymous: PROPVARIANT_0_0_0 {
                        blob: BLOB {
                            cbSize: std::mem::size_of::<AUDIOCLIENT_ACTIVATION_PARAMS>() as u32,
                            pBlobData: Arc::as_ptr(&params).cast_mut().cast(),
                        },
                    },
                    ..Default::default()
                }),
            },
        };
        let done = Arc::new((Mutex::new(false), Condvar::new()));
        let handler: IActivateAudioInterfaceCompletionHandler = Completion {
            _params: params.clone(),
            done: done.clone(),
        }
        .into();
        let operation = ActivateAudioInterfaceAsync(
            VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK,
            &IAudioClient::IID,
            Some(&variant),
            &handler,
        )?;
        let lock = done
            .0
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        let (ready, _) = done
            .1
            .wait_timeout_while(lock, Duration::from_secs(2), |v| !*v)
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        if !*ready {
            return Err(windows_core::Error::from_hresult(HRESULT(
                0x800705B4u32 as i32,
            )));
        }
        drop(ready);
        let mut result = HRESULT(0);
        let mut unknown = None;
        operation.GetActivateResult(&mut result, &mut unknown)?;
        result.ok()?;
        let client: IAudioClient = unknown
            .ok_or_else(windows_core::Error::from_thread)?
            .cast()?;
        // A fixed, supported PCM16 stereo mix follows Microsoft ApplicationLoopback's format.
        let format = WAVEFORMATEX {
            wFormatTag: 1,
            nChannels: 2,
            nSamplesPerSec: 48000,
            nAvgBytesPerSec: 192000,
            nBlockAlign: 4,
            wBitsPerSample: 16,
            cbSize: 0,
        };
        client.Initialize(
            AUDCLNT_SHAREMODE_SHARED,
            AUDCLNT_STREAMFLAGS_LOOPBACK | AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM,
            2_000_000,
            0,
            &format,
            None,
        )?;
        let reader = client.GetService::<IAudioCaptureClient>()?;
        client.Start()?;
        Ok(Capture {
            client,
            reader,
            process,
            _apartment: apartment,
        })
    }
}
impl AudioCapture for Capture {
    fn read(&mut self) -> Result<AudioBlock, AudioState> {
        // SAFETY: GetBuffer's frame count bounds its PCM16 stereo pointer. Each successful
        // GetBuffer is paired with ReleaseBuffer, including errors; copies never escape this worker.
        unsafe {
            let mut exit = 0;
            GetExitCodeProcess(self.process.0, &mut exit).map_err(|_| AudioState::Unavailable)?;
            if exit != 259 {
                return Err(AudioState::Unavailable);
            }
            let mut samples = Vec::with_capacity(4800 * 2);
            for _ in 0..64 {
                let packet = self
                    .reader
                    .GetNextPacketSize()
                    .map_err(|_| AudioState::Unavailable)?;
                if packet == 0 {
                    break;
                }
                let mut data = std::ptr::null_mut();
                let mut frames = 0;
                let mut flags = 0;
                self.reader
                    .GetBuffer(&mut data, &mut frames, &mut flags, None, None)
                    .map_err(|_| AudioState::Unavailable)?;
                let count = frames as usize * 2;
                if frames > 48000 || samples.len() + count > 96000 {
                    let _ = self.reader.ReleaseBuffer(frames);
                    return Err(AudioState::Unavailable);
                }
                if flags & AUDCLNT_BUFFERFLAGS_SILENT.0 as u32 != 0 {
                    samples.resize(samples.len() + count, 0.);
                } else if data.is_null() {
                    let _ = self.reader.ReleaseBuffer(frames);
                    return Err(AudioState::Unavailable);
                } else {
                    let bytes = std::slice::from_raw_parts(data, count * 2);
                    samples.extend(
                        bytes
                            .as_chunks::<2>()
                            .0
                            .iter()
                            .map(|v| f32::from(i16::from_le_bytes([v[0], v[1]])) / 32768.),
                    );
                }
                self.reader
                    .ReleaseBuffer(frames)
                    .map_err(|_| AudioState::Unavailable)?;
            }
            Ok(AudioBlock {
                samples,
                rate: 48000,
                channels: 2,
            })
        }
    }
}
#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::panic)]
mod tests {
    use super::*;
    #[test]
    fn older_windows_are_explicitly_unsupported() {
        assert!(!supported_build(10, 19045));
        assert!(!supported_build(10, 20347));
        assert!(supported_build(10, 20348));
        assert!(supported_build(10, 22000));
    }
    fn p(pid: u32, parent: u32, name: &str, aumid: Option<&str>) -> Process {
        Process {
            pid,
            parent,
            name: name.into(),
            aumid: aumid.map(str::to_owned),
        }
    }
    #[test]
    fn classic_browser_and_store_resolve_one_root_not_a_global_mix() {
        let items = [
            p(10, 1, "Spotify.exe", None),
            p(11, 10, "Spotify.exe", None),
            p(20, 1, "chrome.exe", None),
            p(21, 20, "chrome.exe", None),
            p(30, 1, "Music.exe", Some("Vendor.Music_hash!App")),
        ];
        assert_eq!(resolve("Spotify.exe", &items), Some(10));
        assert_eq!(resolve("Chrome", &items), Some(20));
        assert_eq!(resolve("Vendor.Music_hash!App", &items), Some(30));
        assert_eq!(resolve("Unknown", &items), None);
    }
    #[test]
    fn ambiguity_is_rejected_and_a_restart_uses_the_new_process() {
        assert_eq!(
            resolve("vlc", &[p(1, 0, "vlc.exe", None), p(2, 0, "vlc.exe", None)]),
            None
        );
        assert_eq!(resolve("vlc", &[p(99, 0, "vlc.exe", None)]), Some(99));
        assert_eq!(
            resolve("Other!App", &[p(1, 0, "x.exe", Some("Vendor!App"))]),
            None
        );
    }
}
