// The library panels (artboards Main's left panel, Sensors, Layers, Media, Themes).
export default {
  area: 'library',
  artboards: ['Sensors', 'Layers', 'Media', 'Themes'],
  states: [
    { name: 'widgets', run: (app) => app.tab('widgets') },
    { name: 'sensors', run: (app) => app.tab('sensors') },
    { name: 'layers', run: (app) => app.tab('layers') },
    { name: 'media', run: (app) => app.tab('media') },
    { name: 'media-collection', run: async (app) => { await app.tab('media'); await app.click('#subtab-media-collection'); } },
    { name: 'media-icons', run: async (app) => { await app.tab('media'); await app.click('#subtab-media-icons'); } },
    { name: 'gif-search', run: async (app) => { await app.tab('media'); await app.click('#subtab-media-collection'); await app.click('#gif-search-open'); } },
    { name: 'themes', run: (app) => app.tab('themes') },
  ],
};
