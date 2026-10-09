// The screen panel and the sensor status (artboards Screen, Storage, SensorStatus).
export default {
  area: 'screen',
  artboards: ['Screen', 'Storage', 'SensorStatus'],
  states: [
    { name: 'settings', run: (app) => app.tab('screen') },
    { name: 'storage', run: async (app) => { await app.tab('screen'); await app.click('#subtab-storage'); } },
    { name: 'sensor-status', query: '&libre=partial', run: (app) => app.click('#status-libre-toggle') },
    { name: 'sensor-status-error', query: '&libre=error', run: (app) => app.click('#status-libre-toggle') },
  ],
};
