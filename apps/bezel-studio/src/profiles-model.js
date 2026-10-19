// The profile manager's choices, apart from the dialog: who decides what the
// screens show, how a profile's rules read, and what removing one changes.
// The saved configuration keeps its shape (automatic, manual, defaultProfile,
// profiles[].rules[]); only how the dialog presents it lives here.

/** Covers painted over the whole screen (crates/bezel-core/src/domain/cover.rs). */
export const PROFILE_EFFECTS = Object.freeze(['none', 'curtain', 'wipe', 'blinds', 'mosaic']);

/** The cover effects that move in a direction (the mosaic has none). */
export const directed = (effect) => effect !== 'none' && effect !== 'mosaic';

/**
 * Who decides: `auto` (the rules, `fallback` when none holds) or `manual`
 * (always `manual`). A `null` profile is the base themes.
 * @returns {{mode: 'auto'|'manual', manual: string|null, fallback: string|null}}
 */
export function modeOf(config) {
  return {
    mode: config.automatic ? 'auto' : 'manual',
    manual: config.automatic ? null : config.manual ?? null,
    fallback: config.defaultProfile ?? null,
  };
}

/**
 * The configuration with `choice` applied: Automatic keeps its fallback and
 * drops the manual pick; Manual with no profile is the former Default.
 * @param {{mode: 'auto'|'manual', manual?: string|null, fallback?: string|null}} choice
 */
export function withMode(config, choice) {
  const known = (id) => (id && config.profiles.some((p) => p.id === id) ? id : null);
  const automatic = choice.mode === 'auto';
  return {
    ...config,
    automatic,
    manual: automatic ? null : known(choice.manual ?? null),
    defaultProfile: known(choice.fallback === undefined ? config.defaultProfile : choice.fallback),
  };
}

/** The configuration without the profile `id`, no choice pointing at it. */
export function withoutProfile(config, id) {
  return {
    ...config,
    profiles: config.profiles.filter((p) => p.id !== id),
    manual: config.manual === id ? null : config.manual,
    defaultProfile: config.defaultProfile === id ? null : config.defaultProfile,
  };
}

/**
 * The first profile the runtime would refuse, so the dialog can show it
 * before saving: no name, a connected display without a theme, a rule that
 * watches no app or with a priority or delay out of range. `null` when all fit.
 */
export function firstIncomplete(config, displays) {
  const within = (value, max) => Number.isInteger(value) && value >= 0 && value <= max;
  const connected = displays.filter((d) => d.connected).map((d) => d.key);
  const bad = config.profiles.find((profile) => !profile.name?.trim()
    || connected.some((key) => !profile.themes[key])
    || profile.rules.some((rule) => (rule.source !== 'mediaPlaying' && !rule.app?.trim())
      || !within(rule.priority, 100) || !within(rule.returnSeconds, 300)));
  return bad?.id ?? null;
}

/** One rule in plain words: "when music is playing", "when game.exe is in front". */
export function ruleSummary(t, rule) {
  const app = rule.app?.trim();
  if (rule.source === 'mediaPlaying') {
    return app ? t('profiles.summary.mediaIn', { app }) : t('profiles.summary.media');
  }
  return t(rule.source === 'foreground' ? 'profiles.summary.foreground' : 'profiles.summary.process', { app: app || '…' });
}

/** What the list says under a profile: its first rule, and how many more. */
export function profileSummary(t, profile) {
  const [first, ...rest] = profile.rules;
  if (!first) return t('profiles.summary.none');
  const text = ruleSummary(t, first);
  return rest.length ? `${text} · ${t('profiles.summary.more', { count: rest.length })}` : text;
}

/** The icon of a profile: what its first rule watches. */
export function profileIcon(profile) {
  const source = profile.rules[0]?.source;
  if (source === 'mediaPlaying') return 'player';
  if (source === 'foreground' || source === 'process') return 'chip';
  return 'themes';
}

/** `landscape` or `portrait`, from a theme's canvas (portrait when unknown). */
export function orientationOf(theme) {
  return theme?.canvas && theme.canvas.width > theme.canvas.height ? 'landscape' : 'portrait';
}
