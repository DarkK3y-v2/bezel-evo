// What the font and colour pickers of ui/fields.js read and write in the
// app (D-2026-10-16-studio-redesign-fidelity-28, -29): the renderer's font
// catalogue (loaded once from the bridge), the bundled faces drawn in their
// own letters, the theme's families, swatches and used colours from the
// store, the user's recent picks, and the pickers' texts. One context for
// every panel that picks a font or a colour.
import { RECENT_FONTS_MAX, isNamedWeight, normalizeCatalog, themeFamilies } from '../font-catalog.js';
import { normalizeHex } from '../color-math.js';
import { addSwatch, moveSwatch, paletteOf, removeSwatch, renameSwatch, usedColors } from '../palette.js';
import { createRecents } from '../recents.js';

/** Most recent colours kept. */
export const RECENT_COLORS_MAX = 12;

/** The browser's storage, or none where it is refused. */
function localStore() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * @param {{store: object, t: (key: string, params?: object) => string, bridge: object, onCatalog?: () => void, storage?: object|null}} deps
 *   `onCatalog` runs when the font catalogue arrives (panels draw again)
 */
export function createPickers({ store, t, bridge, onCatalog = () => {}, storage = localStore() }) {
  let catalog = null;
  const faces = new Map();
  const recentFonts = createRecents(storage, 'bezel.recentFonts', { max: RECENT_FONTS_MAX });
  const recentColors = createRecents(storage, 'bezel.recentColors', {
    max: RECENT_COLORS_MAX, accept: (x) => normalizeHex(x) !== null, normalize: (x) => normalizeHex(x),
  });

  /** Loads the catalogue (once; again after a failure). */
  async function load() {
    try {
      catalog = normalizeCatalog(await bridge.fontCatalog());
      if (catalog) onCatalog();
    } catch {
      catalog = null;
    }
  }

  /** Draws a bundled family's names in its own letters: its face file, registered once. */
  function showFace(name, face) {
    if (!face || typeof FontFace !== 'function' || !document.fonts) return;
    const key = `${name.toLowerCase()}|${face.weight}|${face.italic}`;
    if (faces.has(key)) return;
    faces.set(key, bridge.fontFace(name, face.weight, face.italic).then((bytes) => {
      if (!bytes) return;
      const loaded = new FontFace(name, bytes, { weight: String(face.weight), style: face.italic ? 'italic' : 'normal' });
      document.fonts.add(loaded);
      return loaded.load();
    }).catch(() => {}));
  }

  const theme = () => store.getState().theme;
  const setPalette = (next) => store.dispatch('setPalette', { palette: next });

  const faceName = (face) => {
    const weight = isNamedWeight(face.weight) ? t(`weight.${face.weight}`) : String(face.weight);
    return face.italic ? t('fontPicker.italicFace', { weight }) : weight;
  };
  const fontTexts = () => ({
    family: t('inspector.fontFamily'),
    face: t('inspector.style'),
    title: t('fontPicker.title'),
    search: t('fontPicker.search'),
    filter: t('fontPicker.filter'),
    filters: { all: t('fontPicker.all'), sans: t('fontPicker.sans'), serif: t('fontPicker.serif'), mono: t('fontPicker.mono') },
    sections: { theme: t('fontPicker.inTheme'), recent: t('fontPicker.recent'), bundled: t('fontPicker.bundled'), system: t('fontPicker.system') },
    faces: (n) => (n === 1 ? t('fontPicker.faceOne') : t('fontPicker.faces', { count: n })),
    missing: t('fontPicker.missing'),
    missingNote: (family, fallback) => t('fontPicker.missingNote', { family, fallback }),
    faceName,
    faceMissing: (face, nearest) => (nearest
      ? t('fontPicker.faceMissing', { face: faceName(face), nearest: faceName(nearest) })
      : faceName(face)),
    none: t('fontPicker.none'),
    loading: t('fontPicker.loading'),
  });
  const colorTexts = () => ({
    title: (label) => t('colorPicker.title', { name: label }),
    area: t('colorPicker.area'),
    areaValue: (s, v) => t('colorPicker.areaValue', { saturation: s, brightness: v }),
    hue: t('colorPicker.hue'),
    opacity: t('inspector.opacity'),
    opacityPercent: t('colorPicker.opacityPercent'),
    hex: t('colorPicker.hex'),
    eyedropper: t('colorPicker.eyedropper'),
    swatch: (hex, alpha) => (alpha === 100 ? hex : t('colorPicker.swatchAlpha', { hex, alpha })),
    themeColors: t('colorPicker.themeColors'),
    themeEmpty: t('colorPicker.themeEmpty'),
    used: t('colorPicker.used'),
    recent: t('fontPicker.recent'),
    save: t('common.save'),
    edit: t('colorPicker.edit'),
    done: t('common.done'),
    swatchName: (n) => t('colorPicker.swatchName', { n }),
    moveUp: (n) => t('colorPicker.moveUp', { n }),
    moveDown: (n) => t('colorPicker.moveDown', { n }),
    remove: (n) => t('colorPicker.remove', { n }),
  });

  return {
    load,
    /** The normalised catalogue, `null` until loaded. */
    catalog: () => catalog,
    /**
     * What `fontPicker` needs, with `sample` the object's own text.
     * @param {string} sample
     */
    font: (sample) => ({
      texts: fontTexts(),
      source: {
        catalog: () => catalog,
        themeFamilies: () => themeFamilies(theme()),
        recent: () => recentFonts.list(),
        remember: (name) => recentFonts.push(name),
        sample,
        showFace,
      },
    }),
    /**
     * What `colorPicker` needs. `saved` false: a colour that is not the
     * theme's (an icon's tint before it is added) has no "+ Save".
     */
    color: ({ saved = true } = {}) => ({
      texts: colorTexts(),
      source: {
        swatches: () => paletteOf(theme()),
        used: () => usedColors(theme()),
        recent: () => recentColors.list(),
        remember: (hex) => recentColors.push(hex),
        palette: saved ? {
          add: (hex) => setPalette(addSwatch(paletteOf(theme()), hex)),
          rename: (i, name) => setPalette(renameSwatch(paletteOf(theme()), i, name)),
          move: (i, to) => setPalette(moveSwatch(paletteOf(theme()), i, to)),
          remove: (i) => setPalette(removeSwatch(paletteOf(theme()), i)),
        } : null,
      },
    }),
  };
}
