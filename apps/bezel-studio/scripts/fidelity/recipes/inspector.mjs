// The inspector (artboards Main's right panel, GraphData/Look, PlayerData/Look).
export default {
  area: 'inspector',
  artboards: ['GraphData', 'GraphLook', 'PlayerData', 'PlayerLook'],
  states: [
    { name: 'theme', run: async () => {} },
    { name: 'ring', run: (app) => app.add('ring') },
    { name: 'ring-look', run: async (app) => { await app.add('ring'); await app.inspectorTab(1); } },
    { name: 'graph', run: (app) => app.add('graph') },
    { name: 'graph-look', run: async (app) => { await app.add('graph'); await app.inspectorTab(1); } },
    { name: 'player', run: (app) => app.add('player') },
    { name: 'player-look', run: async (app) => { await app.add('player'); await app.inspectorTab(1); } },
  ],
};
