# Game FPS

[Português (Brasil)](pt-BR/fps.md)

The `gpu.fps` sensor (*Game frame rate*) shows the frame rate of the game you are
playing. Bezel does not hook into games: it reads what RivaTuner Statistics
Server, a frame-rate tool you may already run, publishes. Drag the sensor onto a theme like any other.

> The FPS reader follows RTSS's published format, but has not yet been checked
> against a running game (not validated on hardware). If the value
> looks wrong, please report it.

## RivaTuner Statistics Server

1. Install RivaTuner Statistics Server (RTSS). It comes with MSI Afterburner, or
   on its own.
2. Start RTSS and leave it running (it can sit in the tray).
3. Start the game. Bezel shows the frame rate of the game RTSS measured last.

While RTSS is not running the sensor is unavailable and says so ("RivaTuner
Statistics Server is not running: start it ...").

## What you see

- A number while the game runs. A 0 reported by the tool is shown as 0.
- `—` when RTSS is not measuring a game, or when the last value is older than
  3 seconds (game paused, minimized or closed). Bezel never keeps showing an old
  value.
