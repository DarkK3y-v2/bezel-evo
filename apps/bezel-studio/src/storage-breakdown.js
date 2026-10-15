// What the Storage tab sums up (artboard Storage): each medium's use split
// by kind (videos, pictures, the rest the screen uses), the file the screen
// starts with, and the place filter (all, SD card, internal memory) with its
// counts. Pure: the storage manager's overview (`managerOverview`) comes in.

/** The kinds a medium's bar shows, in order: `other` is what the files do not explain. */
export const BAR_KINDS = Object.freeze(['video', 'image', 'other']);

/** The place filter's choices, in order. */
export const PLACES = Object.freeze(['all', 'sd', 'internal']);

/**
 * A medium's use by kind: the bytes of its videos and pictures, and the rest
 * of what it uses; each part's share of the medium, so the parts never sum
 * to more than what is used.
 * @param {{medium: string, kind: string, size: number|null}[]} files the overview's files
 * @param {{used: number, total: number}|null} capacity the medium's capacity
 * @param {string} medium `internal` or `sd`
 * @returns {{kind: string, bytes: number, fraction: number}[]} in BAR_KINDS order; empty without a capacity
 */
export function breakdown(files, capacity, medium) {
  if (!capacity?.total) return [];
  const used = Math.max(0, Math.min(capacity.used ?? 0, capacity.total));
  const sum = (kind) => files.filter((f) => f.medium === medium && f.kind === kind).reduce((total, f) => total + (f.size ?? 0), 0);
  let left = used;
  const take = (bytes) => {
    const part = Math.min(bytes, left);
    left -= part;
    return part;
  };
  const video = take(sum('video'));
  const image = take(sum('image'));
  const other = left;
  return [['video', video], ['image', image], ['other', other]].map(([kind, bytes]) => ({ kind, bytes, fraction: bytes / capacity.total }));
}

/**
 * How many files each place holds: `all`, `sd`, `internal`.
 * @param {{medium: string}[]} files
 */
export function placeCounts(files) {
  const sd = files.filter((f) => f.medium === 'sd').length;
  const internal = files.filter((f) => f.medium === 'internal').length;
  return { all: sd + internal, sd, internal };
}

/**
 * The media a place shows, in the order the tab lists them.
 * @param {string} place one of PLACES (anything else shows both)
 * @param {readonly string[]} media the media, e.g. `['internal', 'sd']`
 */
export function mediaShown(place, media) {
  return place === 'sd' || place === 'internal' ? media.filter((m) => m === place) : [...media];
}

/**
 * The file the screen shows at start-up, as Bezel set it (`protected ===
 * 'boot'`), or null: the screen's own default.
 * @template {{protected?: string|null}} F
 * @param {F[]} files
 * @returns {F|null}
 */
export function bootFile(files) {
  return files.find((f) => f.protected === 'boot') ?? null;
}
