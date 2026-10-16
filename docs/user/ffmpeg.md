# Installing ffmpeg

[Português (Brasil)](pt-BR/ffmpeg.md)

Bezel uses [ffmpeg](https://ffmpeg.org) to convert videos to the screen's
format, and to play a theme's video background on screens that cannot play
videos themselves. ffmpeg is not included with Bezel. It must have the H.264
encoder `libx264`.

Without ffmpeg, pictures and videos already in the screen's format are still
sent; Bezel tells you when a video needs converting.

## Install it

```powershell
winget install --id Gyan.FFmpeg -e
```

Then close and reopen Studio, quit and restart Light (and any terminal), so they
see the new `PATH`.

## Check it

```powershell
ffmpeg -hide_banner -encoders | Select-String libx264
```

A line with `libx264` means it is ready.

## An ffmpeg that is not on the PATH

- In Studio: **Screen → Storage → Locate ffmpeg…** (it appears when Bezel
  cannot find one).
- On the command line: `--ffmpeg PATH`, the program or its folder:

```powershell
bezel storage put clip.mp4 --ffmpeg C:\Tools\ffmpeg\bin\ffmpeg.exe
```
