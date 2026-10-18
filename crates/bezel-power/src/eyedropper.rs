//! An explicit, one-click desktop colour pick, including secondary monitors.
//! No screenshot is retained: only the selected pixel's RGB leaves this module.
//! The near-transparent input window intercepts the click instead of passing it
//! to the application under the pointer. It is hidden before reading the pixel.
#![allow(unsafe_code)]

use std::sync::atomic::{AtomicBool, Ordering};
use windows_sys::Win32::Foundation::{HWND, LPARAM, LRESULT, POINT, WPARAM};
use windows_sys::Win32::Graphics::Dwm::DwmFlush;
use windows_sys::Win32::Graphics::Gdi::{BLACK_BRUSH, GetDC, GetPixel, GetStockObject, ReleaseDC};
use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
use windows_sys::Win32::UI::WindowsAndMessaging::*;

static ACTIVE: AtomicBool = AtomicBool::new(false);

struct Active;
impl Drop for Active {
    fn drop(&mut self) {
        ACTIVE.store(false, Ordering::Release);
    }
}

#[derive(Default)]
struct Pick {
    point: Option<POINT>,
}

/// Runs a native modal pick on a blocking thread. Esc, right-click, losing
/// activation or the one-minute timeout cancel. `owner` is Studio's HWND.
pub fn pick(owner: usize) -> Result<Option<String>, &'static str> {
    if ACTIVE.swap(true, Ordering::AcqRel) {
        return Err("a colour pick is already active");
    }
    let _active = Active;
    // SAFETY: all native resources belong to this thread. Pick stays on this
    // stack until its window is destroyed; the window procedure never retains
    // it afterwards. The fixed class is registered only while ACTIVE is held.
    unsafe {
        let instance = GetModuleHandleW(std::ptr::null());
        let name: Vec<u16> = "BezelEvoEyeDropper\0".encode_utf16().collect();
        let class = WNDCLASSW {
            lpfnWndProc: Some(procedure),
            hInstance: instance,
            lpszClassName: name.as_ptr(),
            hCursor: LoadCursorW(std::ptr::null_mut(), IDC_CROSS),
            hbrBackground: GetStockObject(BLACK_BRUSH) as _,
            ..std::mem::zeroed()
        };
        if RegisterClassW(&class) == 0 {
            return Err("could not register the colour picker");
        }
        let mut result = Pick::default();
        let window = CreateWindowExW(
            WS_EX_TOPMOST | WS_EX_TOOLWINDOW | WS_EX_LAYERED,
            name.as_ptr(),
            name.as_ptr(),
            WS_POPUP,
            GetSystemMetrics(SM_XVIRTUALSCREEN),
            GetSystemMetrics(SM_YVIRTUALSCREEN),
            GetSystemMetrics(SM_CXVIRTUALSCREEN),
            GetSystemMetrics(SM_CYVIRTUALSCREEN),
            owner as HWND,
            std::ptr::null_mut(),
            instance,
            (&raw mut result).cast(),
        );
        if window.is_null() {
            UnregisterClassW(name.as_ptr(), instance);
            return Err("could not open the colour picker");
        }
        // Alpha 1 catches input throughout the virtual desktop, including areas
        // outside Studio. The overlay is removed before the pixel is sampled.
        if SetLayeredWindowAttributes(window, 0, 1, LWA_ALPHA) == 0
            || SetTimer(window, 1, 60_000, None) == 0
        {
            DestroyWindow(window);
            // Destroy posts WM_QUIT; consume it before returning to the pool.
            let mut message = std::mem::zeroed();
            PeekMessageW(
                &mut message,
                std::ptr::null_mut(),
                WM_QUIT,
                WM_QUIT,
                PM_REMOVE,
            );
            UnregisterClassW(name.as_ptr(), instance);
            return Err("could not prepare the colour picker");
        }
        ShowWindow(window, SW_SHOW);
        SetForegroundWindow(window);
        let mut message = std::mem::zeroed();
        let failed = loop {
            let status = GetMessageW(&mut message, std::ptr::null_mut(), 0, 0);
            if status <= 0 {
                break status < 0;
            }
            TranslateMessage(&message);
            DispatchMessageW(&message);
        };
        if IsWindow(window) != 0 {
            DestroyWindow(window);
            PeekMessageW(
                &mut message,
                std::ptr::null_mut(),
                WM_QUIT,
                WM_QUIT,
                PM_REMOVE,
            );
        }
        UnregisterClassW(name.as_ptr(), instance);
        if failed {
            return Err("the colour picker message loop failed");
        }
        let Some(point) = result.point else {
            return Ok(None);
        };
        // Wait for DWM to remove our overlay before reading the chosen pixel.
        let _ = DwmFlush();
        let dc = GetDC(std::ptr::null_mut());
        if dc.is_null() {
            return Err("could not read the desktop colour");
        }
        let pixel = GetPixel(dc, point.x, point.y);
        ReleaseDC(std::ptr::null_mut(), dc);
        rgb_hex(pixel)
            .map(Some)
            .ok_or("the selected pixel is unavailable")
    }
}

fn rgb_hex(pixel: u32) -> Option<String> {
    (pixel != u32::MAX).then(|| {
        format!(
            "#{:02x}{:02x}{:02x}",
            pixel & 255,
            (pixel >> 8) & 255,
            (pixel >> 16) & 255
        )
    })
}

// SAFETY: Win32 calls this only for our registered class. GWLP_USERDATA points
// to Pick for the lifetime of the window; no reference crosses a message call.
unsafe extern "system" fn procedure(window: HWND, message: u32, w: WPARAM, l: LPARAM) -> LRESULT {
    unsafe {
        match message {
            WM_NCCREATE => {
                let create = &*(l as *const CREATESTRUCTW);
                SetWindowLongPtrW(window, GWLP_USERDATA, create.lpCreateParams as isize);
                1
            }
            WM_LBUTTONDOWN | WM_RBUTTONDOWN => 0,
            WM_LBUTTONUP => {
                let state = GetWindowLongPtrW(window, GWLP_USERDATA) as *mut Pick;
                let mut point = POINT { x: 0, y: 0 };
                if !state.is_null() && GetCursorPos(&mut point) != 0 {
                    (*state).point = Some(point);
                }
                ShowWindow(window, SW_HIDE);
                DestroyWindow(window);
                0
            }
            WM_KEYDOWN if w == 27 => {
                DestroyWindow(window);
                0
            }
            WM_RBUTTONUP | WM_CLOSE | WM_TIMER => {
                DestroyWindow(window);
                0
            }
            WM_ACTIVATEAPP if w == 0 => {
                DestroyWindow(window);
                0
            }
            WM_DESTROY => {
                PostQuitMessage(0);
                0
            }
            _ => DefWindowProcW(window, message, w, l),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::rgb_hex;

    #[test]
    fn converts_windows_bgr_and_rejects_unavailable_pixels() {
        assert_eq!(rgb_hex(0x001673f9).as_deref(), Some("#f97316"));
        assert_eq!(rgb_hex(0).as_deref(), Some("#000000"));
        assert_eq!(rgb_hex(0x00ff_ffff).as_deref(), Some("#ffffff"));
        assert_eq!(rgb_hex(u32::MAX), None);
    }
}
