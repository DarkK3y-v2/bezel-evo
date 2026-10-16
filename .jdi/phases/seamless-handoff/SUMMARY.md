# Phase 17: Seamless handoff — Summary  (slug: seamless-handoff)

**Status:** complete (verifica hardware a carico dell'utente)
**Tasks:** 5/5 complete, 0 blocked

## Causa del ridisegno
Chiudendo Studio verso Light, Studio non invia nulla (nemmeno END_UPDATE_BITMAP: il processo termina e la porta
si chiude) e lo schermo resta sull'ultimo fotogramma. Light però si connetteva senza riferimento (`last: None`),
quindi il suo primo `present()` era un fotogramma intero (3,7 MB sull'8.8"), che il pannello ridisegna in modo
visibile anche se il contenuto è identico.

## Executed tasks
- T-1: porta di handoff nel core (`Baseline`, `HandoffKey`, `HandedFrame::check`: schermo, firmware, orientamento,
  dimensione, età ≤ 20 s, data futura; `ScreenLink::baseline`/`seed_baseline` no-op di default; porta
  `HandoffStore`; use case `app::handoff::{hand_over, take_over}`); `FakeScreen` tiene ciò che mostra.
- T-2: driver rev C: dopo il seed il primo invio è sempre un parziale (o il keepalive di un pixel) + QUERY_STATUS;
  con `needReSend:1` il fotogramma intero parte subito nello stesso `present`. `last` è `None` mentre un invio è in
  corso: un invio fallito non lascia mai una baseline. Nessun byte di protocollo nuovo.
- T-3: `FileHandoffStore` in `bezel-power::handoff`: un file per indirizzo accanto ai lock, tmp + fsync + rename;
  letto una volta e rimosso; file danneggiati, troncati o troppo grandi ignorati.
- T-4: Studio (dopo `start_light`) toglie i link vivi dal loop, salva l'ultimo fotogramma confermato e chiude senza
  inviare altro; le impostazioni mantengono gli schermi vivi. Light (`--tray`) semina la baseline solo alla prima
  apertura, mai alle riconnessioni, e scrive nel log come è partito il primo fotogramma e quanti ms dopo Studio.
  `BEZEL_NO_HANDOFF_BASELINE=1` disattiva il seed (confronto A/B).
- T-5: sequenza documentata in `docs/reverse-engineering/protocol-turing-rev-c.md` § 21 (+ domanda aperta 14).

## Non fatto (e perché)
- Driver a rettangoli sporchi (rev A, rev B, rev D, WeAct): nessun seed. Non hanno alcuna risposta del dispositivo
  (niente QUERY_STATUS) per accorgersi di una baseline sbagliata, e alla connessione/primo fotogramma rimandano
  l'orientamento (effetto sul contenuto non documentato). TUR_USB e WCH non fanno differenze.
- Punto 2: END_UPDATE_BITMAP non viene inviato all'handoff (non lo era nemmeno prima). Se 0x86 alla nuova
  connessione azzeri lo stato interno del firmware non è documentato: rete di sicurezza = QUERY_STATUS dopo il primo
  parziale.
- Punto 3: STOP_VIDEO/STOP_MEDIA alla connessione restano: vendor e Python fermano sempre; che HELLO + 0x86 lascino
  il video e l'overlay alfa senza un nuovo PLAY_VIDEO non è stabilito. Un tema con video sul dispositivo ha quindi
  ancora un fotogramma intero dopo PLAY_VIDEO.
- Punto 4: nessuna attesa accorciata (poll di Light 100 ms, 200 ms del vendor dopo STOP_VIDEO, una risposta a
  STOP_MEDIA); intanto lo schermo mostra ancora l'ultimo fotogramma di Studio. Misura reale nel log di Light:
  `first frame after the handoff: ..., N ms after Bezel Studio let go`.

## Files modified
- crates/bezel-core: src/domain/handoff.rs, src/domain/mod.rs, src/ports/mod.rs, src/app/handoff.rs, src/app/mod.rs,
  tests/handoff.rs
- crates/bezel-devices: src/driver/turing_rev_c.rs, src/fake.rs
- crates/bezel-power: Cargo.toml, src/handoff.rs (+ Cargo.lock)
- crates/bezel-cli: src/lib.rs, src/live.rs, src/main.rs, src/theme.rs, src/light_tray.rs
- apps/bezel-studio/src-tauri: src/studio.rs, src/backend.rs, src/lib.rs, src/diag.rs
- docs/reverse-engineering/protocol-turing-rev-c.md

## Tests
- Total / Passing: 1154 / 1154 (15 ignorati: test hardware), `cargo test --workspace --locked`
- Coverage (`cargo llvm-cov --workspace --summary-only`): linee 91,89% totali; core handoff 100%,
  turing_rev_c.rs 97,75%, live.rs 98,10%, bezel-power handoff.rs 86,32%
- `cargo fmt --all` e `cargo clippy --workspace --all-targets --locked -- -D warnings` puliti

## Hardware validation
Non eseguita (per istruzione). Verifica manuale sull'8.8" rev C (COM6):
1. Avviare Light da PowerShell con gli argomenti che usa Studio (`bezel.exe run <tema> --screen COM6 --tray
   --screens-config <settings.json>`), così lo stderr resta visibile.
2. Aprire Studio (Light cede), mettere live su COM6 un tema statico salvato, senza video sul dispositivo.
3. Chiudere la finestra di Studio e guardare lo schermo: nessun ridisegno. Nel terminale: `taking over from Bezel
   Studio: ...` e `first frame after the handoff: partial (... bytes), N ms after Bezel Studio let go`.
4. Contro-prova con `BEZEL_NO_HANDOFF_BASELINE=1` nell'ambiente di Light: torna il ridisegno (primo fotogramma `full`).
5. Se dopo il passaggio restano zone sbagliate (pixel di Studio non aggiornati), il firmware non ha segnalato
   `needReSend`: disattivare con la variabile e riportarlo.
