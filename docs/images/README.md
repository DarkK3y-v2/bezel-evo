# README images

All screenshots come from Studio's browser demo, with no Tauri backend, connected
hardware, personal files or local settings. They show the example Ember layout,
assembled from Studio's existing text, clock, ring, graph, shape and bar widgets.
This is a custom example, not a claim that Ember is a bundled theme. Demo rendering
is approximate and sensor values are simulated; they are not measurements.

| Asset | Source |
| --- | --- |
| `pixel.svg` | Unmodified copy of `apps/bezel-studio/src/icon.svg`, the existing Pixel mark |
| `studio-hero.png` | Dark Studio, widget library and example document |
| `studio-library.png` | Dark Studio, Sensors panel |
| `studio-inspector.png` | Dark Studio, selected CPU ring and properties |
| `studio-card-triggers.png` | Dark Studio, a two-face Card and media trigger created through normal editor actions |
| `studio-light.png` | Light Studio, same example document |
| `screen-render.png` | Generic illustrative device, composed with HTML/CSS around the exact demo canvas frame; not a product photograph or hardware validation |

Capture at 1440 x 900 (Studio) and 1200 x 900 (device illustration), English UI,
UTC, dark/light system theme, with a fixed demo clock. The only device shown is
the demo's Turing Smart Screen 8.8"; addresses in the UI are the demo fixtures, shown as Windows ports (COM5, COM4) by the capture script.
The device illustration uses the brand palette and bundled IBM Plex Sans.

From the repository root:

```powershell
npm --prefix apps/bezel-studio ci
node docs/images/capture.mjs
```

The capture script starts its own local server, loads only `?demo=turing88`,
provides the example document in memory, takes screenshots, then closes the
browser and server. It does not modify application source or real themes.

PNGs are RGB and losslessly recompressed with Pillow (`optimize=True`,
`compress_level=9`). To repeat that optimization after capture:

```powershell
python -c "from pathlib import Path; from PIL import Image; [(lambda p: Image.open(p).convert('RGB').save(p, optimize=True, compress_level=9))(p) for p in Path('docs/images').glob('*.png')]"
```

The images share the project's [GPL-3.0-or-later licence](../../LICENSE).
Component notices remain in [THIRD_PARTY.md](../../THIRD_PARTY.md).
