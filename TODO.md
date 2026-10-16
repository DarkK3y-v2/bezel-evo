# Bezel Evo — TODO

Checked items are implemented; unchecked items are design notes for future work.

## Quick states from the Light tray

- [ ] Let users define named states such as Default, Work, Gaming and Music.
- [ ] Select a state directly from the tray icon menu without opening Studio.
- [ ] Associate each state with a saved theme/template, optionally a different
      theme for each screen. Mark the active state in the menu.
- [ ] Animate state/theme switches with a configurable transition (fade, slide
      or flip), duration and direction. Apply transitions to both manual tray
      selections and automatic triggers; preview them in Studio. Handle rapid
      selections, unavailable displays and unsupported effects gracefully.
- [ ] Define whether the selected state is temporary or restored at next startup.
- [ ] Provide a return to Default/Automatic and define how a manual selection
      interacts with automatic triggers, including priority and override duration.
- [ ] Configure states in Studio and switch them safely in Light, preserving
      display ownership and reporting missing themes or unavailable screens.

## Ordinary object groups and selection

- [x] Group/ungroup selected objects independently from card faces.
- [x] Move, resize, duplicate and copy whole groups, with nested members and Undo.
- [x] Show group containers and indented members in Layers; edit members individually.
- [x] Select objects with a mouse rectangle and move objects outside the canvas.

- [x] Restore canvas keyboard focus and support Ctrl+X/Ctrl+V with reversible cut/paste.
- [x] Add accessible object context menus and drag objects across group/card containers.
- [x] Distinguish foldable containers, indented faces, empty drop zones and root placement.
- [x] Configure shared or independent shape corners and player cover radius/text spacing.

## Card widget with a base and multiple faces

Faces, one transition per card, timed face changes and Windows application/media
state rules are implemented. Cards move and resize their objects together,
including inactive faces. Objects retain their own appearance settings and are
not clipped to the card bounds. Entry/exit animations and sensor-threshold
triggers below remain planned.

- [x] Create a dedicated Card container with a shared base and one initial face.
- [x] Add, duplicate, rename and reorder faces in a simple vertical list; edit the
      shared background ("common background") or a selected face, shown and labelled on the canvas.
- [x] Group text, indicators, icons, images and shapes within each face.
- [x] Create a card from selected objects; preserve layers, Undo and clipboard.
- [x] Configure the card's face transition: none, fade, slide and flip, with
      duration, direction and smooth acceleration/deceleration (one transition per card).
- [ ] Configure entry and exit animations independently.
- [x] Choose whether the shared base participates in the transition.
- [x] Add editor controls to animate the next face. Respect reduced motion in the preview.
- [x] Timed face changes as a trigger ("every N s → next face | face X"); themes
      that used the old automatic rotation are migrated.
- [x] Event-driven face selection with rule priority and return delay.
- [ ] Sensor-threshold face triggers with minimum display time and hysteresis.
- [x] Measure host frame-delivery rate, rendering and serial costs on the real
      8.8-inch screen; keep panel refresh distinct from host completion.
- [x] Deliver independent per-display Studio workers; keep face caching optional after measurement.
- [x] Validate the 0.1.6 face cache on the user's device-video theme; compare cache
      hits, face drawing/composition times, delivery cadence and long intervals.
      Default restored to direct face drawing in 0.1.8: caching did not improve
      overall delivery cadence and increased rendering variability.

## Software and media triggers

- [x] Trigger a card face while a specified application is running or closed (tray states remain planned).
- [x] Distinguish an application being open from media actively playing.
- [x] Investigate Windows media-session access for Spotify: playback state,
      title, artist and cover art, including whether additional authorization is
      needed and which fields are reliably available. Windows exposes sessions
      without OAuth; track fields/cover/timeline depend on the publishing app.
- [x] Show a configured Music/player face while a matching media session plays;
      after a configurable pause/stop delay, return to the previous or explicitly chosen card face.
      Spotify is supported when it publishes a Windows media session.
- [ ] Resolve simultaneous triggers and manual tray overrides predictably.

The existing themes remain usable without cards, states or automatic triggers.


## Existing features: corrections and extensions

- [x] Layers: show each card face as a container, with its objects indented below
      it. Show the shared base separately; keep selection, visibility, ordering
      and card membership understandable when switching faces.
- [x] Card timers: change faces on a timed trigger, using the card's transition.
      Pause while editing a card/member in Studio; keep runtime playback outside
      saved themes and Undo.
