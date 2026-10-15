//! Read-only Toolhelp topology, executable identity, token SID and private WS.
//! Only Bezel names and WebView2 descendants reach `details`; there is no
//! all-process memory/CPU refresh and no page-by-page working set scan.
use std::ffi::OsString;
use std::os::windows::ffi::OsStringExt;
use std::path::PathBuf;

use windows_sys::Win32::Foundation::{
    CloseHandle, ERROR_NO_MORE_FILES, GetLastError, HANDLE, INVALID_HANDLE_VALUE,
};
use windows_sys::Win32::Security::{
    CopySid, GetLengthSid, GetTokenInformation, TOKEN_QUERY, TOKEN_USER, TokenUser,
};
use windows_sys::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, PROCESSENTRY32W, Process32FirstW, Process32NextW, TH32CS_SNAPPROCESS,
};
use windows_sys::Win32::System::ProcessStatus::{
    GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS_EX2,
};
use windows_sys::Win32::System::Threading::{
    GetCurrentProcess, OpenProcess, OpenProcessToken, PROCESS_QUERY_LIMITED_INFORMATION,
    QueryFullProcessImageNameW,
};

use super::{Details, Enumerator, Process};

struct Handle(HANDLE);
impl Drop for Handle {
    fn drop(&mut self) {
        // SAFETY: Handle owns one non-null, non-pseudo kernel handle.
        unsafe {
            CloseHandle(self.0);
        }
    }
}

fn user(process: HANDLE) -> Option<Vec<u8>> {
    let mut token = std::ptr::null_mut();
    // SAFETY: process is live for this call; token is a writable out parameter.
    if unsafe { OpenProcessToken(process, TOKEN_QUERY, &mut token) } == 0 {
        return None;
    }
    let token = Handle(token);
    let mut length = 0;
    // SAFETY: null buffer with size zero requests the required byte length.
    unsafe {
        GetTokenInformation(token.0, TokenUser, std::ptr::null_mut(), 0, &mut length);
    }
    if length == 0 {
        return None;
    }
    // usize alignment is sufficient for TOKEN_USER, whose only pointer is a SID.
    let mut buffer = vec![0usize; (length as usize).div_ceil(std::mem::size_of::<usize>())];
    // SAFETY: buffer is aligned and holds at least length writable bytes.
    if unsafe {
        GetTokenInformation(
            token.0,
            TokenUser,
            buffer.as_mut_ptr().cast(),
            length,
            &mut length,
        )
    } == 0
    {
        return None;
    }
    // SAFETY: a successful TokenUser query initialized TOKEN_USER and its SID
    // within buffer; the buffer remains alive until after CopySid.
    let sid = unsafe { (*buffer.as_ptr().cast::<TOKEN_USER>()).User.Sid };
    // SAFETY: sid points to the valid SID returned by GetTokenInformation.
    let length = unsafe { GetLengthSid(sid) };
    let mut copy = vec![0u8; length as usize];
    // SAFETY: copy has the SID's byte length; sid is valid while buffer lives.
    (unsafe { CopySid(length, copy.as_mut_ptr().cast(), sid) } != 0).then_some(copy)
}

pub(super) struct Processes {
    user: Vec<u8>,
}
impl Processes {
    pub(super) fn new() -> Option<Self> {
        // SAFETY: GetCurrentProcess returns a valid pseudo-handle; not owned.
        Some(Self {
            user: user(unsafe { GetCurrentProcess() })?,
        })
    }
}
impl Enumerator for Processes {
    fn processes(&mut self) -> Option<Vec<Process>> {
        // SAFETY: snapshot flags and PID 0 request the system process topology.
        let snapshot = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) };
        if snapshot == INVALID_HANDLE_VALUE {
            return None;
        }
        let snapshot = Handle(snapshot);
        let mut entry = PROCESSENTRY32W {
            dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
            ..Default::default()
        };
        let mut entries = Vec::new();
        // SAFETY: snapshot is a process snapshot; entry has the required size.
        let mut next = unsafe { Process32FirstW(snapshot.0, &mut entry) };
        while next != 0 {
            let length = entry
                .szExeFile
                .iter()
                .position(|c| *c == 0)
                .unwrap_or(entry.szExeFile.len());
            entries.push(Process {
                pid: entry.th32ProcessID,
                parent: entry.th32ParentProcessID,
                name: String::from_utf16_lossy(&entry.szExeFile[..length]),
            });
            // SAFETY: same live snapshot and writable, correctly sized entry.
            next = unsafe { Process32NextW(snapshot.0, &mut entry) };
        }
        // SAFETY: immediately reads the enumeration's final error on this thread.
        (unsafe { GetLastError() } == ERROR_NO_MORE_FILES).then_some(entries)
    }

    fn details(&mut self, pid: u32) -> Option<Details> {
        // SAFETY: read-only limited query access; no debug privilege, no writes.
        let process = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid) };
        if process.is_null() {
            return None;
        }
        let process = Handle(process);
        let same_user = user(process.0)? == self.user;
        if !same_user {
            return None;
        }
        let mut path = vec![0u16; 32768];
        let mut length = path.len() as u32;
        // SAFETY: path holds length writable UTF-16 units; handle is live.
        if unsafe { QueryFullProcessImageNameW(process.0, 0, path.as_mut_ptr(), &mut length) } == 0
        {
            return None;
        }
        let path = PathBuf::from(OsString::from_wide(&path[..length as usize]));
        let path = std::fs::canonicalize(path).ok()?;
        let mut counters = PROCESS_MEMORY_COUNTERS_EX2 {
            cb: std::mem::size_of::<PROCESS_MEMORY_COUNTERS_EX2>() as u32,
            ..Default::default()
        };
        // SAFETY: EX2 starts with PROCESS_MEMORY_COUNTERS; cb describes the full
        // writable struct. Supported since Windows 10/11 22H2 (September 2023).
        // Older Windows or a process exiting mid-query returns unavailable.
        let bytes = (unsafe {
            GetProcessMemoryInfo(
                process.0,
                (&mut counters as *mut PROCESS_MEMORY_COUNTERS_EX2).cast(),
                counters.cb,
            )
        } != 0)
            .then_some(counters.PrivateWorkingSetSize as u64);
        Some(Details {
            path,
            same_user,
            bytes,
        })
    }
}
