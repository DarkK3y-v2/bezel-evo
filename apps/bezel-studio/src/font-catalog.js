// The font picker's model (D-2026-10-16-studio-redesign-fidelity-28): the
// renderer's font catalogue (bridge `fontCatalog`), searched and filtered
// into the sections the picker shows, the faces a family really has, and
// what a theme naming a missing family gets instead. Pure, no DOM.

/** The filter chips, in order. */
export const FONT_FILTERS = Object.freeze(['all', 'sans', 'serif', 'mono']);
/** The sections, in order. */
export const FONT_SECTIONS = Object.freeze(['assets', 'theme', 'recent', 'bundled', 'user', 'system']);
/** Most recent fonts kept. */
export const RECENT_FONTS_MAX = 8;
/** The weights with a name (`weight.N` in the i18n tables). */
export const NAMED_WEIGHTS = Object.freeze([100, 200, 300, 400, 500, 600, 700, 800, 900]);

const CATEGORIES = new Set(['sans', 'serif', 'mono', 'display']);
const fold = (text) => String(text ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const byFace = (a, b) => a.weight - b.weight || Number(a.italic) - Number(b.italic);

/**
 * The bridge's catalogue made safe to read: families with a name and at
 * least one face, faces sorted without duplicates, an unknown category read
 * as sans. `null` stays `null` (not loaded yet).
 * @returns {{families: {name: string, aliases: string[], faces: {weight: number, italic: boolean}[], monospace: boolean, category: string, bundled: boolean}[], fallback: string|null}|null}
 */
export function normalizeCatalog(dto) {
  if (!dto || !Array.isArray(dto.families)) return null;
  const families = dto.families.flatMap((f) => {
    if (typeof f?.name !== 'string' || !f.name) return [];
    const seen = new Set();
    const faces = (Array.isArray(f.faces) ? f.faces : [])
      .filter((x) => Number.isFinite(x?.weight))
      .map((x) => ({ weight: Math.round(x.weight), italic: Boolean(x.italic) }))
      .filter((x) => !seen.has(faceValue(x)) && seen.add(faceValue(x)))
      .sort(byFace);
    if (!faces.length) return [];
    return [{
      name: f.name,
      aliases: Array.isArray(f.aliases) ? f.aliases.filter((a) => typeof a === 'string') : [],
      faces,
      monospace: Boolean(f.monospace),
      category: CATEGORIES.has(f.category) ? f.category : 'sans',
      bundled: Boolean(f.bundled),
      origin: f.origin ?? (f.bundled ? 'bundled' : 'system'),
      ...(typeof f.asset === 'string' ? { asset: f.asset } : {}),
    }];
  });
  return { families, fallback: typeof dto.fallback === 'string' ? dto.fallback : null };
}

/** The family of `catalog` a theme naming `name` gets (any case, or a localized alias); `null` when missing. */
export function findFamily(catalog, name, asset = null) {
  const wanted = fold(name);
  return catalog?.families.find((f) => (asset ? f.asset === asset : !f.asset) && (fold(f.name) === wanted || f.aliases.some((a) => fold(a) === wanted))) ?? null;
}

/**
 * Whether a theme's font is drawn as named. A font that carries its own
 * file (`asset`) is the theme's. Otherwise a missing family is drawn in the
 * catalogue's fallback. Unknown until the catalogue is loaded (`known` false).
 * @param {{family: string, asset?: string|null}} font
 * @returns {{known: boolean, missing: boolean, family: object|null, fallback: string|null}}
 */
export function fontStatus(catalog, font) {
  if (!catalog) return { known: false, missing: false, family: null, fallback: null };
  const family = findFamily(catalog, font?.family, font?.asset);
  const missing = !family && !font?.asset;
  return { known: true, missing, family, fallback: missing ? catalog.fallback : null };
}

/** The distinct font families the theme's elements use, in reading order. */
export function themeFamilies(theme) {
  const names = [];
  const seen = new Set();
  const visit = (value) => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') {
      if (typeof value.family === 'string' && value.family && typeof value.weight === 'number') {
        const key = fold(value.family);
        if (!seen.has(key)) {
          seen.add(key);
          names.push(value.family);
        }
      }
      Object.values(value).forEach(visit);
    }
  };
  visit(theme?.elements ?? []);
  return names;
}

/** Whether `family` passes the filter chip `filter`. */
export const passesFilter = (family, filter) => filter === 'all' || family.category === filter;

/** Whether `family`'s name or an alias contains every word of `query` (any case or accent). */
export function matchesQuery(family, query) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const names = [family.name, ...family.aliases].map(fold);
  return words.every((w) => names.some((n) => n.includes(w)));
}

/**
 * The picker's sections, in order, each `{key, entries, count}`: the
 * theme's families (a missing one is `{name, missing: true}`), the recent
 * ones, the bundled ones and the system's. Theme and recent are shortcuts,
 * so a family also appears in its full list. Empty sections are left out.
 * @param {ReturnType<typeof normalizeCatalog>} catalog
 * @param {{query?: string, filter?: string, theme?: string[], recent?: string[]}} opts
 */
