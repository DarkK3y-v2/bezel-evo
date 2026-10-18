# Prototipo di scene H.264 e uscite eterogenee

## Richiesta

L'utente vuole provare l'evoluzione verso grafici e scena completa fluidi,
considerando profili multimonitor con famiglie diverse. Non basta lo sfondo video.

## Implementazione sperimentale

- Porta opzionale `ScreenLink::encoded_scene()`: assente per impostazione
  predefinita, espone `EncodedScene` solamente sui Turing USB 8.8 e 9.2.
  La consultazione non invia comandi. Nessun cambiamento alle dichiarazioni
  hardware_validated dei modelli.
- Driver: avvio con nome non vuoto del vero clip standby, clear PNG trasparente,
  fps decoder, limite immagini; 121 per immagine completa, 122 per pressione coda.
  Attese limitate; nessuno spezzettamento arbitrario o perdita di immagini P.
  Letture streaming da 1024 byte per consumare lo ZLP senza flush a timeout
  per ogni immagine. Stop e tentativo di ripristino rate 30; nessun riavvio,
  salvataggio impostazioni, scrittura o cancellazione file sul pannello.
- Corretto framebuffer 9.2 da 462x1920 a 480x1920 secondo le misure pubblicate:
  18 colonne nascoste dalla cornice non sono pixel assenti dal framebuffer.
- `bezel_media::h264::H264Encoder`: processo FFmpeg persistente, un thread x264,
  Baseline/yuv420p, nessuna B, una slice per immagine, keyframe ogni cinque secondi.
  Tee framecrc prima di H264: dimensione pacchetto nota prima dei suoi byte,
  quindi confini esatti senza timeout di quiete o ritardo di un frame.
  Parser compatibile con colonne side-data delle versioni recenti di FFmpeg.
  Code e immagini limitate, timeout, kill/wait e join dei thread alla chiusura.
  Rifiuta scene trasparenti: occorre composizione opaca completa sul PC.
- `SceneOutput`: encoder e scelta trasporto per link; famiglia incompatibile
  conserva nativo senza avviare FFmpeg. Errore attivo registra causa, ferma il
  flusso e tenta il frame nativo. Ruota prima dell'encoding.
- Esempio eseguibile via Cargo `scene_stream_probe`: due worker indipendenti,
  renderer vero Bezel, temi Clarity clonati e marcati H264 DEMO, dati sintetici
  a 1 Hz interpolati causalmente per la visualizzazione. Storie dense dimostrative
  di 12 secondi; non cambia il campionamento o il grafico di produzione.

## Prova eseguita

Comando:

```powershell
cargo run --release -p bezel-media --example scene_stream_probe -- C:\ffmpeg\bin\ffmpeg.exe F:\Dev\bezel\dist\scene-stream-probe 30
```

- Scena larga 1920x480, codifica nativa 480x1920: **1496 immagini / 30.0008 s =
  49.8653 fps** completati sul PC. Media rendering 5.8804 ms; encoding/invio
  simulato 7.6064 ms. 1.158.825 byte H264. Nessun fallback.
- Uscita rotonda, percorso nativo simulato con ritardo artificiale 65 ms:
  **449 frame / 30.0058 s = 14.9638 fps**. Media rendering 1.4275 ms;
  output simulato 65.3030 ms. Non rallenta la prima uscita.
- Il secondo output richiede anch'esso H264: la capacità assente seleziona
  `UnsupportedFallback` prima di creare un encoder.
- MP4 anteprima separato dalla misura: 1920x480, 50 fps dichiarati, 1496 frame,
  durata 29.92 s verificati con ffprobe. I quattro frame mancanti rispetto al
  target teorico vengono saltati prima dell'encoding, mai fra immagini codificate.
- Prima e ultima PNG e un frame decodificato dal video ispezionati visivamente.
  Questa è misura di renderer/encoder e sink simulati, non refresh fisico o
  throughput USB, né garanzia su tutti i temi.

Artefatti locali: `dist/scene-stream-probe/index.html`, `wide-preview.mp4`,
`wide.h264`, `report.json`, PNG. Log `target/scene-stream-probe-final.log`.

## Verifiche

- Test core (175 unitari e integrazioni/doctest), devices (230), media (58 più
  integrazioni), tutti verdi per le aree toccate; log `target/h264-area-tests.log`
  e `target/h264-final-tests.log`.
- Driver nuovi test: avvio esplicito, capability senza effetti, modelli esclusi,
  PNG trasparente con dimensioni fisiche, limite pacchetto, backpressure, timeout,
  nessun flush per immagine, uscita con rate 30 e assenza comandi persistenti.
  Dopo l'ultima modifica stop/ack, due test streaming rieseguiti verdi.
- Test reali FFmpeg: 10 verdi inclusi i due nuovi (decoder verifica 16 immagini
  senza perdita/duplicazione e variazione colore; guasto sink provoca fallback
  locale). Test mirato encoder rieseguito dopo rifiuto dell'alpha, verde.
- Clippy all-targets -D warnings sui tre crate verdi; diff --check verde.
- Nessuna modifica UI: nessuna suite UI/e2e necessaria.

## Stato e seguito

**Prototipo separato; non integrato nel runtime Studio/Light e non selezionabile
nei pannelli.** VERSION resta 0.1.43, lo Studio aperto non viene chiuso/sostituito.
Nessun setup o pubblicazione. Si è usato solamente l'eseguibile Cargo dell'esempio
per la prova software, non una nuova build del prodotto.

Non aperti dispositivi fisici. Il CT88INCH Rev C seriale collegato non espone
questo ingresso H264 nel protocollo noto. Prima di abilitare il percorso nello
Studio occorre provarlo su un 1CBE compatibile, verificando init, orientamento,
ack, profondità coda e ripristino. Poi integrazione nel presenter esistente con
preferenza e misure per display, composizione host dei device-video e scheduler
dei grafici di produzione. Il worker per display del runtime esiste già; il
prototipo usa worker propri per misurare l'isolamento senza toccare lo Studio.
