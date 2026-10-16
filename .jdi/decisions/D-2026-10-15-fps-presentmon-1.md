# D-2026-10-15-fps-presentmon-1: Intel PresentMon on-demand console app

**Context**: We need to capture `gpu.frametime`, `gpu.fps_low_1p`, `gpu.game`,
and `gpu.limiter` on Windows, which RTSS does not provide. Intel PresentMon
offers this data via ETW.

**Decision**: Use the PresentMon console application (`PresentMon.exe`)
started and stopped on demand by Bezel, rather than the PresentMon Windows
Service or `PresentMonAPI2.dll` (FFI).

**Rationale**:
1. **No FFI / Pure Safe Rust**: the console app outputs standard CSV to
   stdout, so the parser and the metrics stay 100% safe Rust, tested via
   golden fixtures. This follows the strict `deny(unsafe_code)` workspace
   lint; the only exceptions are the Win32 FFI calls for the Job Object and
   the foreground-process query, mirroring the existing `rtss.rs` pattern.
2. **Resource footprint**: running on demand means zero CPU and memory cost
   while no game is running or no theme requests the sensors. PresentMon
   stops about 60 seconds after the last frame (10 seconds when no game ever
   produced one).
3. **Anti-cheat compatibility**: Bezel starts PresentMon only while a game
   is in the foreground and excludes known overlays like `dwm.exe` and
   `discord.exe`, avoiding the ETW session conflicts some anti-cheats raise
   when a session is created mid-game.
4. **Security & lifecycle**: assigning the child process to a Windows Job
   Object with `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` guarantees PresentMon can
   never outlive Bezel, even if Bezel crashes or is force-killed.
5. **Graceful fallback**: if PresentMon fails to start (missing executable,
   permission denied), `gpu.fps` falls back to RTSS; the catalog shows which
   source is active.

**Consequences**:
- Requires Administrator rights or "Performance Log Users" group membership.
- RTSS remains the fallback for `gpu.fps` when PresentMon is absent or lacks
  permissions; `gpu.frametime`, `gpu.fps_low_1p`, `gpu.game` and `gpu.limiter`
  exist only through PresentMon.
- `HARDWARE_VALIDATED` in `fps/mod.rs` stays false until a real game has been
  measured on hardware.
