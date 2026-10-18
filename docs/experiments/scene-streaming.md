# Whole-scene H.264 experiment (Windows)

This is a development prototype, not a Studio preference or an enabled runtime
mode. The installed/running Studio is unchanged. No physical 50 fps result is
claimed for Bezel. Native serial and USB outputs continue using their existing
drivers unless an experimental caller explicitly requests the new capability.

## Reproduce without touching hardware

From the checkout, with an existing FFmpeg build containing libx264:

```powershell
cargo run --release -p bezel-media --example scene_stream_probe -- C:\ffmpeg\bin\ffmpeg.exe F:\Dev\bezel\dist\scene-stream-probe 8
```

The example never enumerates or opens a USB/serial device. It runs two independent
workers using the real Bezel renderer and Clarity themes with synthetic readings:

- Wide: requests H.264 at 50 fps, encodes the composed scene in native 480x1920
  orientation, and records the encoded pictures through a simulated decoder sink.
- Round: also requests H.264, but its simulated serial link has no such capability.
  It keeps native frame output, with a deliberate 65 ms I/O delay per frame.

Demo readings arrive at 1 Hz and are interpolated for display. Graphs use dense
visual histories. This demonstration interpolates the previous reading towards
the current one over one second, without using a future reading. These values
are not live system readings and no high-rate
sensor acquisition is implied. The production graph history/scheduler is not
changed by this experiment.

`report.json` contains the actual final mode, completed host frames, elapsed time,
render/output costs and any fallback error. These are **host/simulated-sink
measurements**, not device refresh measurements. `wide.h264` records the exact
ordered pictures returned by the persistent encoder. PNGs show the first/last
composed frame of each output.

For a landscape video preview, run this separately, outside the benchmark:

```powershell
ffmpeg -framerate 50 -i dist/scene-stream-probe/wide.h264 -vf transpose=2 -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p -movflags +faststart -y dist/scene-stream-probe/wide-preview.mp4
```

The raw elementary stream has no container timestamps; specify its input rate
when making a preview. The device path uses its own configured delivery clock.

The local 30-second mixed-output run on 2026-10-18 completed 1,496 wide H.264
pictures (49.87 host fps, 5.88 ms mean render and 7.61 ms encode/output) while the
deliberately delayed native output completed 449 frames (14.96 host fps). No
fallback occurred on the H.264 path. These results establish a software baseline
for this scene and machine, not performance on a physical USB panel or on every
theme. The encoded preview contains all 1,496 pictures at a declared 50 fps.

## Adapter design

`ScreenLink::encoded_scene()` is a per-link, read-only capability query. The
default is absent. Initially only the Turing USB 8.8 and 9.2 driver exposes it;
these remain experimental and are not marked hardware-validated by this work.
The 9.2 framebuffer is corrected to 480x1920; its bezel hides 18 columns rather
than removing them from the wire framebuffer.

`bezel_media::scene_output::SceneOutput` chooses the existing native transport
or a separate persistent encoder for that link. It belongs on the link's own I/O
worker, not on a shared renderer/UI loop. It rotates the frame before encoding,
keeps encoded dependent pictures ordered, stops the stream on failure, records
the reason and attempts native frame output afterwards. Only obsolete **raw**
frames may be skipped by a scheduler. The host must supply a fully composed,
opaque scene; device-video backgrounds need host composition before using H.264.

The encoder uses one x264 thread, Baseline/yuv420p, no B pictures, one slice per
picture and five-second keyframe intervals. An FFmpeg tee writes packet size
metadata before the corresponding Annex-B bytes. This permits exact picture
boundaries without relying on pipe chunk sizes or waiting for the next picture.
One frame may be outstanding; picture memory, queues and waits are bounded.
Drop terminates the child and joins its worker/metadata threads.

