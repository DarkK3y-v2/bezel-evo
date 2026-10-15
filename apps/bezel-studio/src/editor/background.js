// The theme's background as the Media panel and the inspector set it: a
// video (or an animated GIF) with its poster, or a picture. Pure functions
// over the backend's answers (`list_assets`, `add_media`) and the screen.

/** Videos a background takes (the backend's list). */
export const VIDEO_EXTENSIONS = Object.freeze(['mp4', 'mov', 'm4v', 'mkv', 'webm', 'avi']);
/** Pictures the renderer draws (a GIF may also move). */
export const IMAGE_EXTENSIONS = Object.freeze(['png', 'jpg', 'jpeg', 'gif', 'svg']);

/** The lowercase extension of a file name or path (`''` without one). */
export function extensionOf(name) {
  const base = String(name ?? '').split(/[\\/]/).pop();
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
}

/** Whether a file dropped on the window can be added: a video, a GIF or a picture. */
export function droppable(name) {
  const extension = extensionOf(name);
  return VIDEO_EXTENSIONS.includes(extension) || IMAGE_EXTENSIONS.includes(extension);
}

/** The file name of an asset reference or a path. */
export function fileNameOf(ref) {
  return String(ref ?? '').split(/[\\/]/).pop();
}

/** Whether an asset (or an `add_media` answer) moves: a video, or an animated GIF. */
export function moves(asset) {
  return asset?.kind === 'video' || Boolean(asset?.animated);
}

/**
 * The background an asset (or an `add_media` answer) makes: a video with its
 * poster when it moves, else the picture covering the canvas.
 */
export function backgroundOf(asset) {
  if (!moves(asset)) return { type: 'image', asset: asset.ref, fit: 'cover' };
  return asset.poster ? { type: 'video', asset: asset.ref, poster: asset.poster } : { type: 'video', asset: asset.ref };
}

/**
 * The Media panel's items: pictures and videos, without the posters of the
 * videos listed (each shows as its video's thumbnail).
 */
export function mediaItems(assets) {
  const posters = new Set(assets.filter((a) => moves(a) && a.poster).map((a) => a.poster));
  return assets.filter((a) => (a.kind === 'image' || a.kind === 'video') && !posters.has(a.ref));
}

/** A play time as a clock: `0:07`, `1:05`, `1:02:03`; `null` when unknown. */
export function formatDuration(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return null;
  const total = Math.round(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

/** Play time and size of a video, as known: `['0:12', '18.9 MB']`. */
export function videoFacts(asset, bytes) {
  return [formatDuration(asset?.durationMs), typeof asset?.bytes === 'number' ? bytes(asset.bytes) : null].filter(Boolean);
}

/** Whether every model a screen may be stores and plays videos itself. */
export function playsVideos(screen) {
  const models = screen?.models ?? [];
  return models.length > 0 && models.every((m) => Boolean(m.capabilities?.storage && m.capabilities?.videoPlayback));
}

/**
 * What the inspector says about the theme's video and the connected screen:
 * - `noScreen`: no screen connected;
 * - a screen that plays stored videos: `checkWhenLive` (not live: live mode
 *   looks for the video), `checking`, `stored`, or `missing` (the storage
 *   tab sends it);
 * - a screen that cannot: `host` (live mode decodes it on this computer),
 *   `hostPlaying` (it does now) or `hostNoConverter` (no ffmpeg).
 * @param {{screen: object|null, live: boolean, liveVideo: {state: string}|null}} context
 */
export function videoStatus({ screen, live, liveVideo }) {
  if (!screen) return 'noScreen';
  const state = live ? liveVideo?.state ?? null : null;
  if (!playsVideos(screen)) {
    if (state === 'host') return 'hostPlaying';
    return state === 'noConverter' ? 'hostNoConverter' : 'host';
  }
  if (!live) return 'checkWhenLive';
  if (state === 'onDevice') return 'stored';
  return state === 'missing' ? 'missing' : 'checking';
}

// ------------------------------------------------- the background in use --
// The theme has one background (D-2026-10-16-studio-redesign-fidelity-25):
// the inspector shows it as one card (its kind, file, what it means and
// where it is) with only that kind's options, and changes it in a chooser
// that sets nothing until confirmed.

/** The colour a solid background starts from when the theme names none. */
export const DEFAULT_BACKGROUND_COLOR = '#0c0e16ff';

/** Where a background can come from, in the chooser's order. */
export const BACKGROUND_SOURCES = Object.freeze(['color', 'computer', 'screen']);

/** What a background is: `color`, `image`, `video` (from the computer) or `deviceVideo` (stored on the screen). */
export function backgroundKind(bg) {
  return ['image', 'video', 'deviceVideo'].includes(bg?.type) ? bg.type : 'color';
}

/** Where a background comes from: `color`, `computer` (a picture or video in the theme) or `screen`. */
export function backgroundSource(bg) {
  const kind = backgroundKind(bg);
  if (kind === 'deviceVideo') return 'screen';
  return kind === 'color' ? 'color' : 'computer';
}

/** The options under the card, by kind: only what the kind in use has. */
const OPTIONS = Object.freeze({
  color: Object.freeze(['color']),
  image: Object.freeze(['fit']),
  video: Object.freeze(['videoStatus', 'framing']),
  deviceVideo: Object.freeze(['loop', 'windows', 'storage']),
});

/** The options the inspector shows under the background's card. */
export function backgroundOptions(bg) {
  return OPTIONS[backgroundKind(bg)];
}

/** `#rrggbbaa` as the card names it: `#0C0E16`, with the opacity when not opaque (`#0C0E16 · 50%`). */
export function colorName(hex) {
  const value = String(hex ?? '');
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value)) return value;
  const rgb = value.slice(0, 7).toUpperCase();
  const alpha = value.length === 9 ? Math.round((parseInt(value.slice(7), 16) / 255) * 100) : 100;
  return alpha === 100 ? rgb : `${rgb} · ${alpha}%`;
}