- [x] Coordinate timers with event priorities, explicit overrides and return
      behavior when software/media triggers are introduced.
- [x] Software events: assess process start/stop, foreground application and media
      session events before choosing supported triggers. Implement only sources
      that are available reliably and without per-frame polling.
- [x] Media-player widgets: show title, artist, cover and playback state; evaluate
      progress using Windows media sessions (no playback controls in this release). Support Spotify
      where its session exposes data; define behavior for multiple sessions and
      absent/stopped media.
- [x] Images: add linear and radial opacity gradients, matching shape controls;
      apply opacity to the image contents and retain image framing/fit behavior.
- [x] Shapes: add radial opacity gradients alongside existing linear opacity,
      with editable center, extent and start/end opacity.
- [x] Screen sleep timer: configure minutes per display, default 5 minutes.
      Expose device capabilities and supported limits, a disabled state and
      persistence. Define any host fallback explicitly; do not assume all panels
      have the same firmware sleep command.
- [x] Weather: add colored and 3D-style icon collections selectable per widget.
      Choose redistributable free assets, bundle licenses/credits and preserve
      existing monochrome styles and condition mappings.

## Redesigned Studio

- [x] Redesigned shell with resizable, persisted panels (Library, Inspector) and
      dark/light themes.
- [x] Inspector with an isolated live preview of the selected object, drawn by the
      same renderer as the screen.
- [x] Smooth value transitions for rings, bars, needles and counting values,
      per object, with a frame-rate cap and reduced-motion support.
- [x] Colour by value: stepped thresholds for text, fill, needle/line and shape/icon colours.
- [x] Double-click a frame to fit it to its drawn content (text, value, clock,
      image, icon, weather, player), as one Undo step.
- [x] Canvas zoom with the mouse wheel and touchpad pinch, centred on the cursor.
- [x] Graph window written as a sentence ("show the last N …, one point every N …")
      with a time ruler, independent of the theme refresh.
- [x] One corner-radius control with a four-corner drawing everywhere objects have corners.
- [x] Theme background card (colour, from the PC, from the screen) with a chooser
      that changes nothing until confirmed.
- [x] Composable media player: cover, title, artist, time, app name and a styled
      progress bar can each be shown or hidden.
- [x] Shared font picker (search, categories, real weights, missing-font warning)
      and colour picker (theme colours, used colours, recents, eyedropper where available).
- [x] Bundled fonts (Inter, JetBrains Mono) always available to Studio and Light.
- [ ] User font folder ("My fonts") and fonts embedded in a theme, with a licence notice.
- [x] Memory chip in the status bar with the total for Studio, WebView2, Light and
      the sensor reader; Light's tray menu shows it too.

## Light and the screens

- [x] Light always owns the screens and runs the only theme engine; Studio edits a
      draft and shows the image Light renders. Opening and closing Studio keeps the
      screen, graphs, clocks and on-screen video running without a redraw.
- [x] Closing Studio without saving returns the screen to the saved theme without
      resetting graph history or clocks; Studio falls back to a direct connection
      only if Light cannot run.
- [x] Shared diagnostic logs (Preferences → debug, "Open log folder").
- [ ] Installer with a clean install that replaces the old portable folder.
- [ ] Audio spectrum widget (Windows loopback levels only, nothing recorded).

## UX: first interface cleanup

- [x] Drag Layers rows to reorder objects with insertion markers and Undo;
      keep card membership and move entire cards with their objects.
- [x] Clear object selection by clicking the space around the canvas.

- [x] Review the editor's main navigation and remove duplicated or misplaced
      controls while preserving existing workflows.
- [x] Group object properties by purpose with a consistent order: content/data,
      appearance, position/size, card membership and animation where applicable.
      Make common controls easy to find and show advanced controls in context.
- [x] Align labels, units, spacing and disabled states across widget types;
      validate the result in both small and large editor windows.

## New ideas

- [ ] Calculated variables: named expressions combining available sensor values
      and other variables, selectable as widget data sources. Define units,
      missing values, division by zero, dependency cycles and evaluation cadence.
      Preview the expression result and report errors in the editor; keep the
      same evaluation rules in Studio and Light.
- [ ] PC-idle screensaver: after configurable keyboard/mouse inactivity, switch
      displays to a selected screensaver theme or media, then restore their
      previous state on activity. Keep this policy distinct from the screen's
      sleep timer and from Windows standby; handle multiple displays and Light.

Continue with the unchecked items above. Application/media rules and their
capabilities are documented in FORK.md; not every application publishes playback
metadata, artwork or a timeline.
