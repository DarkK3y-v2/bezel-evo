//! Desktop colour picking with a pixel-accurate magnifier and HEX swatch.
//! A temporary in-memory desktop snapshot freezes the selection surface so the
//! preview never samples itself. No screenshot is saved or returned to Studio.
#![allow(unsafe_code)]

use std::sync::atomic::{AtomicBool, Ordering};
use windows_sys::Win32::Foundation::{HWND, LPARAM, LRESULT, POINT, RECT, WPARAM};
use windows_sys::Win32::Graphics::Gdi::*;
use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
use windows_sys::Win32::UI::HiDpi::*;
use windows_sys::Win32::UI::WindowsAndMessaging::*;

static ACTIVE: AtomicBool = AtomicBool::new(false);
const CELLS: i32 = 11;
const CELL: i32 = 12;
const PAD: i32 = 12;
const PANEL_WIDTH: i32 = 156;
const PANEL_HEIGHT: i32 = 190;

struct Active;
impl Drop for Active {
    fn drop(&mut self) {
        ACTIVE.store(false, Ordering::Release);
    }
}
struct Dpi(DPI_AWARENESS_CONTEXT);
impl Drop for Dpi {
    fn drop(&mut self) {
        if !self.0.is_null() {
            // SAFETY: restores this thread's previous awareness context.
            unsafe {
                SetThreadDpiAwarenessContext(self.0);
            }
        }
    }
}

/// Owned memory DC and bitmap, always deselected before deletion.
struct Surface {
    dc: HDC,
    bitmap: HBITMAP,
    previous: HGDIOBJ,
}
impl Surface {
    unsafe fn new(reference: HDC, width: i32, height: i32) -> Result<Self, &'static str> {
        unsafe {
            let dc = CreateCompatibleDC(reference);
            if dc.is_null() {
                return Err("could not prepare the colour preview");
            }
            let bitmap = CreateCompatibleBitmap(reference, width, height);
            if bitmap.is_null() {
                DeleteDC(dc);
                return Err("could not allocate the colour preview");
            }
            let previous = SelectObject(dc, bitmap);
            if previous.is_null() || previous as isize == -1 {
                DeleteObject(bitmap);
                DeleteDC(dc);
                return Err("could not select the colour preview");
            }
            Ok(Self {
                dc,
                bitmap,
                previous,
            })
        }
    }
}
impl Drop for Surface {
    fn drop(&mut self) {
        // SAFETY: this thread owns each resource and restores the original object.
        unsafe {
            SelectObject(self.dc, self.previous);
            DeleteObject(self.bitmap);
            DeleteDC(self.dc);
        }
    }
}
struct Desktop {
    surface: Surface,
    bounds: RECT,
}
impl Desktop {
    unsafe fn capture() -> Result<Self, &'static str> {
        unsafe {
            let x = GetSystemMetrics(SM_XVIRTUALSCREEN);
            let y = GetSystemMetrics(SM_YVIRTUALSCREEN);
            let width = GetSystemMetrics(SM_CXVIRTUALSCREEN);
            let height = GetSystemMetrics(SM_CYVIRTUALSCREEN);
            // Bound allocation even for malformed virtual desktop dimensions.
            if width <= 0 || height <= 0 || i64::from(width) * i64::from(height) > 100_000_000 {
                return Err("the desktop dimensions are unavailable");
            }
            let dc = GetDC(std::ptr::null_mut());
            if dc.is_null() {
                return Err("could not read the desktop colour");
            }
            let result = Surface::new(dc, width, height).and_then(|surface| {
                if BitBlt(
                    surface.dc,
                    0,
                    0,
                    width,
                    height,
                    dc,
                    x,
                    y,
                    SRCCOPY | CAPTUREBLT,
                ) == 0
                {
                    return Err("could not capture the colour selection surface");
                }
                Ok(Self {
                    surface,
                    bounds: RECT {
                        left: x,
                        top: y,
                        right: x + width,
                        bottom: y + height,
                    },
                })
            });
            ReleaseDC(std::ptr::null_mut(), dc);
            result
        }
    }
    unsafe fn pixel(&self, point: POINT) -> Option<u32> {
        if point.x < self.bounds.left
            || point.y < self.bounds.top
            || point.x >= self.bounds.right
            || point.y >= self.bounds.bottom
        {
            return None;
        }
        // SAFETY: coordinates are inside our selected bitmap.
        let pixel = unsafe {
            GetPixel(
                self.surface.dc,
                point.x - self.bounds.left,
                point.y - self.bounds.top,
            )
        };
        (pixel != u32::MAX).then_some(pixel)
    }
}
struct Pick {
    desktop: Desktop,
    point: POINT,
    panel: RECT,
    scale: i32,
    selected: Option<String>,
}

