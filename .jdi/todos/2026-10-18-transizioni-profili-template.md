# Transizioni tra profili e template moderni

## Richiesta e risultato

L'utente richiede gli effetti delle card anche tra profili e nuovi template
moderni che sfruttino le funzioni disponibili nella libreria.

- Il port `FrameRenderer::transition_frame` consente la composizione senza
  introdurre una dipendenza dal renderer concreto nel runtime. Skia riutilizza
  pose, easing e proiezione prospettica delle card, con vera dissolvenza dei
  colori premoltiplicati senza oscuramento intermedio.
- `Config.transition` memorizza effetto, direzione e durata 150–3000 ms. Vecchi
  file compatibili: nessuna animazione predefinita. Impostazione comune ai display,
  per selezione manuale, regole e ritorno; stesso clock d'inizio per tutti.
- Il runtime conserva un fotogramma sorgente per display e disegna il tema in
  arrivo con letture correnti. Cambi ravvicinati ripartono dall'immagine composta,
  senza accodare animazioni. Massimo 20 fps; presenter occupato: attesa, ogni
  display al proprio ritmo. Dopo la durata si emette il tema definitivo.
- In editing si annulla l'animazione e si ripristina il documento. I fotogrammi
  transitori non vengono pubblicati nell'anteprima del documento.
- Limite esplicito: il video riprodotto direttamente dal dispositivo non è
  disponibile come fotogramma host, quindi il cambio in quel caso è immediato.
- UI in Profili e automazioni, label visibili e campi compatti; i18n en/pt-BR/it.

## Template

Sei originali inclusi in `themes/`, modificabili salvandone una copia:

- Pulse / Gaming: verde lime su scuro, card CPU/GPU con rotazione carico/termiche
  ogni 12 secondi, scorrimento, grafici a 90 punti, valori fluidi, soglie colore;
  versione Round con arco GPU a gradiente, temperatura e orologio.
- Resonance / Music: prugna/lavanda, player con angoli copertina indipendenti,
  timeline con cursore e tempi ai lati, spettro audio di sistema a blocchi
  nella Wide e barre nella Round; volume e orologio nella Wide.
- Clarity / Monitor: minerale chiaro/verde, orologio e data localizzata,
  CPU/GPU/RAM con grafici e uptime nella Wide; storia CPU nella Round.

Formati coordinati: Wide 1920×480 e Round 480×480 con contenuti importanti
entro il cerchio. Font inclusi; nessun download o dato demo nei temi.
Generatore ripetibile `scripts/create-modern-themes.py`, guida `themes/README.md`.

## Verifiche

- Test dei soli quattro crate coinvolti, compresi integration e doctest, verdi.
  Core 174 unitari più integration; renderer 82 verdi/1 ignorato; runtime 45
  verdi; Studio 223 verdi. Clippy all-targets -D warnings dei quattro crate verde.
- Nuove regressioni: composizione pixel per i tre effetti e quattro direzioni,
  estremi esatti e alpha della dissolvenza, vecchi file e limiti, avvio/rientro
  sincronizzato su due display, annullamento in editing, deadline intermedi.
- Caricamento e rendering di tutti e sei i temi, entrambe le facce delle card,
  sensori validi, geometria entro canvas, audio effettivo senza demo salvata.
- 106 unitari UI mirati e 12 e2e profili verdi; e2e esteso con persistenza
  scorrimento, direzione su e durata 850 ms. Ultimo passaggio ripetuto solo
  sulla specifica interessata dopo correzione label e suggerimento.
- Anteprime controllate in `dist/modern-theme-previews/`, incluse sessione media,
  copertina, spettro e grafici rappresentativi. UI in `dist/profiles-editor.png`.
- Log: `target/transitions-area-tests.log`, `target/transitions-runtime-final.log`,
  `target/transitions-clippy.log`, `target/transitions-e2e-final.log`.
- Commit: `e73d433` runtime, `a94337a` UI, `6472f8c` template.

## Consegna

Ricevuta la conferma utente di salvataggio e chiusura. Verificata l'assenza di
processi Bezel, completata `build-evo.ps1 -Version 0.1.41` in 1m29s; log in
`target/build-evo-0.1.41.log`. CLI e metadati Studio riportano 0.1.41.

Copiati i sei manifest in `target/release/themes`, verificando ciascun hash
contro l'originale, senza cancellare le librerie esistenti. Avviato direttamente
Studio in finestra normale da `F:/Dev/bezel/target/release/bezel-studio.exe`,
PID 47596. Percorso del processo e SHA256 confrontati con il binario compilato:
`ECFC8E4DC00B2C13BEFF69F335E124747291151495F069274941DBA774AD5BD1`.

Commit versione/changelog `8fd6b88`. Nessun setup, installazione o push.
Resta la prova utente delle transizioni sui due display fisici e dei template
inclusi dalla libreria Temi; la configurazione degli effetti si trova in
Temi → Profili e automazioni.
