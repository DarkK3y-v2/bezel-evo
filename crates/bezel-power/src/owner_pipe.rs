//! Windows-only authenticated local named pipe. Unsafe is confined to Win32
//! handle/token construction and cancellation; payload handling is safe Rust.
#![allow(unsafe_code)]
use crate::{owner::Owner, owner_protocol};
use bezel_core::Result;
use bezel_core::domain::job::Job;
use bezel_core::ports::{DeviceBus, ScreenChannel};
use std::fs::{File, OpenOptions};
use std::io::{self, Read, Write};
use std::os::windows::{
    fs::OpenOptionsExt,
    io::{AsRawHandle, FromRawHandle, OwnedHandle},
};
use std::path::Path;
use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
};
use std::time::{Duration, Instant};
use windows_sys::Win32::{
    Foundation::*,
    Security::{Authorization::*, *},
    Storage::FileSystem::*,
    System::{IO::CancelSynchronousIo, Pipes::*, Threading::*},
};

fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(Some(0)).collect()
}
fn error() -> io::Error {
    io::Error::last_os_error()
}

struct Local(*mut std::ffi::c_void);
impl Drop for Local {
    fn drop(&mut self) {
        // SAFETY: pointers here are returned by Convert* APIs using LocalAlloc.
        unsafe {
            LocalFree(self.0);
        }
    }
}
fn token_sid(process: HANDLE) -> io::Result<String> {
    let mut raw = std::ptr::null_mut();
    // SAFETY: process is live and output points to a HANDLE.
    if unsafe { OpenProcessToken(process, TOKEN_QUERY, &mut raw) } == 0 {
        return Err(error());
    }
    // SAFETY: OpenProcessToken transferred ownership of this valid handle.
    let token = unsafe { OwnedHandle::from_raw_handle(raw) };
    let mut needed = 0;
    // SAFETY: size query with no output buffer, as required by Win32.
    unsafe {
        GetTokenInformation(
            token.as_raw_handle(),
            TokenUser,
            std::ptr::null_mut(),
            0,
            &mut needed,
        );
    }
    let mut buffer = vec![0u64; (needed as usize).div_ceil(8)];
    // SAFETY: u64 storage is sufficiently aligned for TOKEN_USER and large enough.
    if unsafe {
        GetTokenInformation(
            token.as_raw_handle(),
            TokenUser,
            buffer.as_mut_ptr().cast(),
            needed,
            &mut needed,
        )
    } == 0
    {
        return Err(error());
    }
    // SAFETY: successful TokenUser query initialized a TOKEN_USER in buffer.
    let user = unsafe { &*buffer.as_ptr().cast::<TOKEN_USER>() };
    let mut text = std::ptr::null_mut();
    // SAFETY: the SID belongs to the live token buffer; output is LocalAlloc-owned.
    if unsafe { ConvertSidToStringSidW(user.User.Sid, &mut text) } == 0 {
        return Err(error());
    }
    let _text = Local(text.cast());
    let mut len = 0;
    // SAFETY: ConvertSidToStringSidW returns a null-terminated UTF-16 string.
    unsafe {
        while *text.add(len) != 0 {
            len += 1;
        }
    }
    // SAFETY: the preceding scan found the string's initialized length.
    Ok(String::from_utf16_lossy(unsafe {
        std::slice::from_raw_parts(text, len)
    }))
}
fn current_sid() -> io::Result<String> {
    // SAFETY: the pseudo handle remains valid and is not owned/closed here.
    token_sid(unsafe { GetCurrentProcess() })
}
fn descriptor(sid: &str) -> io::Result<Local> {
    let text = wide(&format!("D:P(A;;GA;;;{sid})"));
    let mut raw = std::ptr::null_mut();
    // SAFETY: SDDL is terminated and output is an owned security descriptor.
    if unsafe {
        ConvertStringSecurityDescriptorToSecurityDescriptorW(
            text.as_ptr(),
            SDDL_REVISION_1,
            &mut raw,
            std::ptr::null_mut(),
        )
    } == 0
    {
        return Err(error());
    }
    Ok(Local(raw))
}
/// Local-only name, isolated by installation and actual token SID.
pub fn name(directory: &Path) -> io::Result<String> {
    let install = directory
        .file_name()
        .ok_or_else(|| io::Error::other("no installation key"))?
        .to_string_lossy();
    Ok(format!(
        r"\\.\pipe\bezel-light-v2-{}-{install}",
        current_sid()?
    ))
}

