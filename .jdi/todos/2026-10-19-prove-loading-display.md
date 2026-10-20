# Prove fisiche loading BEZEL EVO

## 8,8 pollici, COM6, Rev C seriale

- Studio chiuso dopo conferma di salvataggio; Light arrestato cooperativamente.
- Nessuna SD: conferma sia del comando storage sia dell'utente. Backup catalogo
  in `dist/bezel-start-screen/pixel/before_apply_catalog.json`.
- Caricato `internal/video/bezel_loading_88.mp4`, 48.589 byte, dimensione
  verificata. Nessun contenuto preesistente cancellato o sostituito.
- Riproduzione diretta confermata dall'utente: orientamento corretto e animazione.
- Applicati start mode video e riavvio MCU mediante i comandi esistenti.
  Al riavvio la nuova clip NON viene selezionata: l'utente precisa una schermata,
  una foto colorata, poi il video di sfondo del template. Il solo messaggio CLI
  «boots with» non dimostra la selezione effettiva del file da parte del firmware.
- Ripristinato start mode originale Default (0), standby off e timer 5 minuti.
  Clip conservata nell'archivio interno. Non dedurre da questa prova che ogni
  avvio da memoria interna sia impossibile; resta ignota la selezione precisa.
- Il percorso SD (album/primo video) ha precedenti prove registrate su ROM1.90;
  non e stato provato qui, mancando la scheda. Logo firmware non sostituito.

## 3,5 pollici, COM3, Rev A

- Nuova autorizzazione esplicita a salvare/chiudere Studio prima dell'accesso.
- `storage info --screen COM3 --json`: dispositivo senza storage esposto.
- Immagine verticale 320x480 centrata preparata dalla variante Pixel approvata,
  senza modificare temi personali. Invio PNG riuscito.
- Tema temporaneo separato in `dist/bezel-start-screen/pixel/probe-35`, video
  decodificato da FFmpeg sul PC. CLI dichiara massimo 10 immagini/s.
- Conferma visiva utente: «Sì, corretta e animata». 194 frame inviati in 23,9 s
  (circa 8,1/s, misura di invio, non refresh ottico).
- Prova terminata con Ctrl+C e rilascio del collegamento, quindi Studio .55
  riaperto (PID 25532). Nessun riavvio o modifica firmware del 3,5.

## Conseguenze per la funzione

Precisazione finale utente: foto `C:\Users\danie\Desktop\20261019_194043.jpg`,
immagine astratta rosa/azzurra con TURZX in alto a destra durante il caricamento.
La flash interna esiste ed è usata per video; NON è dimostrato che serva una SD.
Il tentativo non ha selezionato la clip, ma non esclude un diverso comando o
percorso interno. Origine/selezione della foto da identificare, distinguendo
boot firmware da ripresa del tema Bezel. La precedente frase «serve una SD» era
troppo categorica ed è stata corretta. Vedi [handoff Claude](../HANDOFF-CLAUDE.md).

Schermo → Avvio e attesa resta da implementare. Sul 3,5 il loading deve essere
inviato dal PC dopo il collegamento; non promettere animazione autonoma prima
di Bezel. Sull'8,8 distinguere attesa host, media residenti e selezione boot
effettivamente supportata. Conservare i contenuti degli utenti; non riordinare
o sostituire file per forzare l'avvio senza copie recuperabili e scelta esplicita.

Prodotto invariato: sviluppo .55, installazione .45, nessuna build/setup/push.
Log CLI in `target/start-screen-*.log`; artefatti locali in dist, non versionati.