/** What names a background: its file, or its colour. */
export function backgroundName(bg) {
  const kind = backgroundKind(bg);
  if (kind === 'deviceVideo') return fileNameOf(bg.path);
  return kind === 'color' ? colorName(bg?.color ?? DEFAULT_BACKGROUND_COLOR) : fileNameOf(bg.asset);
}

/** Fill and Fit for a picture, and the theme's own fit too when it is another (nothing saved is lost). */
export function imageFits(fit) {
  const fits = ['cover', 'contain'];
  return fit && !fits.includes(fit) ? [...fits, fit] : fits;
}

/** The ids of the theme's shapes that are video windows (they show the screen's video). */
export function videoWindowIds(theme) {
  return (theme?.elements ?? []).filter((e) => e.kind?.type === 'shape' && e.kind.videoWindow).map((e) => e.id);
}

/** The videos a screen stores, from the storage manager's overview (`manager_overview`). */
export function screenVideos(overview) {
  return (overview?.files ?? []).filter((f) => f.kind === 'video');
}

/** Whether the screen stores `path`: `null` while its files are not known. */
export function storedOnScreen(overview, path) {
  if (!overview) return null;
  return (overview.files ?? []).some((f) => f.path === path);
}

/** The catalogued local copy of `path` that Bezel can send again, or `null`. */
export function localCopyOf(overview, path) {
  return (overview?.restorable ?? []).find((r) => r.path === path && r.localCopy) ?? null;
}

/** Where a video sent from the chooser goes: the card when there is one. */
export function uploadMedium(overview) {
  return overview?.card ? 'sd' : 'internal';
}

/** The medium of a stored path (`sd/video/x.mp4` → `sd`). */
export function mediumOf(path) {
  return String(path ?? '').split('/')[0];
}

/** The status line of a video from the computer, for each `videoStatus`. */
const VIDEO_STATUS = Object.freeze({
  noScreen: Object.freeze({ tone: 'muted', key: 'screen.none' }),
  checkWhenLive: Object.freeze({ tone: 'warn', key: 'insp.bgToCopy' }),
  checking: Object.freeze({ tone: 'muted', key: 'inspector.video.checking' }),
  stored: Object.freeze({ tone: 'ok', key: 'insp.bgOnScreen' }),
  missing: Object.freeze({ tone: 'error', key: 'insp.bgNotOnScreen' }),
  host: Object.freeze({ tone: 'info', key: 'insp.bgHostDecodes' }),
  hostPlaying: Object.freeze({ tone: 'info', key: 'insp.bgHostDecodes' }),
  hostNoConverter: Object.freeze({ tone: 'warn', key: 'insp.bgPosterOnly' }),
});

