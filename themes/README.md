# Modern template pairs

Open these from Studio's **Themes** library. Included themes are read-only;
save a copy to make your own. Each collection has a **Wide** canvas (1920×480)
and a **Round** canvas (480×480, with important content inside the circular
safe area). Theme selection is filtered by the connected display's model.

| Collection | Design | Features |
| --- | --- | --- |
| Pulse / Gaming | Dark ink, lime accents, large telemetry | CPU/GPU Cards rotate between load and thermals every 12 seconds, slide transitions, 90-second graphs, smooth readings, warning colours and an arc-gradient GPU gauge on Round |
| Resonance / Music | Plum surfaces and lavender accents | Media session title/artist, asymmetric cover corners on Wide, styled timeline with side times, live system-output spectrum (blocks on Wide, bars on Round), volume on Wide |
| Clarity / Monitor | Light mineral surfaces and green ink | Large clock, localised date, CPU/GPU/RAM graphs and uptime on Wide, compact CPU history on Round |

Graphs fill as readings arrive. Unavailable sensors show a dash. Music templates
use actual Windows media sessions and audio output; without music they show a
quiet spectrum and the collection name. No demo data is stored in the themes.
The clock follows the system language. Template labels and names are editable.

To use a pair, create a profile in **Themes → Profiles and automation**, assign
the Wide template to the wide display and the Round template to the square or
round display, then choose its event rules. Configure the profile transition in
the same dialog. Instant, Fade, Slide and Flip are available from 150 to 3000 ms;
native device video changes immediately because its picture is not on the host.

All templates use the fonts included with Bezel and need no external image
downloads. `python scripts/create-modern-themes.py` regenerates these six
bundled originals; it does not touch saved user copies.
