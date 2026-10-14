// Texts of one area. The screen panel (artboards Screen, Storage).
// Every key starts with one of PREFIXES; i18n/index.js merges the three
// languages into the base tables and refuses a key defined twice.

/** The key prefixes this area owns. */
export const PREFIXES = Object.freeze(['screenPanel.', 'storagePanel.']);

export default {
  en: {
    'screenPanel.protocol': 'protocol {name}',
    'screenPanel.autostart': 'Start with the computer',
    'screenPanel.autostartHint': 'In the tray, with the last theme already live.',
    'screenPanel.standby.keep': 'The screen keeps showing its last image.',
    'screenPanel.standby.off': 'Bezel turns it off when the system shuts down.',
    'screenPanel.standby.video': 'A video stored on the screen, in a loop.',
    'screenPanel.standby.album': 'The card\'s photos, one every 3–5 s.',
    'screenPanel.planB': 'Plan B, if Bezel does not answer',
    'screenPanel.minutesShort': '{count} min',
  },
  'pt-BR': {
    'screenPanel.protocol': 'protocolo {name}',
    'screenPanel.autostart': 'Iniciar com o computador',
    'screenPanel.autostartHint': 'Na bandeja, com o último tema já ao vivo.',
    'screenPanel.standby.keep': 'A tela continua mostrando a última imagem.',
    'screenPanel.standby.off': 'O Bezel a desliga quando o sistema é desligado.',
    'screenPanel.standby.video': 'Um vídeo salvo na tela, em loop.',
    'screenPanel.standby.album': 'As fotos do cartão, uma a cada 3–5 s.',
    'screenPanel.planB': 'Plano B, se o Bezel não responder',
    'screenPanel.minutesShort': '{count} min',
  },
  it: {
    'screenPanel.protocol': 'protocollo {name}',
    'screenPanel.autostart': 'Avvia con il computer',
    'screenPanel.autostartHint': 'Nella tray, con l\'ultimo tema già in diretta.',
    'screenPanel.standby.keep': 'Lo schermo continua a mostrare l\'ultima immagine.',
    'screenPanel.standby.off': 'Bezel lo spegne alla chiusura del sistema.',
    'screenPanel.standby.video': 'Un video salvato sullo schermo, in loop.',
    'screenPanel.standby.album': 'Le foto della scheda, una ogni 3–5 s.',
    'screenPanel.planB': 'Piano B, se Bezel non risponde',
    'screenPanel.minutesShort': '{count} min',
  },
};