/// A synchronous handle with cancellation deadlines around individual I/O calls.
/// A blocked or crashed peer cannot retain an upload or a partial packet forever.
struct TimedFile {
    file: File,
    timeout: Duration,
}
impl TimedFile {
    fn io<T>(&mut self, op: impl FnOnce(&mut File) -> io::Result<T>) -> io::Result<T> {
        // SAFETY: the ID names this thread for the duration of this scoped call.
        let raw = unsafe { OpenThread(THREAD_TERMINATE, 0, GetCurrentThreadId()) };
        if raw.is_null() {
            return Err(error());
        }
        // SAFETY: OpenThread returned a uniquely owned handle.
        let thread = unsafe { OwnedHandle::from_raw_handle(raw) };
        let (done, wait) = std::sync::mpsc::channel();
        let timeout = self.timeout;
        let watcher = std::thread::spawn(move || {
            if wait.recv_timeout(timeout).is_ok() {
                return false;
            }
            loop {
                // SAFETY: thread is a live owned handle; cancellation affects
                // only outstanding synchronous I/O, never memory or device state.
                unsafe {
                    CancelSynchronousIo(thread.as_raw_handle());
                }
                match wait.recv_timeout(Duration::from_millis(10)) {
                    Ok(()) | Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => return true,
                    Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {}
                }
            }
        });
        let result = op(&mut self.file);
        let _ = done.send(());
        if watcher.join().unwrap_or(true) {
            return Err(io::Error::new(
                io::ErrorKind::TimedOut,
                "Light pipe I/O deadline",
            ));
        }
        result
    }
}
impl Read for TimedFile {
    fn read(&mut self, out: &mut [u8]) -> io::Result<usize> {
        self.io(|f| f.read(out))
    }
}
impl Write for TimedFile {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        self.io(|f| f.write(bytes))
    }
    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

/// Connected editor session. EOF on drop resumes the saved-theme runtime.
pub struct PipeChannel {
    stream: TimedFile,
    connected: bool,
}
impl PipeChannel {
    /// Connects only to a same-user local server; never starts a process.
    pub fn connect(directory: &Path, timeout: Duration) -> io::Result<Self> {
        let path = name(directory)?;
        let deadline = Instant::now() + timeout;
        let file = loop {
            match OpenOptions::new()
                .read(true)
                .write(true)
                .custom_flags(SECURITY_SQOS_PRESENT | SECURITY_IDENTIFICATION)
                .open(&path)
            {
                Ok(file) => break file,
                Err(e)
                    if matches!(e.raw_os_error(), Some(2 | 231)) && Instant::now() < deadline =>
                {
                    std::thread::sleep(Duration::from_millis(25))
                }
                Err(e) => return Err(e),
            }
        };
        let mut pid = 0;
        // SAFETY: file is a live pipe handle and pid is a writable output.
        if unsafe { GetNamedPipeServerProcessId(file.as_raw_handle(), &mut pid) } == 0 {
            return Err(error());
        }
        // SAFETY: query-only process handle for the kernel-reported peer PID.
        let raw = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid) };
        if raw.is_null() {
            return Err(error());
        }
        // SAFETY: OpenProcess transferred a live handle.
        let process = unsafe { OwnedHandle::from_raw_handle(raw) };
        if token_sid(process.as_raw_handle())? != current_sid()? {
            return Err(io::Error::new(
                io::ErrorKind::PermissionDenied,
                "Light server belongs to another user",
            ));
        }
        let mut stream = TimedFile {
            file,
            timeout: Duration::from_secs(15),
        };
        // A compatible authenticated server must answer before any device write.
        owner_protocol::write_packet(&mut stream, b"hello", &[])?;
        let (reply, payload) = owner_protocol::read_packet(&mut stream)?;
        if reply != b"ready" || !payload.is_empty() {
            return Err(io::Error::other("incompatible Light server"));
        }
        Ok(Self {
            stream,
            connected: true,
        })
    }
}
impl ScreenChannel for PipeChannel {
    fn exchange_binary(&mut self, metadata: &[u8], payload: &[u8]) -> Result<(Vec<u8>, Vec<u8>)> {
        let result = (|| {
            owner_protocol::write_packet(&mut self.stream, metadata, payload)?;
            owner_protocol::read_packet(&mut self.stream)
        })();
        if result.is_err() {
            self.connected = false;
        }
        result.map_err(|e| bezel_core::BezelError::Transport(e.to_string()))
    }
    fn connected(&self) -> bool {
        self.connected
    }
    fn exchange(
        &mut self,
        metadata: &[u8],
        payload: &[u8],
        job: Option<&mut Job<'_>>,
    ) -> Result<Vec<u8>> {
        let result = owner_protocol::exchange(&mut self.stream, metadata, payload, job);
        if result.is_err() {
            self.connected = false;
        }
        result
    }
}

