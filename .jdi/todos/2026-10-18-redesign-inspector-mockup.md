# Redesign condiviso dell'inspector dal mockup — 2026-10-18

## Richiesta e perimetro

Specifica ricevuta in `Testo incollato.txt` (allegato utente), con riferimento
GPU usage. Applicazione richiesta a tutti i widget, nei componenti reali, senza
replica delle dimensioni del mockup e senza allargare la sidebar.

Successiva indicazione: centrare visivamente il contenuto dell'anteprima.
Per queste prove: solo build diretta e avvio dell'eseguibile, niente setup.

## Implementazione

- `c068cec`: builder `propertySection`, campi, tab e stili comuni. Titoli con icone,
  geometria con label integrate e unità a destra, rotazione compatta, tab autonome
  a 28 px dagli allineamenti. Aspetto e Dati adottano gli stessi divisori leggeri.
- Token per crema `#F2EDE6`, verde live `#34D399`, altezza/radius dei controlli e
  separazione delle tab. Arancione `#FF9248` per selezioni; niente verde decorativo
  o nuovo stato live presunto. Tema chiaro conserva testi scuri leggibili.
- Eliminati bordi e fondi annidati del colore condizionale. Durata delle transizioni
  con slider e readout compatto; controllo nascosto quando la transizione è spenta.
- Fahrenheit mostrato solo per sensori di temperatura; nessun cambio al formato salvato.
- `286cb73`: nei layout a frase il campo numerico consegna il proprio input con nome
  accessibile, evitando che il contenitore venga nascosto insieme alla label.
- `9ccc33d`: centratura del contenuto visibile dell'anteprima mediante sola traslazione
  CSS, ricavata dai pixel non trasparenti. Pixel, dimensioni del frame, allineamento
  salvato e rendering sul display restano invariati. Area di anteprima con clipping
  dei soli margini trasparenti traslati; scheduler e richieste backend invariati.

## Verifica

- 110 unitari mirati distinti verdi: i18n, schede, transizioni, vincoli statici CSS,
  angoli, frasi e anteprima. Chiavi en/pt-BR/it in parità e nessun colore fuori dai token.
- 184 casi e2e distinti delle aree interessate verdi fra le esecuzioni mirate.
  Controllo automatico di tutte le 13 tipologie, Dati/Aspetto, proprietà comuni,
  larghezza reale, navigazione, Undo, accessibilità e assenza di overflow orizzontale.
- Corretto il contrasto transitorio delle tab: selezione cromatica immediata.
  Test falliti rieseguiti solo nell'area interessata, mai suite completa.
- Centratura verificata su testo allineato a sinistra e a destra; i pixel continuano
  a riflettere l'allineamento del widget mentre la posizione visiva resta centrale.
- Parità della rotazione verificata con il fixture Rust senza cambiare i renderer.
- Anteprime aggiornate: `dist/inspector-redesign-data.png` e
  `dist/inspector-redesign-look.png`.

## Consegna

Build locale 0.1.38 in corso con `scripts/windows/build-evo.ps1 -Version 0.1.38`.
Primo tentativo interrotto per includere la richiesta di centratura arrivata durante
la compilazione. Nessun setup, installazione, push o pubblicazione.

Prossimo passo: completare la build, verificare versione e processo, avviare direttamente
`target/release/bezel-studio.exe` e raccogliere la prova dell'utente.
