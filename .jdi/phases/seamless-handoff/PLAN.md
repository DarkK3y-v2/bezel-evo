# Phase 17: Seamless handoff — Plan  (slug: seamless-handoff)

## Goal
Passaggio Studio → Light senza ridisegno visibile del tema quando Light mostra lo stesso tema.

## Tasks

### T-1 — Core: porta e use case di handoff
- status: completed
- files_modified: crates/bezel-core/src/domain/handoff.rs, crates/bezel-core/src/domain/mod.rs,
  crates/bezel-core/src/ports/mod.rs, crates/bezel-core/src/app/handoff.rs, crates/bezel-core/src/app/mod.rs,
  crates/bezel-core/tests/handoff.rs, crates/bezel-devices/src/fake.rs (spostato qui da T-2: i test dei use case
  passano dal FakeScreen)
- acceptance: `Baseline`, `HandoffKey`, `HandedFrame::check` (schermo, firmware, orientamento, dimensione,
  età ≤ 20 s, futuro); `ScreenLink::baseline`/`seed_baseline` con default no-op; porta `HandoffStore`;
  `app::handoff::{hand_over, take_over}` testati con doppi in-core.

### T-2 — Devices: baseline nel driver rev C e nel FakeScreen
- status: completed
- files_modified: crates/bezel-devices/src/driver/turing_rev_c.rs
- acceptance: seed valido → primo present parziale/keepalive + QUERY_STATUS; `needReSend:1` → fotogramma
  intero nello stesso present; seed con orientamento/dimensione errati rifiutato → fotogramma intero;
  un invio fallito lascia `last = None`; `baseline()` restituisce il fotogramma confermato (round trip
  rotazione/BGRA).

### T-3 — Power: file store atomico
- status: completed
- files_modified: crates/bezel-power/Cargo.toml, crates/bezel-power/src/handoff.rs, Cargo.lock
- acceptance: `FileHandoffStore` (un file per indirizzo, tmp + fsync + rename); `take` legge e rimuove;
  file troncati/corrotti/troppo grandi → `None` senza panico; round trip testato.

### T-4 — Composizione: Studio consegna, Light riceve
- status: completed
- files_modified: apps/bezel-studio/src-tauri/src/studio.rs, apps/bezel-studio/src-tauri/src/backend.rs,
  apps/bezel-studio/src-tauri/src/lib.rs, apps/bezel-studio/src-tauri/src/diag.rs (nuovo DiagCode
  HandoffFrameNotLeft), crates/bezel-power/src/handoff.rs (`StudioSession::directory`), crates/bezel-cli/src/lib.rs, crates/bezel-cli/src/live.rs,
  crates/bezel-cli/src/main.rs, crates/bezel-cli/src/theme.rs, crates/bezel-cli/src/light_tray.rs
- acceptance: Studio (dopo `start_light`) toglie i link vivi dal loop, salva la baseline, chiude senza
  inviare nulla; Light (solo `--tray`) semina la baseline alla prima apertura, mai alle riconnessioni,
  e scrive nel log tipo/byte del primo invio e il tempo dal salvataggio di Studio.

### T-5 — Documentazione del protocollo e SUMMARY
- status: completed
- files_modified: docs/reverse-engineering/protocol-turing-rev-c.md
- acceptance: documentati 0x87 non inviato all'handoff, video del dispositivo fermato alla connessione
  (punto 3) e attese del passaggio (punto 4).
