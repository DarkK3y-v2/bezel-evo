# Riaggancio 8,8 e nome Default

## Segnalazione e diagnosi

Utente: l'8,8 non si riaggancia dopo la riapertura di Studio sulla .54.
Windows enumera COM6 (display) e COM4 (MCU); il 3,5 usa COM3.
Light PID 21088 e Studio PID 33640 attivi. Il log mostra ripetuti errori
del presenter della scena 2 prima dell'apertura di COM6 alle 16:55:52 UTC.
Il vecchio log registra solo «io», quindi non dimostra da solo la causa precisa.
Entrambi i temi salvati si caricano e producono PNG con la CLI .54.

Nel codice, il primo collegamento cerca solo la porta salvata. Se il SoC
dell'8,8 dorme, quella porta sparisce e resta l'MCU: la ricerca fallisce senza
provare il risveglio. Il recupero per identità funzionava dopo un collegamento
riuscito nella stessa sessione, ma non dopo il riavvio del processo.

## Correzione

- Cache locale per installazione `engine-video/screen-addresses.json`: associa
  la porta del display al suo MCU osservato, con VID/PID e seriale.
- L'avvio e ogni apertura riuscita ricordano le coppie enumerate; se manca
  la porta richiesta, il presenter cerca esclusivamente il relativo MCU.
- Più monitor rispettati: nessun ripiego sul primo monitor o su un MCU diverso.
  La cache non cambia temi, documenti, profili o preferenze Live.
- Cache assente/corrotta/non scrivibile non impedisce un collegamento diretto;
  serve almeno una rilevazione della coppia display/MCU per impararla.
- Su richiesta dell'utente, il profilo base ora si chiama **Default** in
  selezione, ritorno automatico e tray. Temi per schermo sempre visibili.

## Verifica e consegna

- Test regressione: processo nuovo, SoC assente/MCU presente, porta display
  rinumerata, MCU differente e selezione sconosciuta senza ripiego.
- 95 unitari UI e 12 e2e della sezione Profili verdi, inclusi due display,
  italiano/inglese, chiaro/scuro e accessibilità.
- Test runtime: 49 verdi. CLI: 104 unitari e integrazioni verdi. Studio:
  221/223 passati nella prima esecuzione, i due confronti esatti di tempi f64
  falliti per ultimo decimale sono passati isolatamente, senza cambiare codice
  o rieseguire la suite. Clippy all-targets dei tre crate verde.
- La prima build ha individuato il riferimento residuo al vecchio nome nel
  tray Studio: aggiornato e verificato con test/clippy del crate Studio.
- Cache iniziale della macchina popolata con la coppia COM6/COM4 e VID/PID,
  seriale osservati dalla CLI durante questa diagnosi: permette la prima
  ripartenza anche se il display dorme prima che .55 impari la coppia da sola.
- Build .55 diretta riuscita al secondo tentativo con script ufficiale (1m21s).
  CLI e metadati Studio verificati, avvio diretto PID 37688. Installata .45,
  nessun setup o push.
- SHA256 Studio: `55007646D611A5FE64EC6C49AE086AF48262447706FDD616B0B0F43880728E5C`.
- SHA256 CLI: `0BCCDEBC413E94EBB1242422C3A3DE1EC0AE60FD98213AB41FD0EF66D1F7B404`.
- La prova fisica di chiusura/riapertura con l'8,8 in standby resta da eseguire
  sulla nuova build. Non dichiarare la causa hardware definitivamente verificata.

## Controllo del nuovo avvio

Studio PID 37688 rispondente, Light PID 60644. Log del 19 ottobre 2026:
COM3 aperta alle 17:09:37 UTC e COM6 alle 17:09:38 UTC. Nel primo campione
328 Present scena 2 e 77 scena 1, nessun ScreenError. Sono conferme di invio,
non una misura ottica del display. Le porte erano enumerate prima del lancio:
la prova fisica del ramo SoC assente resta distinta e ancora aperta.
