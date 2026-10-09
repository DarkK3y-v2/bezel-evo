// The shell (artboard Main): topbar, rail, stage, statusbar.
export default {
  area: 'shell',
  artboards: ['Main'],
  states: [
    { name: 'main', run: async () => {} },
    { name: 'preferences', run: (app) => app.click('#preferences') },
    // No screen: the Connect card over the stage (outside the gallery, D-5 revised).
    { name: 'no-screen', demo: 'empty', run: async () => {} },
  ],
};
