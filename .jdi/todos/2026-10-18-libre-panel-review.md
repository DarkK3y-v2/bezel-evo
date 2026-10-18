# Valutazione Libre Panel per Bezel

Analisi richiesta dall'utente il 18 ottobre 2026. Nessuna modifica al prodotto,
nessuna build o installazione. Studio 0.1.42 resta la versione locale consegnata.

Repository: https://github.com/syntensa/libre-panel
Revisione letta: `b25337ea9395243b3cb6b36c7efd34f0d2964423`.
Copia di sola consultazione in `target/research/libre-panel`; non eseguiti script,
installer, servizi o comandi verso i display del progetto esterno.

## Opportunità concrete, in ordine proposto

1. **Movimento nativo legato ai dati.** `render/fan.py` integra l'angolo dalla
   velocità visuale e dal tempo, con inerzia, arresto a zero e stato assente
   attenuato. Non riproduce gli RPM fisici, che produrrebbero aliasing.
   `render/motion.py` mantiene molle, dissolvenze delle soglie e storie per sensore
   attraverso i cambi tema. Le storie interpolate sono dati di visualizzazione,
   non campioni reali aggiuntivi. Bezel ha già smoothing, storico e spectrum:
   il delta utile sono proprietà animate e comportamenti reattivi riutilizzabili,
   oltre alle GIF decorative dei nuovi temi.
2. **Palette semantiche e dinamiche.** `docs/THEMES.md`, `render/cover.py`:
   riferimenti di ruolo e colore significativo estratto dalla copertina, con
   fallback se grigia. Bezel ha già una palette di campioni copiata alla scelta
   (`apps/bezel-studio/src/palette.js`): non equivale a riferimenti vivi.
   Proposta: ruoli condivisi e override locali, poi accento da media.
3. **Notifiche temporanee.** `services/notices.py`: volume, brano, soglia,
   priorità, riarmo e soppressione se il contenuto è già presente. Per Bezel:
   livello sovrapposto al tema, con destinazione per display o profilo;
   evitare notifiche duplicate sui due schermi. Non un ulteriore cambio profilo.
4. **Moduli adattivi.** `theme/modules.py`: stesso blocco CPU mostra carico,
   poi temperatura/potenza e infine grafico secondo lo spazio. `theme/adapt.py`
   conserva proporzioni e rialloca celle; l'adattamento è un punto di partenza
   da rifinire. Interessante per libreria di componenti Wide/Round coordinati;
   non basta scalare automaticamente un tema largo dentro un cerchio.
5. **Gaming più completo.** `sensors/presentmon.py`: FPS, frametime, 1% low su
   30 secondi, picchi e stima del limite CPU/GPU/cap. Bezel ha già `gpu.fps`
   tramite memoria condivisa RTSS (`crates/bezel-sensors/src/fps/mod.rs`),
   dichiarato non ancora validato su hardware. Il delta è un provider opzionale
   PresentMon e nuove metriche. Richiede gestione processo, permessi Windows,
   dipendenza e prove reali, non semplice importazione Python.
6. **Automazioni estese.** `services/autopilot.py`: microfono, fasce orarie,
   carico medio oltre soglia e condizioni combinate con tempi di stabilità.
   Bezel possiede già profili multischermo, app/media, priorità e ritorno:
   estendere quel modello invece di aggiungere un secondo sistema.
7. **Streaming H.264.** `devices/turzx_video.py`, `docs/HARDWARE.md` e
   `docs/protocol/turzx-usb.md`: scena intera nel decoder, PNG trasparente sopra,
   comando 121 per frame e 122 per profondità coda. 50 fps documentati sul 9.2
   USB; altri protocolli e modelli hanno limiti diversi. Verificare esatti
   dispositivi/firmware e impatto encoder prima di promettere benefici. Nessuna
   prova hardware compiuta durante questa analisi.

## Direzione grafica

Visionati i riferimenti `docs/images/lumen.png` ed `encore.png` e il codice
`render/look.py`: bordi illuminati, luce globale, passaggio luminoso su eventi,
gerarchia tipografica. Sono spunti per proprietà e materiali nativi, mantenendo
il vincolo utente di grafica senza foto e conservando i temi approvati.

## Riutilizzo

Python/Pillow/NumPy contro Rust/Tauri: algoritmi, protocolli e modelli sono
trasferibili; i moduli non sono direttamente collegabili. Entrambi dichiarano
GPL-3.0-or-later (Libre Panel anche in NOTICE.md; Bezel Cargo.toml).
Per eventuali porzioni o asset adottati registrare origine, copyright e licenze;
font, helper e dipendenze hanno condizioni proprie documentate nei notice.
Questa analisi non importa codice o asset nel prodotto.

Proposta per il prossimo lavoro, non ancora autorizzata come implementazione:
animazioni reattive native e palette di ruolo; poi OSD multischermo e metriche
gaming. Streaming da trattare come ricerca hardware separata.
