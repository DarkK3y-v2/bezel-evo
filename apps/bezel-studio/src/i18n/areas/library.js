// Texts of one area. The library panels (artboards Main, Sensors, Layers, Media, Themes).
// Every key starts with one of PREFIXES; i18n/index.js merges the three
// languages into the base tables and refuses a key defined twice.

/** The key prefixes this area owns. */
export const PREFIXES = Object.freeze(['widgets.', 'sensorsPanel.', 'layersPanel.', 'mediaPanel.', 'themesPanel.']);

export default {
  en: {},
  'pt-BR': {},
  it: {},
};
