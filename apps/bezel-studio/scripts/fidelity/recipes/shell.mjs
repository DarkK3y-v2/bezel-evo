// The shell (artboard Main): topbar, rail, stage and statusbar.
export default {
  area: 'shell',
  artboards: ['Main'],
  states: [
    { name: 'main', run: async () => {} },
    // An edit: "Unsaved" in the breadcrumb and the statusbar.
    { name: 'unsaved', run: (app) => app.add('ring') },
    { name: 'live', run: (app) => app.click('label.live-toggle') },
    { name: 'grid', run: (app) => app.click('#grid-toggle') },
    { name: 'preferences', run: (app) => app.click('#preferences') },
    // No screen: the Connect card over the stage (outside the gallery, D-5 revised).
    { name: 'no-screen', demo: 'empty', run: async () => {} },
  ],
};
