<p align="center">
  <img src="docs/images/pixel.svg" width="88" height="88" alt="Bezel Evo Pixel logo: a dotted letter B">
</p>
<h1 align="center">Bezel Evo</h1>
<p align="center">Make your USB smart screen your own.</p>
<p align="center">
  <a href="https://github.com/jripper77/bezel-evo/releases"><img src="https://img.shields.io/github/v/release/jripper77/bezel-evo?include_prereleases&amp;label=release&amp;color=FF9248" alt="Latest release, including previews"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/licence-GPL--3.0--or--later-FF9248" alt="Licence: GPL-3.0-or-later"></a>
  <a href="#download--install"><img src="https://img.shields.io/badge/Windows-10%20%2F%2011-121518" alt="Windows 10 and 11, x64"></a>
</p>

https://github.com/user-attachments/assets/92eaa3a0-b369-4ae0-96b4-934210d99f47

<p align="center"><sub>Bezel Evo on a Turing 8.8" screen: live sensors, weather and a Card that switches to the song playing.</sub></p>

![Bezel Evo Studio in dark mode: icon rail and widget library on the left, a portrait Ember dashboard on a dot-grid canvas with floating tool bars, and the inspector on the right with a live preview of the selected CPU ring and its Data and Look tabs](docs/images/studio-hero.png)

<p align="center"><sub>Studio in demo mode. Example layout and simulated sensor readings.</sub></p>

<details>
<summary>See the example on a screen</summary>

![Illustrative portrait USB screen showing the same Ember clock, CPU gauge, history graph, memory and now-playing widgets; not a product photograph](docs/images/screen-render.png)

</details>

## A new Studio

Studio has been redesigned from the ground up, in dark and light.

- **A calmer workspace.** An icon rail for Widgets, Sensors, Layers, Themes, Media
  and Screen; floating tool bars over a dot-grid canvas; library and properties
  panels you can resize. In English, Italian and Portuguese.
- **An inspector that shows what you change.** Every object gets a live preview
  of itself, drawn on its own at the top of the panel, and its settings split
  into **Data** and **Look** tabs.
- **One colour picker everywhere.** Colour area, hue, opacity, hex code and an
  eyedropper, plus **Theme colours** you save once and reuse, the colours already
  **used in this theme**, and recent ones.
- **A real font picker.** Search, filter Sans/Serif/Mono, each name written in its
  own font, a preview with the object's real text, and only the weights the font
  really has. Fonts come from three places: [included with Bezel, your own fonts
  folder, or packed inside the theme](docs/user/fonts.md).
- **Letter case without rewriting text.** Preserve the original, use upper or
  lowercase, or capitalize the first letter or every word, including live text.
- **Cards that are easy to follow.** A plain list of faces with **Edit** for each,
  a shared background under all of them, **one transition** for the whole Card
  (fade, slide or flip) and **timed triggers** ("every 30 s, the next face")
  next to the app and media triggers.
- **Values that glide.** Rings, bars, needles and numbers move smoothly to each
  new reading instead of jumping, without flooding the screen with frames.
- **Colour by value.** Turn a gauge, a graph, a text or an icon orange above 70
  and red above 90, with as many thresholds as you like.
- **A media player you compose.** Choose the parts (cover, title, artist, time,
  progress, app name) and style the progress bar: continuous, segments or dots,
  round or square ends, a knob, times at the sides or above.
- **An audio spectrum that follows the music.** Five styles: mirrored bars,
  bars rising from the bottom, LED blocks that light up like a level meter, a
  smooth line with a soft fill, and radial bars around a ring. Held peaks, gradients, colour by value and an
  amplitude multiplier come with every style. It listens to the app your Player
  follows or, if you choose, to everything the PC plays, only in memory, and
  can be turned off in Preferences (Windows 11).
- **A clear background chooser.** One card shows the background in use; **Change
  background…** offers a solid colour, a picture or video from this computer, or
  a video already stored on the screen, and nothing changes until you confirm.
- **Quick hands.** Mouse wheel zooms around the pointer, the middle button pans,
  double-clicking an object fits its frame to its content.
