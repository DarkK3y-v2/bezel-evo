# Game FPS

[Português (Brasil)](pt-BR/fps.md)

The `gpu.fps` sensor (*Game frame rate*) shows the frame rate of the game you are
playing. Bezel does not hook into games: it reads what a frame-rate tool you
already run publishes. Drag the sensor onto a theme like any other.

> The FPS readers follow the published formats of these tools, but have not yet
> been checked against a running game (not validated on hardware). If the value
> looks wrong, please report it.

## Windows: Intel PresentMon (Preferred)

Bezel can read frame metrics directly from Intel PresentMon's console
application. It starts PresentMon on demand only while a game is running and
a theme requests the sensors, and stops it about 60 seconds after the last
frame. It is never installed as a service.

1. Download the Intel PresentMon console application (v2.6.0 or newer).
2. Place `PresentMon.exe` in one of these locations (checked in order):
   - A `tools/` folder next to the Bezel executable.
   - `C:\Program Files\Intel\PresentMon\PresentMon.exe`.
   - Anywhere in your system `PATH`.
3. **Administrator rights required**: PresentMon reads ETW events. Run Bezel
   as Administrator, or add your user to the "Performance Log Users" group. If
   the rights are missing, the sensors read as unavailable with a message
   explaining the fix.
4. Start the game. Bezel automatically starts PresentMon, excludes
   compositor and overlay processes (like `dwm.exe`, `explorer.exe`,
   `discord.exe`), and shows `gpu.fps`, `gpu.frametime`, `gpu.fps_low_1p`,
   `gpu.game` and `gpu.limiter`.

If PresentMon is not found or fails to start, `gpu.fps` falls back to
RivaTuner Statistics Server (RTSS) exactly as before, and the catalog says
which source is active.

## Windows: RivaTuner Statistics Server (Fallback)

1. Install RivaTuner Statistics Server (RTSS). It comes with MSI Afterburner, or
   on its own.
2. Start RTSS and leave it running (it can sit in the tray).
3. Start the game. Bezel shows the frame rate of the game RTSS measured last.

While RTSS is not running the sensor is unavailable and says so ("RivaTuner
Statistics Server is not running: start it ...").

## Linux: MangoHud logs

Bezel reads the newest CSV log that MangoHud writes while it logs a game.

1. Run the game with MangoHud: `mangohud ./game`, or in Steam set the launch
   options to `mangohud %command%`.
2. Start logging in the game with **Shift_L+F2** (MangoHud's default key), or
   make it start by itself: add `autostart_log=1` to
   `~/.config/MangoHud/MangoHud.conf`.

Bezel looks for the logs in MangoHud's `output_folder` (set in `MangoHud.conf`),
or in your home folder when it is not set. If you keep them somewhere else,
point Bezel at that folder: **Preferences → Sensors → MangoHud log folder** in
the app, or `--mangohud-dir` on the command line:

```bash
bezel run turing-8.8-horizontal --mangohud-dir ~/mangohud-logs
```

MangoHud writes a new file for each logging session; delete old ones from time
to time.

## What you see

- A number while the game runs. A 0 reported by the tool is shown as 0.
- `—` when no tool is measuring a game, or when the last value is older than
  3 seconds (game paused, minimized or closed). Bezel never keeps showing an old
  value.
