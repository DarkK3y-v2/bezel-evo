// Texts of one area. The shell (artboard Main): topbar, rail, stage and statusbar.
// Every key starts with one of PREFIXES; i18n/index.js merges the three
// languages into the base tables and refuses a key defined twice.

/** The key prefixes this area owns. */
export const PREFIXES = Object.freeze(['shell.']);

export default {
  en: {
    'shell.breadcrumb': 'Path',
    'shell.unsaved': 'Unsaved',
    'shell.saveHint': 'Save the theme (Ctrl+S)',
    'shell.saveKeys': 'Ctrl S',
    'shell.grid': 'Show guides and grid',
    'shell.fit': 'Fit',
    'shell.resizeLibrary': 'Resize the library panel',
    'shell.resizeInspector': 'Resize the properties panel',
    'shell.lastSaved': 'last saved {when}',
    'shell.notSavedYet': 'not saved yet',
    'shell.legend': '{width} × {height}',
    'shell.legendTurned': '{width} × {height} · turned {degrees}°',
    'shell.screenSize': '{width}×{height} · {port}',
    'shell.fps': ' · {fps} fps',
  },
  'pt-BR': {
    'shell.breadcrumb': 'Caminho',
    'shell.unsaved': 'Não salvo',
    'shell.saveHint': 'Salvar o tema (Ctrl+S)',
    'shell.saveKeys': 'Ctrl S',
    'shell.grid': 'Mostrar guias e grade',
    'shell.fit': 'Ajustar',
    'shell.resizeLibrary': 'Redimensionar o painel da biblioteca',
    'shell.resizeInspector': 'Redimensionar o painel de propriedades',
    'shell.lastSaved': 'último salvamento {when}',
    'shell.notSavedYet': 'ainda não salvo',
    'shell.legend': '{width} × {height}',
    'shell.legendTurned': '{width} × {height} · girado {degrees}°',
    'shell.screenSize': '{width}×{height} · {port}',
    'shell.fps': ' · {fps} fps',
  },
  it: {
    'shell.breadcrumb': 'Percorso',
    'shell.unsaved': 'Non salvato',
    'shell.saveHint': 'Salva il tema (Ctrl+S)',
    'shell.saveKeys': 'Ctrl S',
    'shell.grid': 'Mostra guide e griglia',
    'shell.fit': 'Adatta',
    'shell.resizeLibrary': 'Ridimensiona il pannello della libreria',
    'shell.resizeInspector': 'Ridimensiona il pannello delle proprietà',
    'shell.lastSaved': 'ultimo salvataggio {when}',
    'shell.notSavedYet': 'non ancora salvato',
    'shell.legend': '{width} × {height}',
    'shell.legendTurned': '{width} × {height} · ruotato {degrees}°',
    'shell.screenSize': '{width}×{height} · {port}',
    'shell.fps': ' · {fps} fps',
  },
};