fn panel_rect(point: POINT, bounds: RECT, scale: i32) -> RECT {
    let width = (PANEL_WIDTH * scale).min(bounds.right - bounds.left);
    let height = (PANEL_HEIGHT * scale).min(bounds.bottom - bounds.top);
    let gap = 24 * scale;
    let mut x = point.x + gap;
    let mut y = point.y + gap;
    if x + width > bounds.right {
        x = point.x - gap - width;
    }
    if y + height > bounds.bottom {
        y = point.y - gap - height;
    }
    x = x.clamp(bounds.left, bounds.right - width);
    y = y.clamp(bounds.top, bounds.bottom - height);
    RECT {
        left: x,
        top: y,
        right: x + width,
        bottom: y + height,
    }
}

unsafe fn fill(dc: HDC, area: RECT, color: u32) {
    unsafe {
        let brush = CreateSolidBrush(color);
        if !brush.is_null() {
            FillRect(dc, &area, brush);
            DeleteObject(brush);
        }
    }
}
unsafe fn border(dc: HDC, area: RECT, color: u32) {
    unsafe {
        let brush = CreateSolidBrush(color);
        if !brush.is_null() {
            FrameRect(dc, &area, brush);
            DeleteObject(brush);
        }
    }
}

/// Paint into a small back buffer, then copy it to the selection surface once.
unsafe fn draw_panel(dc: HDC, desktop: &Desktop, point: POINT, scale: i32) {
    unsafe {
        let width = PANEL_WIDTH * scale;
        let height = PANEL_HEIGHT * scale;
        fill(
            dc,
            RECT {
                left: 0,
                top: 0,
                right: width,
                bottom: height,
            },
            0x00251e19,
        );
        border(
            dc,
            RECT {
                left: 0,
                top: 0,
                right: width,
                bottom: height,
            },
            0x00736960,
        );
        for row in 0..CELLS {
            for col in 0..CELLS {
                let sample = POINT {
                    x: point.x + col - CELLS / 2,
                    y: point.y + row - CELLS / 2,
                };
                let color = desktop.pixel(sample).unwrap_or(0x00403830);
                let left = (PAD + col * CELL) * scale;
                let top = (PAD + row * CELL) * scale;
                fill(
                    dc,
                    RECT {
                        left,
                        top,
                        right: left + CELL * scale,
                        bottom: top + CELL * scale,
                    },
                    color,
                );
            }
        }
        let center = (PAD + CELLS / 2 * CELL) * scale;
        border(
            dc,
            RECT {
                left: center - 1,
                top: center - 1,
                right: center + CELL * scale + 1,
                bottom: center + CELL * scale + 1,
            },
            0,
        );
        border(
            dc,
            RECT {
                left: center,
                top: center,
                right: center + CELL * scale,
                bottom: center + CELL * scale,
            },
            0x00ff_ffff,
        );
        if let Some(color) = desktop.pixel(point) {
            fill(
                dc,
                RECT {
                    left: PAD * scale,
                    top: 154 * scale,
                    right: 36 * scale,
                    bottom: 178 * scale,
                },
                color,
            );
            border(
                dc,
                RECT {
                    left: PAD * scale,
                    top: 154 * scale,
                    right: 36 * scale,
                    bottom: 178 * scale,
                },
                0x00bcb6b1,
            );
            let text: Vec<u16> = rgb_hex(color)
                .unwrap_or_default()
                .to_uppercase()
                .encode_utf16()
                .collect();
            let face: Vec<u16> = "Consolas\0".encode_utf16().collect();
            let font = CreateFontW(
                -16 * scale,
                0,
                0,
                0,
                600,
                0,
                0,
                0,
                DEFAULT_CHARSET as u32,
                0,
                0,
                CLEARTYPE_QUALITY as u32,
                0,
                face.as_ptr(),
            );
            let old = if font.is_null() {
                std::ptr::null_mut()
            } else {
                SelectObject(dc, font)
            };
            SetBkMode(dc, TRANSPARENT as i32);
            SetTextColor(dc, 0x00f4eee8);
            TextOutW(
                dc,
                44 * scale,
                157 * scale,
                text.as_ptr(),
                text.len() as i32,
            );
            if !font.is_null() {
                SelectObject(dc, old);
                DeleteObject(font);
            }
        }
    }
}