The driver requires the **actual existing standby clip filename** at startup.
It never supplies an empty name and never saves settings, uploads files, deletes
files or reboots the panel. It clears the PNG layer transparently, configures the
decoder, reads its picture limit, and sends complete pictures with commands 121
and 122. Queue pressure waits for depth <=1 with a bounded poll count. Streaming
reads 1024 bytes so a 512-byte response's USB ZLP is consumed without adding a
discard timeout after every picture. Stop attempts both command 123 and playback
rate restoration to 30 even if the first operation fails.

Protocol reference and measured hardware sequence:
[Libre Panel TURZX USB notes](https://github.com/syntensa/libre-panel/blob/b25337ea9395243b3cb6b36c7efd34f0d2964423/docs/protocol/turzx-usb.md).
The Rust implementation is original; this experiment does not import Python or
third-party artwork. Existing protocol credits remain applicable.

## Validation and remaining work

### Production native graphs (0.1.44)

Native graph scrolling is integrated independently of the experimental H.264
adapter. Line, area and bar histories scroll over the most recently observed
sample period, capped at their configured refresh/interval after a suspension.
The newest segment is interpolated at the right edge; gaps remain separate runs.
This uses up to one sample interval of visual delay and never predicts readings
or inserts synthetic history samples. Untimed thumbnails remain static.

Visible graph motion requests frames every 20 ms. A busy display skips automatic
motion renders until its presenter completes, while new sensor samples still
update the history and replace its pending frame. No encoder is started, and
there is no global frame rate tied to the slowest device. Actual frame rates
depend on scene rendering and native transfer cost. Card-face caching excludes
moving graphs; reduced-motion rendering shows the latest static graph.

### Physical native-path baseline (2026-10-18)

The connected CT88INCH Rev C 8.8 panel (COM6, firmware
`chs_88inch.dev1_rom1.90`) was tested using its existing serial driver, **not
H.264**. Studio was closed. The example captures the current runtime frame,
uses the existing cooperative Light handoff to acquire exclusive screen control,
restores the captured frame and releases control so Light resumes saved themes.
No theme, device storage, firmware or settings are changed.

```powershell
cargo run --release -p bezel-runtime --example device_scene_probe -- F:\Dev\bezel\target\release\bezel.exe COM6 F:\Dev\bezel\dist\scene-stream-probe\device-report.json
```

Each phase targets 50 updates/s for five seconds. Completed native transfers:

| Content | Transfers/s | Median present time |
| --- | ---: | ---: |
| Small 240x80 graph | 47.72 | 4.41 ms |
| Large 800x240 graph | 49.67 | 5.81 ms |
| Sparse graph across 1920x480 | 48.19 | 8.61 ms |
| All pixels changing at 1920x480 | 4.12 | 241.64 ms |

The first three phases mostly use partial updates; the last uses full frames.
The initial full transfer also reduces the small-graph average. These are host
transfer completion rates, not an optical measurement of panel refresh or a
benchmark of production themes. Both current screens resumed normal Light
present events after control was released. The restored-frame result and detailed
timings are in `dist/scene-stream-probe/device-report.json`.

This establishes useful headroom for native graph animation, but also a clear
full-scene bandwidth limit on this serial family. Production graph integration
is described above; USB H.264 remains physically unvalidated.

Unit tests cover opt-in, transparent clearing, bounded pictures, queue pressure,
timeout, no per-picture flush, rate restoration, capability isolation, packet
metadata (including FFmpeg side-data columns) and single-slice validation.

Explicit real-encoder tests, without hardware:

```powershell
$env:BEZEL_TEST_FFMPEG = 'C:\ffmpeg\bin\ffmpeg.exe'
cargo test -p bezel-media h264::tests::real_encoder_returns_decodable_individual_pictures -- --ignored --exact
cargo test -p bezel-media scene_output::tests::failed_stream_returns_to_native_for_only_its_own_link -- --ignored --exact
```

Before runtime/Studio integration: validate startup, display orientation, picture
acknowledgments, queue pacing and exit behavior on a compatible physical panel;
retain independent per-display scheduling; add actual measurements and an
explicit per-display experimental setting. The currently connected CT88INCH Rev C serial panel
does not expose the new USB H.264 input through its documented protocol.