- **Status at a glance.** The sensor chip opens a popover with each piece of
  hardware and its last reading, with **Restart Libre** one click away; a memory
  chip shows how much Bezel uses, per process; **Preferences → Logs** opens the
  logs folder.

## Gallery

[![The five audio spectrum styles drawn by Bezel's screen renderer: mirrored bars, bars with a blue to purple gradient, green and yellow LED blocks, a line with a soft fill, and radial bars around a ring](docs/images/spectrum-styles.png)](docs/images/spectrum-styles.png)

| Colours from your theme | Fonts with their real weights |
| :---: | :---: |
| [![The CPU ring's Look tab with the colour picker open: colour area, hue and opacity bars, hex code, eyedropper, five saved theme colours and the colours used in the theme](docs/images/studio-color-picker.png)](docs/images/studio-color-picker.png) | [![The clock's font picker: search, Sans, Serif and Mono filters, sections In this theme, Included with Bezel, My fonts and System fonts, and a preview of 12:00](docs/images/studio-font-picker.png)](docs/images/studio-font-picker.png) |
| **Card faces and one transition** | **A media player you compose** |
| [![A Card selected: its two faces in a list with Edit buttons, the shared background row and a slide transition of 650 ms](docs/images/studio-card-faces.png)](docs/images/studio-card-faces.png) | [![The media player's What to show tiles and its progress bar options: fill, track, thickness, round ends, knob, segments and times at the sides](docs/images/studio-player.png)](docs/images/studio-player.png) |
| **Change the background** | **Sensor status** |
| [![The Change background panel with three sources: solid colour in use, from this computer opened with Choose a file, and video from the screen](docs/images/studio-background.png)](docs/images/studio-background.png) | [![Sensors panel with live sparklines and the sensor status popover listing each piece of hardware, one of them missing, with Restart Libre](docs/images/studio-sensors.png)](docs/images/studio-sensors.png) |
| **Light theme** | **On the screen** |
| [![Studio in its light theme: Layers with a Card's faces and the CPU ring's colour-by-value thresholds at 70 and 90](docs/images/studio-light.png)](docs/images/studio-light.png) | [![Illustrative portrait USB screen showing the Ember example; not a product photograph](docs/images/screen-render.png)](docs/images/screen-render.png) |

## Light keeps everything running

**Display profiles** switch the complete configuration from the Studio or Light
tray. Manage them from **Themes → Profiles and automation**: each profile, such
as Gaming or Music, assigns a saved theme to each display. A single selection
applies the profile across your screens. Add rules for an app running, an app in
the foreground or media playing.
Priorities resolve simultaneous rules; a return delay avoids brief switches.
Manual selection stays in effect until you choose Automatic again. Profiles
pause on the display being edited and resume when Studio is hidden.
The selected theme names are shown for each display and in the return choice.
Choose None, Fade, Slide or Flip, with direction and duration, for changes between
profiles and the return to the selected themes. Displays keep their own pace;
video played directly by a device switches immediately.

The included theme library also offers three coordinated pairs for 1920×480 and
480×480 displays: **Pulse / Gaming**, **Resonance / Music** and **Clarity / Monitor**.
They demonstrate rotating Cards, smooth sensor values, colour thresholds, history
graphs, the media player and live system-audio spectra. Open one from **Themes**
and save a copy to customise it. See [the template guide](themes/README.md).

Six additional animated **Kinetic** templates explore graphic motion design:
**Synapse** (orbital signals and telemetry), **Prism** (a moving geometric knot
and poster typography) and **Morph** (a live sound sculpture). Each has Wide
and Round layouts, local animation loops and native live widgets, with no
photographic backgrounds.

**Bezel Light** is the small tray program that owns your screens. It runs the
themes, reads the sensors, keeps the graph history and clocks, plays the
transitions and decodes background videos, all in one place. Studio is the
editor: while it is open, its canvas shows the very picture Light sends to the
screen.

So opening and closing Studio is seamless: **no redraw, graphs keep their
history, a video keeps playing, the picture stays fluid.** Close Studio without
saving and the screen goes back to the saved theme, still without starting
over. Studio talks to Light over a local channel that only your Windows user
can open; if Light cannot run, Studio drives the screens itself.

## And everything else

- **See your PC's stats.** CPU, GPU, memory, disks, network, fans and power, with
  a bundled hardware sensor reader instead of a separate monitoring app to keep
  open. A value that cannot be read shows why; Bezel never makes one up.
- **Go beyond gauges.** Clocks and dates, weather, now-playing, history graphs
  with their own time window, offline icons, images, animated GIFs and video
  backgrounds.
- **Run multiple screens.** Give each display its own theme and orientation;
  Light drives them together with one sensor reader.
- **Manage the screen's storage.** Send, move, rename and clean up the pictures
  and videos stored on screens that keep them, and choose what they show when the
  PC shuts down.
- **Start from a theme.** Use bundled layouts, import vendor and
  turing-smart-screen-python themes, or save your own as a `.bezeltheme` file.

## Download & install

1. **[Open Releases](https://github.com/jripper77/bezel-evo/releases)** and download the Windows x64 **Setup** or **portable ZIP**.
2. Close the screen's vendor app. Run Setup, or extract the ZIP into a writable folder. Setup offers optional hardware sensors and Light at sign-in.
3. Open **Studio**, select your screen, choose a theme, customise it and **Save**. Turn on **Live** to send it to the display.

**Platform:** Bezel Evo supports **Windows only**.

**Requirements:** Windows 10/11 x64, a compatible USB smart screen and Microsoft Edge WebView2. Setup can download WebView2; portable Studio needs it already installed. Hardware sensors use .NET Framework 4.7.2 or newer; availability depends on your hardware and drivers. FFmpeg is separate for video conversion.

The Setup and the programs are not code-signed, so Windows SmartScreen may warn the first time: choose **More info → Run anyway**. See the [installation guide](docs/user/install.md) for sensor setup and updates.

## Supported screens

| Screen / family | Status |
| --- | --- |
| Turing Smart Screen 8.8" Rev C, ROM 1.90 | **Tested on hardware** |
| Other Turing Rev C models; Turing 3.5" / UsbPCMonitor 3.5" and 5" Rev A | Supported |
| XuanFang 3.5" / Flagship, Rev B | Supported |
| Kipye Qiye 3.5", Rev D | Supported |
| WeAct Studio Display FS 3.5" / 0.96" | Supported |
| TURZX / Turing USB generation, 1.6"-12.3" | Supported |
| WCH-based panels, 2.4"-4.3" | Supported |

"Supported" means a driver is implemented, not that every model or firmware has been physically tested. Check the [screen guide](docs/user/devices.md) and [full model catalogue](docs/reverse-engineering/devices.md) before choosing a display.

## Documentation

- [User guide](docs/user/README.md) / [Your first theme](docs/user/first-theme.md) / [Editing in Studio](docs/user/studio-editing.md) / [Fonts](docs/user/fonts.md)
- [Sensors](docs/user/sensors.md) / [Storage and video](docs/user/storage-and-video.md) / [Troubleshooting and logs](docs/user/troubleshooting.md)
- [What's new](CHANGELOG.md) / [Technical documentation](docs/) / [Windows builds](docs/build-windows.md) / [Fork changes and validation](FORK.md)

## Support

Bezel Evo is free and open source. If it is useful to you, you can support its development on Ko-fi.

<a href="https://ko-fi.com/jripper"><img src="https://img.shields.io/badge/Ko--fi-support%20Bezel%20Evo-FF9248?logo=kofi&amp;logoColor=white" alt="Support Bezel Evo on Ko-fi"></a>

## Credits & licence

© 2026 [jripper77](https://github.com/jripper77). Bezel Evo is a **fork of [slipalison/bezel](https://github.com/slipalison/bezel)**, created by [Alison Amorim (@slipalison)](https://github.com/slipalison); original authorship, research and copyright notices are preserved (see [NOTICE](NOTICE)).

Licensed under **[GPL-3.0-or-later](LICENSE)**. See [third-party credits and licences](THIRD_PARTY.md) for LibreHardwareMonitorLib, Tabler, Material Design Icons, IBM Plex, Inter, JetBrains Mono and weather-data attribution.