unsafe fn move_preview(window: HWND, state: &mut Pick) {
    unsafe {
        let mut point = POINT { x: 0, y: 0 };
        if GetCursorPos(&mut point) == 0 {
            return;
        }
        let monitor = MonitorFromPoint(point, MONITOR_DEFAULTTONEAREST);
        let mut info: MONITORINFO = std::mem::zeroed();
        info.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
        let bounds = if GetMonitorInfoW(monitor, &mut info) != 0 {
            info.rcMonitor
        } else {
            state.desktop.bounds
        };
        let mut dpi_x = 96;
        let mut dpi_y = 96;
        let _ = GetDpiForMonitor(monitor, MDT_EFFECTIVE_DPI, &mut dpi_x, &mut dpi_y);
        let scale = ((dpi_x + 48) / 96).clamp(1, 4) as i32;
        let panel = panel_rect(point, bounds, scale);
        let local = |r: RECT| RECT {
            left: r.left - state.desktop.bounds.left,
            top: r.top - state.desktop.bounds.top,
            right: r.right - state.desktop.bounds.left,
            bottom: r.bottom - state.desktop.bounds.top,
        };
        InvalidateRect(window, &local(state.panel), 0);
        state.point = point;
        state.panel = panel;
        state.scale = scale;
        InvalidateRect(window, &local(panel), 0);
    }
}