/**
 * The card's status line for a background, or `null` when its kind has
 * none (a colour or a picture: drawn by this computer). `tone` is `ok`,
 * `warn`, `error`, `info` or `muted`; `key` is the text to show.
 * @param {object} bg the theme's background
 * @param {{screen: object|null, live: boolean, liveVideo: {state: string}|null, stored?: boolean|null}} context
 *   `stored`: whether the screen holds a stored video (`storedOnScreen`)
 * @returns {{tone: string, key: string}|null}
 */
export function backgroundStatus(bg, context) {
  const kind = backgroundKind(bg);
  if (kind === 'video') return VIDEO_STATUS[videoStatus(context)];
  if (kind !== 'deviceVideo') return null;
  const { screen, live, liveVideo, stored = null } = context;
  if (!screen) return { tone: 'muted', key: 'screen.none' };
  const state = live ? liveVideo?.state ?? null : null;
  if (!playsVideos(screen) || state === 'noPlayback') return { tone: 'error', key: 'deviceVideo.unsupported' };
  if (state === 'storedMissing' || (state !== 'onDevice' && stored === false)) return { tone: 'error', key: 'insp.bgNotOnScreen' };
  if (state === 'onDevice' || stored === true) return { tone: 'ok', key: 'insp.bgOnScreen' };
  return { tone: 'muted', key: 'inspector.video.checking' };
}

/**
 * The chooser's sources, the screen's disabled with the reason (a text
 * key) when no screen is connected or it does not play stored videos.
 */
export function chooserSources(screen) {
  const reason = !screen ? 'screen.none' : playsVideos(screen) ? null : 'deviceVideo.unsupported';
  return BACKGROUND_SOURCES.map((source) => ({ source, disabled: source === 'screen' ? reason : null }));
}

/**
 * The colour the chooser starts from: the background's own, else the last
 * solid colour seen, else the colour around a screen video's windows.
 */
export function startColor(bg, lastColor = null) {
  if (backgroundKind(bg) === 'color' && bg?.color) return bg.color;
  return lastColor ?? (bg?.type === 'deviceVideo' && bg.color ? bg.color : DEFAULT_BACKGROUND_COLOR);
}

/** What the chooser has picked when it opens: the background's own file for its source. */
export function startPicks(bg, lastColor = null) {
  const source = backgroundSource(bg);
  return {
    color: startColor(bg, lastColor),
    computer: source === 'computer' ? bg.asset : null,
    screen: source === 'screen' ? bg.path : null,
  };
}

/**
 * The background the chooser would set: the pick of the open `source`
 * (a colour, an asset reference, a stored path), or `null` when nothing is
 * picked. The background in use comes back as it is (its fit, framing,
 * loop and colours kept); a screen video keeps the loop and colour of the
 * one it replaces.
 * @param {object} current the background in use
 * @param {'color'|'computer'|'screen'} source
 * @param {string|null} pick
 * @param {object[]} assets the theme's assets (`list_assets`)
 */
export function chosenBackground(current, source, pick, assets = []) {
  if (!pick) return null;
  if (source === 'color') return backgroundKind(current) === 'color' && current.color === pick ? current : { type: 'color', color: pick };
  if (source === 'computer') {
    if (backgroundSource(current) === 'computer' && current.asset === pick) return current;
    const asset = assets.find((a) => a.ref === pick);
    return asset ? backgroundOf(asset) : null;
  }
  if (current?.type === 'deviceVideo' && current.path === pick) return current;
  const was = current?.type === 'deviceVideo' ? current : null;
  return { type: 'deviceVideo', path: pick, looping: was ? was.looping !== false : true, color: was?.color ?? startColor(current) };
}

/** Whether two backgrounds are the same (nothing to confirm). */
export function sameBackground(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** The text key of the chooser's confirm button, for what it would set (or the open source while nothing is picked). */
export function confirmKey(chosen, source) {
  const kind = chosen ? backgroundKind(chosen) : { color: 'color', computer: null, screen: 'deviceVideo' }[source];
  if (kind === 'color') return 'insp.bgUseColor';
  if (kind === 'image') return 'insp.bgUseImage';
  return kind ? 'insp.bgUseVideo' : 'insp.bgUse';
}
