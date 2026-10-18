# Modern template pairs

Open these from Studio's **Themes** library. Included themes are read-only;
save a copy to make your own. Each collection has a **Wide** canvas (1920×480)
and a **Round** canvas (480×480, with important content inside the circular
safe area). Theme selection is filtered by the connected display's model.

| Collection | Design | Features |
| --- | --- | --- |
| Pulse / Gaming | Instrument cockpit, olive grid, lime load and orange thermal rings | Cut-corner CPU Card rotates between load and thermals every 12 seconds; calibrated GPU dial, smooth values, thermal array, warning colours and 90-second histories. Round becomes a matching instrument face. |
| Resonance / Music | Warm listening room, large artwork and a grooved vinyl disc | Standby/Playing Card follows media playback with a crossfade. Asymmetric album cover on Wide; circular cover on Round; live radial system-output spectrum surrounds the record, with a styled timeline and output volume on Wide. |
| Clarity / Monitor | Copper clock column, cream editorial telemetry and dark memory module | CPU/GPU histories, RAM dial and history, uptime. Round pairs a copper clock face with compact CPU/GPU meters. |

Graphs fill as readings arrive. Unavailable sensors show a dash. Music templates
use actual Windows media sessions and audio output; without music they show a
quiet spectrum and a waiting label. No demo data is stored in the themes.
The clock follows the system language. Template labels and names are editable.

To use a pair, create a profile in **Themes → Profiles and automation**, assign
the Wide template to the wide display and the Round template to the square or
round display, then choose its event rules. Configure the profile transition in
the same dialog. Instant, Fade, Slide and Flip are available from 150 to 3000 ms;
native device video changes immediately because its picture is not on the host.

All templates use Inter and JetBrains Mono included with Bezel. Their architectural
artwork is local SVG, with no external image downloads. Album artwork comes from
the actual media session. `python scripts/create-modern-themes.py` regenerates these six
bundled originals; it does not touch saved user copies.