/// Runs on a blocking thread. Esc, right-click, losing activation or a minute
/// cancels. The selected RGB always matches the magnified snapshot pixel.
pub fn pick(owner: usize) -> Result<Option<String>, &'static str> {
    if ACTIVE.swap(true, Ordering::AcqRel) {
        return Err("a colour pick is already active");
    }
    let _active = Active;
    // SAFETY: all GDI/window resources belong to this thread and are released
    // after its modal loop. USERDATA points to state until window destruction.
    unsafe {
        let _dpi = Dpi(SetThreadDpiAwarenessContext(
            DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2,
        ));
        let desktop = Desktop::capture()?;
        let bounds = desktop.bounds;
        let instance = GetModuleHandleW(std::ptr::null());
        let name: Vec<u16> = "BezelEvoEyeDropper\0".encode_utf16().collect();
        let class = WNDCLASSW {
            lpfnWndProc: Some(procedure),
            hInstance: instance,
            lpszClassName: name.as_ptr(),
            hCursor: LoadCursorW(std::ptr::null_mut(), IDC_CROSS),
            ..std::mem::zeroed()
        };
        if RegisterClassW(&class) == 0 {
            return Err("could not register the colour picker");
        }
        let mut result = Pick {
            desktop,
            point: POINT {
                x: bounds.left,
                y: bounds.top,
            },
            panel: RECT {
                left: bounds.left,
                top: bounds.top,
                right: bounds.left,
                bottom: bounds.top,
            },
            scale: 1,
            selected: None,
        };
        let window = CreateWindowExW(
            WS_EX_TOPMOST | WS_EX_TOOLWINDOW,
            name.as_ptr(),
            name.as_ptr(),
            WS_POPUP,
            bounds.left,
            bounds.top,
            bounds.right - bounds.left,
            bounds.bottom - bounds.top,
            owner as HWND,
            std::ptr::null_mut(),
            instance,
            (&raw mut result).cast(),
        );
        if window.is_null() {
            UnregisterClassW(name.as_ptr(), instance);
            return Err("could not open the colour picker");
        }
        if SetTimer(window, 1, 60_000, None) == 0 {
            DestroyWindow(window);
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
        move_preview(window, &mut result);
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
            Err("the colour picker message loop failed")
        } else {
            Ok(result.selected)
        }
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

unsafe extern "system" fn procedure(window: HWND, message: u32, w: WPARAM, l: LPARAM) -> LRESULT {
    // SAFETY: Win32 calls this procedure only for our registered class. The
    // pointer is valid until DestroyWindow returns; no borrow crosses dispatch.
    unsafe {
        let state = GetWindowLongPtrW(window, GWLP_USERDATA) as *mut Pick;
        match message {
            WM_NCCREATE => {
                let create = &*(l as *const CREATESTRUCTW);
                SetWindowLongPtrW(window, GWLP_USERDATA, create.lpCreateParams as isize);
                1
            }
            WM_ERASEBKGND => 1,
            WM_MOUSEMOVE if !state.is_null() => {
                move_preview(window, &mut *state);
                0
            }
            WM_PAINT if !state.is_null() => {
                let state = &*state;
                let mut paint = std::mem::zeroed();
                let dc = BeginPaint(window, &mut paint);
                if !dc.is_null() {
                    let r = paint.rcPaint;
                    BitBlt(
                        dc,
                        r.left,
                        r.top,
                        r.right - r.left,
                        r.bottom - r.top,
                        state.desktop.surface.dc,
                        r.left,
                        r.top,
                        SRCCOPY,
                    );
                    if let Ok(buffer) =
                        Surface::new(dc, PANEL_WIDTH * state.scale, PANEL_HEIGHT * state.scale)
                    {
                        draw_panel(buffer.dc, &state.desktop, state.point, state.scale);
                        BitBlt(
                            dc,
                            state.panel.left - state.desktop.bounds.left,
                            state.panel.top - state.desktop.bounds.top,
                            state.panel.right - state.panel.left,
                            state.panel.bottom - state.panel.top,
                            buffer.dc,
                            0,
                            0,
                            SRCCOPY,
                        );
                    }
                }
                EndPaint(window, &paint);
                0
            }
            WM_LBUTTONDOWN | WM_RBUTTONDOWN => 0,
            WM_LBUTTONUP => {
                if !state.is_null() {
                    let mut point = POINT { x: 0, y: 0 };
                    if GetCursorPos(&mut point) != 0 {
                        (*state).selected = (*state).desktop.pixel(point).and_then(rgb_hex);
                    }
                }
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
    use super::*;
    #[test]
    fn converts_windows_bgr_and_rejects_unavailable_pixels() {
        assert_eq!(rgb_hex(0x001673f9).as_deref(), Some("#f97316"));
        assert_eq!(rgb_hex(0).as_deref(), Some("#000000"));
        assert_eq!(rgb_hex(0x00ff_ffff).as_deref(), Some("#ffffff"));
        assert_eq!(rgb_hex(u32::MAX), None);
    }
    #[test]
    fn panel_stays_on_the_pointed_monitor_including_negative_origins_and_dpi() {
        for scale in 1..=4 {
            let bounds = RECT {
                left: -2560,
                top: -200,
                right: 0,
                bottom: 1240,
            };
            for point in [
                POINT { x: -2559, y: -199 },
                POINT { x: -1, y: 1239 },
                POINT { x: -1200, y: 300 },
            ] {
                let r = panel_rect(point, bounds, scale);
                assert!(
                    r.left >= bounds.left
                        && r.top >= bounds.top
                        && r.right <= bounds.right
                        && r.bottom <= bounds.bottom
                );
                assert!(
                    point.x < r.left
                        || point.x >= r.right
                        || point.y < r.top
                        || point.y >= r.bottom,
                    "the preview must not cover the selected pixel"
                );
            }
        }
    }
    #[test]
    fn magnified_center_swatch_and_return_value_share_the_exact_snapshot_pixel() {
        // SAFETY: test-owned offscreen bitmaps; no desktop capture or window.
        unsafe {
            let dc = GetDC(std::ptr::null_mut());
            assert!(!dc.is_null());
            let source = Surface::new(dc, 32, 32).unwrap();
            let target = Surface::new(dc, PANEL_WIDTH, PANEL_HEIGHT).unwrap();
            ReleaseDC(std::ptr::null_mut(), dc);
            fill(
                source.dc,
                RECT {
                    left: 0,
                    top: 0,
                    right: 32,
                    bottom: 32,
                },
                0x0000ff00,
            );
            SetPixel(source.dc, 16, 16, 0x001673f9);
            let desktop = Desktop {
                surface: source,
                bounds: RECT {
                    left: -100,
                    top: -50,
                    right: -68,
                    bottom: -18,
                },
            };
            let point = POINT { x: -84, y: -34 };
            draw_panel(target.dc, &desktop, point, 1);
            let center = PAD + CELLS / 2 * CELL + CELL / 2;
            assert_eq!(GetPixel(target.dc, center, center), 0x001673f9);
            assert_eq!(GetPixel(target.dc, 20, 162), 0x001673f9);
            assert_eq!(
                GetPixel(target.dc, PAD + CELL / 2, PAD + CELL / 2),
                0x0000ff00
            );
            assert_eq!(
                desktop.pixel(point).and_then(rgb_hex).as_deref(),
                Some("#f97316")
            );
            assert!(desktop.pixel(POINT { x: -101, y: -34 }).is_none());
            // Optional visual QA of the real GDI painter. Only synthetic pixels
            // are exported; this test never captures the user's desktop.
            if let Some(path) = std::env::var_os("BEZEL_PICKER_PREVIEW_BMP") {
                let size = (PANEL_WIDTH * PANEL_HEIGHT * 4) as u32;
                let mut bmp = Vec::new();
                bmp.extend_from_slice(b"BM");
                bmp.extend_from_slice(&(54 + size).to_le_bytes());
                bmp.extend_from_slice(&0_u32.to_le_bytes());
                bmp.extend_from_slice(&54_u32.to_le_bytes());
                bmp.extend_from_slice(&40_u32.to_le_bytes());
                bmp.extend_from_slice(&PANEL_WIDTH.to_le_bytes());
                bmp.extend_from_slice(&(-PANEL_HEIGHT).to_le_bytes());
                bmp.extend_from_slice(&1_u16.to_le_bytes());
                bmp.extend_from_slice(&32_u16.to_le_bytes());
                bmp.extend_from_slice(&[0; 24]);
                for y in 0..PANEL_HEIGHT {
                    for x in 0..PANEL_WIDTH {
                        let pixel = GetPixel(target.dc, x, y);
                        bmp.extend_from_slice(&[
                            (pixel >> 16) as u8,
                            (pixel >> 8) as u8,
                            pixel as u8,
                            255,
                        ]);
                    }
                }
                std::fs::write(path, bmp).unwrap();
            }
        }
    }
}