/// The authenticated local listener. Binding completes before Light starts
/// the renderer, so Studio can discover the owner without yielding its links.
pub struct Server {
    file: File,
}
impl Server {
    /// ACL contains exactly the current token's user SID, with no inherited ACEs.
    pub fn bind(directory: &Path) -> io::Result<Self> {
        let descriptor = descriptor(&current_sid()?)?;
        let attributes = SECURITY_ATTRIBUTES {
            nLength: std::mem::size_of::<SECURITY_ATTRIBUTES>() as u32,
            lpSecurityDescriptor: descriptor.0,
            bInheritHandle: 0,
        };
        let path = wide(&name(directory)?);
        // SAFETY: path/attributes/descriptor live through the call. Windows
        // copies the descriptor. The result is synchronous and non-inheritable.
        let raw = unsafe {
            CreateNamedPipeW(
                path.as_ptr(),
                PIPE_ACCESS_DUPLEX | FILE_FLAG_FIRST_PIPE_INSTANCE,
                PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT | PIPE_REJECT_REMOTE_CLIENTS,
                1,
                1024 * 1024,
                1024 * 1024,
                0,
                &attributes,
            )
        };
        if raw == INVALID_HANDLE_VALUE {
            return Err(error());
        }
        // SAFETY: CreateNamedPipeW transferred a uniquely owned pipe handle.
        Ok(Self {
            file: unsafe { File::from_raw_handle(raw) },
        })
    }
    /// Serves one Studio session at a time. A dead client releases only its
    /// editor lease; the Owner and all physical links survive the next accept.
    pub fn serve(
        self,
        owner: Owner,
        bus: Arc<dyn DeviceBus + Send + Sync>,
        stop: Arc<AtomicBool>,
    ) -> io::Result<()> {
        self.serve_runtime(owner, bus, stop, None)
    }
    /// Serve the persistent runtime alongside device control operations.
    pub fn serve_runtime(
        self,
        owner: Owner,
        bus: Arc<dyn DeviceBus + Send + Sync>,
        stop: Arc<AtomicBool>,
        runtime: Option<Arc<std::sync::Mutex<dyn bezel_core::ports::RuntimeEndpoint>>>,
    ) -> io::Result<()> {
        let images = runtime
            .as_ref()
            .and_then(|runtime| runtime.lock().ok()?.images());
        let mut stream = TimedFile {
            file: self.file,
            timeout: Duration::from_secs(15),
        };
        loop {
            if stop.load(Ordering::SeqCst) {
                return Ok(());
            }
            // SAFETY: live synchronous server handle; no OVERLAPPED structure.
            let connected =
                unsafe { ConnectNamedPipe(stream.file.as_raw_handle(), std::ptr::null_mut()) };
            if connected == 0 && error().raw_os_error() != Some(ERROR_PIPE_CONNECTED as i32) {
                return Err(error());
            }
            let handshake = owner_protocol::read_packet(&mut stream);
            if let Ok((hello, payload)) = handshake
                && hello == b"hello"
                && payload.is_empty()
                && owner_protocol::write_packet(&mut stream, b"ready", &[]).is_ok()
            {
                crate::diagnostics::light(
                    crate::diagnostics::LightEvent::SessionOpened,
                    0,
                    0.0,
                    "client",
                );
                owner.set_editing(true);
                let connector = owner.client(true);
                let mut screens = Vec::new();
                loop {
                    // At a packet boundary Studio may be idle indefinitely.
                    // Peek polls for bytes/EOF without blocking shutdown or crash recovery.
                    let mut available = 0;
                    // SAFETY: pipe handle is live, only available is an output.
                    if unsafe {
                        PeekNamedPipe(
                            stream.file.as_raw_handle(),
                            std::ptr::null_mut(),
                            0,
                            std::ptr::null_mut(),
                            &mut available,
                            std::ptr::null_mut(),
                        )
                    } == 0
                    {
                        break;
                    }
                    if stop.load(Ordering::SeqCst) {
                        break;
                    }
                    if available == 0 {
                        std::thread::sleep(Duration::from_millis(5));
                        continue;
                    }
                    let Ok((metadata, payload)) = owner_protocol::read_packet(&mut stream) else {
                        break;
                    };
                    if let Some(runtime) = &runtime
                        && serde_json::from_slice::<serde_json::Value>(&metadata)
                            .is_ok_and(|v| v["runtime"] == 2)
                    {
                        let readonly = payload.is_empty()
                            && serde_json::from_slice::<serde_json::Value>(&metadata)
                                .is_ok_and(|v| v["op"]["command"] == "Image");
                        let answer = if readonly && let Some(images) = &images {
                            images
                                .image(&metadata)
                                .map_err(|e| io::Error::other(e.to_string()))?
                        } else {
                            runtime
                                .lock()
                                .map_err(|_| io::Error::other("runtime lock poisoned"))?
                                .request(&metadata, &payload)
                                .map_err(|e| io::Error::other(e.to_string()))?
                        };
                        if owner_protocol::write_packet(&mut stream, &answer.0, &answer.1).is_err()
                        {
                            break;
                        }
                        continue;
                    }
                    if runtime.is_some() && owner_protocol::supplies_frame(&metadata) {
                        break;
                    }
                    if screens.is_empty() || owner_protocol::needs_discovery(&metadata) {
                        let Ok(found) = bezel_core::app::discover_screens(bus.as_ref()) else {
                            break;
                        };
                        screens = found;
                    }
                    if owner_protocol::serve_request(
                        &mut stream,
                        &connector,
                        &screens,
                        &metadata,
                        &payload,
                    )
                    .is_err()
                    {
                        break;
                    }
                }
                if let Some(runtime) = &runtime
                    && let Ok(mut runtime) = runtime.lock()
                {
                    let _ = runtime.disconnected();
                }
                owner.set_editing(false);
                if runtime.is_some() {
                    owner.saved_ready();
                }
            }
            // SAFETY: disconnect does not close the server instance; pending
            // client requests fail and the next client gets a fresh session.
            unsafe {
                DisconnectNamedPipe(stream.file.as_raw_handle());
            }
        }
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;
    use crate::owner_protocol::RemoteConnector;
    use bezel_core::domain::{
        screen::Brightness,
        storage::{RemotePath, Repeat},
    };
    use bezel_core::{app::discover_screens, ports::ScreenConnector};
    use bezel_devices::fake::{FakeStorage, StorageCall};
    use bezel_devices::{FakeBus, FakeConnector};
    static NEXT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
    fn directory() -> std::path::PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../target")
            .join(format!(
                "pipe-test-{}-{}",
                std::process::id(),
                NEXT.fetch_add(1, Ordering::Relaxed)
            ))
    }
    fn until(mut predicate: impl FnMut() -> bool) {
        let end = Instant::now() + Duration::from_secs(3);
        while !predicate() {
            assert!(Instant::now() < end, "pipe state timed out");
            std::thread::sleep(Duration::from_millis(5));
        }
    }
    #[test]
    fn binary_runtime_disconnect_releases_lease_without_touching_device() {
        struct Endpoint(Arc<std::sync::atomic::AtomicUsize>);
        impl bezel_core::ports::RuntimeEndpoint for Endpoint {
            fn request(&mut self, _: &[u8], payload: &[u8]) -> Result<(Vec<u8>, Vec<u8>)> {
                Ok((b"image".to_vec(), payload.to_vec()))
            }
            fn disconnected(&mut self) -> Result<()> {
                self.0.fetch_add(1, Ordering::SeqCst);
                Ok(())
            }
        }
        let directory = directory();
        let server = Server::bind(&directory).unwrap();
        let physical = FakeConnector::default();
        let owner = Owner::new(Arc::new(physical.clone()));
        let state = owner.clone();
        let detached = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let count = detached.clone();
        let runtime = Arc::new(std::sync::Mutex::new(Endpoint(count)));
        let stop = Arc::new(AtomicBool::new(false));
        let flag = stop.clone();
        let worker = std::thread::spawn(move || {
            server
                .serve_runtime(state, Arc::new(FakeBus::turing_88()), flag, Some(runtime))
                .unwrap()
        });
        for round in 0..2 {
            let mut client = PipeChannel::connect(&directory, Duration::from_secs(1)).unwrap();
            let pixels = vec![255; 128 * 32 * 4];
            let (meta, reply) = client
                .exchange_binary(br#"{"runtime":2}"#, &pixels)
                .unwrap();
            assert_eq!(meta, b"image");
            assert_eq!(reply, pixels);
            if round == 1 {
                stop.store(true, Ordering::SeqCst);
            }
            drop(client);
            until(|| detached.load(Ordering::SeqCst) == round + 1);
        }
        worker.join().unwrap();
        assert_eq!(physical.log().connects, 0);
        assert!(!owner.reload_pending());
    }

    #[test]
    fn canvas_snapshot_bypasses_the_engine_mutex_over_the_real_pipe() {
        struct Images;
        impl bezel_core::ports::RuntimeImages for Images {
            fn image(&self, _: &[u8]) -> Result<(Vec<u8>, Vec<u8>)> {
                Ok((b"snapshot".to_vec(), vec![7; 16]))
            }
        }
        struct Endpoint;
        impl bezel_core::ports::RuntimeEndpoint for Endpoint {
            fn images(&self) -> Option<Arc<dyn bezel_core::ports::RuntimeImages>> {
                Some(Arc::new(Images))
            }
            fn request(&mut self, _: &[u8], _: &[u8]) -> Result<(Vec<u8>, Vec<u8>)> {
                panic!("snapshot must not enter the engine");
            }
            fn disconnected(&mut self) -> Result<()> {
                Ok(())
            }
        }
        let directory = directory();
        let server = Server::bind(&directory).unwrap();
        let owner = Owner::new(Arc::new(FakeConnector::default()));
        let runtime = Arc::new(std::sync::Mutex::new(Endpoint));
        let engine = runtime.clone();
        let stop = Arc::new(AtomicBool::new(false));
        let flag = stop.clone();
        let worker = std::thread::spawn(move || {
            server
                .serve_runtime(owner, Arc::new(FakeBus::turing_88()), flag, Some(runtime))
                .unwrap()
        });
        // The handshake happens after the server acquires the immutable image port.
        let mut client = PipeChannel::connect(&directory, Duration::from_secs(1)).unwrap();
        let guard = engine.lock().unwrap();
        let (sent, received) = std::sync::mpsc::channel();
        let request = std::thread::spawn(move || {
            let reply = client.exchange_binary(br#"{"runtime":2,"op":{"command":"Image"}}"#, &[]);
            sent.send(reply).unwrap();
            client
        });
        let answer = received.recv_timeout(Duration::from_millis(500));
        // Release even on failure, so a regression cannot deadlock the test suite.
        stop.store(true, Ordering::SeqCst);
        drop(guard);
        let client = request.join().unwrap();
        drop(client);
        worker.join().unwrap();
        assert_eq!(
            answer.unwrap().unwrap(),
            (b"snapshot".to_vec(), vec![7; 16])
        );
    }

    #[test]
    fn real_pipe_drop_recovers_without_reopening_device() {
        let directory = directory();
        let server = Server::bind(&directory).unwrap();
        assert!(
            Server::bind(&directory).is_err(),
            "first-instance prevents a second server"
        );
        let path = RemotePath::parse("internal/video/earth.mp4").unwrap();
        let physical =
            FakeConnector::with_storage(FakeStorage::default().with_file(path.clone(), vec![1]));
        let owner = Owner::new(Arc::new(physical.clone()));
        let state = owner.clone();
        let stop = Arc::new(AtomicBool::new(false));
        let flag = Arc::clone(&stop);
        let server = std::thread::spawn(move || {
            server
                .serve(state, Arc::new(FakeBus::turing_88()), flag)
                .unwrap()
        });
        let screen = discover_screens(&FakeBus::turing_88()).unwrap().remove(0);
        for round in 0..2 {
            let channel = PipeChannel::connect(&directory, Duration::from_secs(1)).unwrap();
            let remote = RemoteConnector::new(Box::new(channel));
            let mut editor = remote.connect(&screen).unwrap();
            editor.set_brightness(Brightness::MAX).unwrap();
            editor
                .set_orientation(bezel_core::domain::geometry::Orientation::Landscape)
                .unwrap();
            let frame = bezel_core::domain::frame::Frame::filled(
                bezel_core::domain::geometry::Size::new(1920, 480),
                bezel_core::domain::frame::Rgba::BLACK,
            );
            editor.present(&frame).unwrap();
            editor
                .storage()
                .unwrap()
                .resume_video(&path, Repeat::Loop)
                .unwrap();
            until(|| owner.editing());
            if round == 1 {
                stop.store(true, Ordering::SeqCst);
            }
            drop(editor);
            drop(remote);
            until(|| !owner.editing());
        }
        server.join().unwrap();
        assert_eq!(physical.log().connects, 1);
        assert_eq!(physical.log().frames.len(), 2);
        assert_eq!(
            physical.log().storage.calls,
            [StorageCall::PlayVideo(path, Repeat::Loop)]
        );
        assert_eq!(physical.log().releases, 0);
    }

    #[test]
    fn stalled_pipe_io_is_cancelled_with_a_real_deadline() {
        let directory = directory();
        let server = Server::bind(&directory).unwrap();
        let worker = std::thread::spawn(move || {
            // SAFETY: live synchronous pipe instance, no overlapped argument.
            let connected =
                unsafe { ConnectNamedPipe(server.file.as_raw_handle(), std::ptr::null_mut()) };
            assert!(connected != 0 || error().raw_os_error() == Some(ERROR_PIPE_CONNECTED as i32));
            let mut timed = TimedFile {
                file: server.file,
                timeout: Duration::from_millis(50),
            };
            let mut byte = [0];
            assert_eq!(
                timed.read(&mut byte).unwrap_err().kind(),
                io::ErrorKind::TimedOut
            );
        });
        let _client = OpenOptions::new()
            .read(true)
            .write(true)
            .open(name(&directory).unwrap())
            .unwrap();
        worker.join().unwrap();
    }

    #[test]
    fn server_crash_marks_transport_dead_without_replaying_the_request() {
        let directory = directory();
        let server = Server::bind(&directory).unwrap();
        let (close, wait) = std::sync::mpsc::channel();
        let worker = std::thread::spawn(move || {
            // SAFETY: live synchronous server handle and no OVERLAPPED.
            let connected =
                unsafe { ConnectNamedPipe(server.file.as_raw_handle(), std::ptr::null_mut()) };
            assert!(connected != 0 || error().raw_os_error() == Some(ERROR_PIPE_CONNECTED as i32));
            let mut file = server.file;
            assert_eq!(owner_protocol::read_packet(&mut file).unwrap().0, b"hello");
            owner_protocol::write_packet(&mut file, b"ready", &[]).unwrap();
            wait.recv().unwrap();
        });
        let mut client = PipeChannel::connect(&directory, Duration::from_secs(1)).unwrap();
        close.send(()).unwrap();
        worker.join().unwrap();
        assert!(client.exchange(b"one request", &[], None).is_err());
        assert!(!client.connected());
    }

    #[test]
    fn windows_acl_denies_a_token_restricted_to_a_foreign_sid() {
        let directory = directory();
        let _server = Server::bind(&directory).unwrap();
        let path = name(&directory).unwrap();
        // Real Windows access check, with a restricted token requiring a
        // foreign SID as well as the normal token grants. No credentials or
        // privileged test account is needed and no device is involved.
        std::thread::spawn(move || {
            let mut raw = std::ptr::null_mut();
            // SAFETY: output handle is writable and the pseudo process is live.
            assert_ne!(
                unsafe {
                    OpenProcessToken(
                        GetCurrentProcess(),
                        TOKEN_DUPLICATE | TOKEN_QUERY | TOKEN_IMPERSONATE,
                        &mut raw,
                    )
                },
                0
            );
            // SAFETY: successful OpenProcessToken returned ownership.
            let token = unsafe { OwnedHandle::from_raw_handle(raw) };
            let sid_text = wide("S-1-5-21-111111111-222222222-333333333-1234");
            let mut sid = std::ptr::null_mut();
            // SAFETY: terminated SID string, writable LocalAlloc-owned output.
            assert_ne!(
                unsafe { ConvertStringSidToSidW(sid_text.as_ptr(), &mut sid) },
                0
            );
            let _sid = Local(sid);
            let restricted_sid = SID_AND_ATTRIBUTES {
                Sid: sid,
                Attributes: 0,
            };
            let mut restricted = std::ptr::null_mut();
            // SAFETY: all counts match their buffers; original token remains live.
            assert_ne!(
                unsafe {
                    CreateRestrictedToken(
                        token.as_raw_handle(),
                        0,
                        0,
                        std::ptr::null(),
                        0,
                        std::ptr::null(),
                        1,
                        &restricted_sid,
                        &mut restricted,
                    )
                },
                0
            );
            // SAFETY: successful CreateRestrictedToken returned ownership.
            let restricted = unsafe { OwnedHandle::from_raw_handle(restricted) };
            // SAFETY: restricted token is this user's, not a privileged identity.
            assert_ne!(
                unsafe { ImpersonateLoggedOnUser(restricted.as_raw_handle()) },
                0
            );
            struct Revert;
            impl Drop for Revert {
                fn drop(&mut self) {
                    // SAFETY: restores this thread's original identity on all paths.
                    unsafe {
                        RevertToSelf();
                    }
                }
            }
            let revert = Revert;
            let result = OpenOptions::new().read(true).write(true).open(path);
            drop(revert);
            assert_eq!(
                result.unwrap_err().raw_os_error(),
                Some(ERROR_ACCESS_DENIED as i32)
            );
        })
        .join()
        .unwrap();
    }
}