export function fontSections(catalog, { query = '', filter = 'all', theme = [], recent = [] } = {}) {
  if (!catalog) return [];
  const keep = (f) => passesFilter(f, filter) && matchesQuery(f, query);
  const shortcut = (names, missingToo) => names.flatMap((name) => {
    const family = findFamily(catalog, name) ?? catalog.families.find((f) => fold(f.name) === fold(name));
    if (family) return keep(family) ? [family] : [];
    return missingToo && filter === 'all' && matchesQuery({ name, aliases: [] }, query) ? [{ name, missing: true }] : [];
  });
  const inTheme = shortcut(theme, true);
  const themeKeys = new Set(inTheme.map((f) => fold(f.name)));
  const sections = [
    { key: 'assets', entries: catalog.families.filter((f) => f.asset && keep(f)) },
    { key: 'theme', entries: inTheme },
    { key: 'recent', entries: shortcut(recent, false).filter((f) => !themeKeys.has(fold(f.name))) },
    { key: 'bundled', entries: catalog.families.filter((f) => !f.asset && f.bundled && keep(f)) },
    { key: 'user', entries: catalog.families.filter((f) => !f.asset && !f.bundled && f.origin === 'user' && keep(f)) },
    { key: 'system', entries: catalog.families.filter((f) => !f.asset && !f.bundled && f.origin !== 'user' && keep(f)) },
  ];
  return sections.filter((s) => s.entries.length).map((s) => ({ ...s, count: s.entries.length }));
}

/** A face as the face select's value: `400`, `700i`. */
export const faceValue = ({ weight, italic }) => `${weight}${italic ? 'i' : ''}`;

/** The face of a face select's value (`null` when it is not one). */
export function parseFaceValue(value) {
  const m = /^(\d{1,4})(i?)$/.exec(String(value));
  return m ? { weight: Number(m[1]), italic: m[2] === 'i' } : null;
}

/**
 * The face of `faces` drawn for `wanted`, as font matching does: same
 * slant first, then the nearest weight (a tie goes heavier above 500,
 * lighter otherwise).
 */
export function nearestFace(faces, wanted) {
  if (!faces?.length) return null;
  const slanted = faces.filter((f) => f.italic === Boolean(wanted.italic));
  const pool = slanted.length ? slanted : faces;
  const heavier = wanted.weight > 500;
  return pool.reduce((best, f) => {
    const d = Math.abs(f.weight - wanted.weight), bd = Math.abs(best.weight - wanted.weight);
    if (d < bd) return f;
    if (d === bd && (heavier ? f.weight > best.weight : f.weight < best.weight)) return f;
    return best;
  });
}

/**
 * The face select's options for `family` and the theme's `current` face:
 * the faces it has; the current one first-class when the family has it,
 * otherwise added as `{missing: true, nearest}` so the select tells the
 * truth instead of quietly changing the theme. Without the family (not
 * loaded, missing) only the current face.
 * @returns {{weight: number, italic: boolean, value: string, missing?: boolean, nearest?: object|null}[]}
 */
export function faceOptions(family, current) {
  const own = { weight: current.weight, italic: Boolean(current.italic) };
  const faces = family?.faces ?? [];
  const options = faces.map((f) => ({ ...f, value: faceValue(f) }));
  if (!faces.some((f) => faceValue(f) === faceValue(own))) {
    options.push({ ...own, value: faceValue(own), missing: true, nearest: nearestFace(faces, own) });
    options.sort(byFace);
  }
  return options;
}

/** The face a newly picked `family` gets for the theme's `current` face: the same, or the nearest it has. */
export const faceForFamily = (family, current) => nearestFace(family.faces, current) ?? current;

/** Whether `weight` has a name (Regular, Bold…); an unusual one (250, 350) is shown as its number. */
export const isNamedWeight = (weight) => NAMED_WEIGHTS.includes(weight);


/** Detach a font file everywhere in the document, preserving family, weight and slant. */
export function withoutThemeFont(theme, asset) {
  const visit = (value) => {
    if (Array.isArray(value)) return value.map(visit);
    if (!value || typeof value !== 'object') return value;
    const next = Object.fromEntries(Object.entries(value).map(([key, child]) => [key, visit(child)]));
    if (typeof next.family === 'string' && typeof next.weight === 'number' && next.asset === asset) next.asset = null;
    return next;
  };
  return visit(theme);
}

/** Font files currently referenced anywhere in the theme. */
export function themeFontAssets(theme) {
  const assets = new Set();
  const visit = (value) => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') {
      if (typeof value.family === 'string' && typeof value.asset === 'string') assets.add(value.asset);
      Object.values(value).forEach(visit);
    }
  };
  visit(theme);
  return assets;
}
