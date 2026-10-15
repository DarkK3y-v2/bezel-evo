# Live animation diagnostics

In Studio Preferences, enable **Debug** to write app, sensor and device diagnostics
into `debug.log` beside `settings.json` (the full path appears in Preferences).
**Show readings on screen**, nested under Debug, adds a temporary overlay to the
physical Live display. Choose any of the four corners with **Screen corner**. Turning Debug off stops file logging and hides the overlay;
the theme file is unchanged. Logs keep one previous 5 MiB segment and exclude
network-client targets.

Preview and Live reuse recent identical scene frames within one animation interval
(excluding video backgrounds). Debug logs record reuse, preview/editor-lock times
and refresh-loop preparation times to help distinguish rendering from transfer costs.

`SEND FPS` measures successful host transfer completion during animation bursts,
not the panel's internal scanout. `GAP` is the interval between completions;
`RENDER` measures theme rendering and `PRESENT` the complete driver operation.
`handoff_ms` in the logs measures the delay from a prepared frame to its driver
starting; stopped/replaced connections reject completions from older generations.
For Rev C, `C` is rotation/BGRA conversion, `D` difference encoding, `W` serial
write/drain, `A` reply wait, and `KB` the framed bytes sent. `S` shows sensor
sampling time / configured sampling interval in milliseconds. Other drivers show
unavailable transfer phases as `N/A`. FPS requires at least two transfers and
resets after a pause over 300 ms. The overlay uses the previous measurements and
updates at most four times per second; `animating` in the logs identifies active card transitions; it adds some changed pixels, so compare
with logging enabled and the overlay disabled for the final timing capture.
