// The card's inspector (artboards CardFaces, CardMotion, CardTriggers).
export default {
  area: 'card',
  artboards: ['CardFaces', 'CardMotion', 'CardTriggers'],
  states: [
    { name: 'faces', run: (app) => app.add('card') },
    { name: 'motion', run: async (app) => { await app.add('card'); await app.inspectorTab(1); } },
    { name: 'triggers', run: async (app) => { await app.add('card'); await app.inspectorTab(2); } },
    { name: 'look', run: async (app) => { await app.add('card'); await app.inspectorTab(3); } },
  ],
};
