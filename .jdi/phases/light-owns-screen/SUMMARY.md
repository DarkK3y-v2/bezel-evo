# Phase 18: Light owns screen — Summary  (slug: light-owns-screen)

**Status:** complete (merge `c913641` su `windows-improvements`; verifica hardware principale fatta dall'utente)
**Tasks:** fase eseguita fuori dal loop JDI (ChatGPT, branch `fid/light-owner`): niente CONTEXT.md/PLAN.md;
il contesto è D-2026-10-16-light-owns-screen-31 e `DESIGN.md`. Nessun task bloccato.

Riepilogo consolidato il 2026-10-16 dai documenti della fase (`DESIGN.md`, `VERIFICA.md`, `VALIDATION.md`,
`DIAGNOSTICS-REGRESSION.md`, `SCHEDULING-VALIDATION.md`), che restano il dettaglio.

## Executed tasks
- B — Light proprietario dei link: porte di proprietà persistente, canale locale autenticato (named pipe con
  SID/DACL, rifiuto dei client remoti, limiti prima dell'allocazione), Studio come client con fallback diretto
  sotto il lock legacy. Commit: c8399d9, d294ed2, acc8ce3, 9e3278c, f732e69, 3210eda, b66761b, 5d9b8fb.
- D-31 — un solo motore in Light (`bezel-runtime::Engine`): runtime, orologio monotono, sensori, storici dei
  grafici, transizioni, decoder host e disegno vivono in Light; Studio tiene documento, Annulla e salvataggio,
  invia bozze revisionate e riceve immagini. Chiudendo senza salvare Light torna al tema salvato senza azzerare
  storici e orologi. Il fallback costruisce lo stesso Engine. Commit: aa011a7, 09052e1, 6d868a5, 1e565a3,
  a9d652f, ba20c1d.
- Correzioni dopo la prima prova su hardware: risposte grandi (catalogo sensori > 64 KiB) nel payload binario
  invece di far cadere la pipe e passare al fallback; log diagnostici condivisi con rotazione (Preferenze →
  debug, "Apri cartella dei log"); trasferimenti reali del rev A (full/partial/unchanged); campionamento
  separato e un worker per schermo; tempo di render misurato mostrato in Studio. Commit: 09f062d, a6d96a5,
  d574f6a, d0395b7, bbab0d1, 6ab6616, 98e67fe.
- Il fix A di `seamless-handoff` resta solo nel percorso di fallback.

## Blocked tasks
Nessuno.

## Files modified
- `crates/bezel-runtime` (nuovo motore condiviso), `crates/bezel-power` (canale, lock, handoff), `crates/bezel-cli`
  (Light), `crates/bezel-devices` (statistiche di trasferimento rev A/rev C), `crates/bezel-core` (porte di
  proprietà), `apps/bezel-studio/src-tauri` (client, fallback, diagnostica) e moduli UI di debug/statusbar.
  Elenco: `git diff --stat c1757de c913641` (l'intervallo include anche 6cb9b82/0a8fc7f e i documenti D-32
  della fidelity, entrati nello stesso branch).

## Tests
Numeri riportati dai documenti della fase (non rieseguiti in questo riepilogo):
- `VALIDATION.md` (D-31, suite completa): Rust 1194 superati, 15 ignorati (hardware); `cargo llvm-cov` 90,90%
  linee; UI unit 527, copertura 99,45%; Playwright 704 superati nei quattro progetti, axe incluso.
- `DIAGNOSTICS-REGRESSION.md` e `SCHEDULING-VALIDATION.md`: test mirati dei crate toccati (942, poi 191 + 222
  Studio lib + 528 UI unit), clippy `-D warnings` e fmt puliti.
- Flake noto di Playwright su zoom con la rotella/drag sotto carico (vedi todo): rieseguito da solo passa.

## Hardware validation
Eseguita dall'utente il 2026-10-16 sul Turing 8.8" Rev C (COM6) con `internal/video/earth.mp4` e grafici,
aprendo e chiudendo Studio: nessun ridisegno, grafici e video continui, nessun fallback, letture regolari.

Non riportati dall'utente (restano aperti, non bloccanti per la decisione D-31):
- prova con un secondo account Windows che la pipe del primo utente non sia accessibile (la ACL è coperta da un
  test automatico con token ristretto);
- standby/shutdown/sospensione con Light proprietario, crash forzato di Light con bozza non salvata e fallback
  motivato;
- due schermi insieme (8.8" + 3.5" rev A su COM3) con invii lenti, CPU e memoria prima/dopo.
