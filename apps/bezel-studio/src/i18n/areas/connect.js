// Texts of one area. Connect and the sensor chip (artboard SensorStatus).
// Every key starts with one of PREFIXES; i18n/index.js merges the three
// languages into the base tables and refuses a key defined twice.

/** The key prefixes this area owns. */
export const PREFIXES = Object.freeze(['connectView.', 'sensorChip.']);

export default {
  en: {
    'sensorChip.ok': 'sensors · {ms} ms',
    'sensorChip.missingOne': 'sensors · {count} missing',
    'sensorChip.missingMany': 'sensors · {count} missing',
    'sensorChip.stopped': 'sensors stopped',
    'sensorChip.restarting': 'restarting…',
    'sensorChip.title.ok': 'Sensors: everything reads',
    'sensorChip.title.partialOne': 'Sensors: {count} hardware not read',
    'sensorChip.title.partialMany': 'Sensors: {count} hardware not read',
    'sensorChip.title.error': 'Sensors stopped: no readings',
    'sensorChip.title.restarting': 'Restarting the sensors…',
    'sensorChip.hardware': 'Hardware read',
    'sensorChip.lastReading': 'last reading {ago}',
  },
  'pt-BR': {
    'sensorChip.ok': 'sensores · {ms} ms',
    'sensorChip.missingOne': 'sensores · {count} faltando',
    'sensorChip.missingMany': 'sensores · {count} faltando',
    'sensorChip.stopped': 'sensores parados',
    'sensorChip.restarting': 'reiniciando…',
    'sensorChip.title.ok': 'Sensores: tudo sendo lido',
    'sensorChip.title.partialOne': 'Sensores: {count} hardware sem leitura',
    'sensorChip.title.partialMany': 'Sensores: {count} hardwares sem leitura',
    'sensorChip.title.error': 'Sensores parados: nenhuma leitura',
    'sensorChip.title.restarting': 'Reiniciando os sensores…',
    'sensorChip.hardware': 'Hardware lido',
    'sensorChip.lastReading': 'última leitura {ago}',
  },
  it: {
    'sensorChip.ok': 'sensori · {ms} ms',
    'sensorChip.missingOne': 'sensori · {count} mancante',
    'sensorChip.missingMany': 'sensori · {count} mancanti',
    'sensorChip.stopped': 'sensori fermi',
    'sensorChip.restarting': 'riavvio in corso…',
    'sensorChip.title.ok': 'Sensori: tutto in lettura',
    'sensorChip.title.partialOne': 'Sensori: {count} hardware senza letture',
    'sensorChip.title.partialMany': 'Sensori: {count} hardware senza letture',
    'sensorChip.title.error': 'Sensori fermi: nessuna lettura',
    'sensorChip.title.restarting': 'Riavvio dei sensori in corso…',
    'sensorChip.hardware': 'Hardware letto',
    'sensorChip.lastReading': 'ultima lettura {ago}',
  },
};
