# profiles-dialog-ux — riepilogo

Richiesta dell'utente (20 ottobre 2026): animazioni dei profili troppo
scattose, una prova della transizione lanciabile dal dialogo, e il dialogo
«Profili e automazioni» rifatto secondo il mockup
`https://claude.ai/artifact/7muP7mTQAwBH8diy2AWZ6p` (`project/Profiles.dc.html`).
Formato della configurazione invariato.

## Fatto

- **Fluidità** (`4a7bb69`): le coperture chiedevano un fotogramma ogni 50 ms
  (20/s, circa 6 passi per metà con 600 ms). Ora ogni 16 ms, sempre al ritmo
  del presenter dello schermo (`COVER_FRAME` in `crates/bezel-runtime/src/lib.rs`).
  Il 3,5 resta limitato dalla sua velocità di invio.
- **Prova della transizione** (`4a7bb69`, `e1d7816`): `RuntimeOp::PreviewCover`
  chiude e riapre la copertura sugli schermi live senza applicare temi né
  salvare; comando Tauri `preview_transition`, `bridge.previewTransition`,
  pulsante ▶ nel piede del dialogo. Nella demo la richiesta viene solo
  registrata (`window.demoTransitionPreviews`).
- **Logica estratta** (`fc03810`): `src/profiles-model.js` — modalità ↔
  `automatic`/`manual`/`defaultProfile`, riassunto delle regole, icona,
  rimozione, primo profilo incompleto prima del salvataggio.
- **Dialogo** (`3b1b4f5`): intestazione con sottotitolo; due schede radio native
  Automatico (con «Se nessuna regola è attiva») e Manuale (Temi di base o un
  profilo; ex «Default» = Manuale + Temi di base), la select della modalità non
  attiva disabilitata; elenco con «Temi di base» in cima, profili con icona e
  riassunto della prima regola (nessuna priorità nell'elenco), «Nuovo profilo»;
  dettaglio con nome, schede tema per display con miniatura orientata e
  messaggio per display scollegato, regole come frasi con controlli dentro,
  nota sulla priorità, «Elimina profilo» con conferma in-app; piede con
  effetto, durata in ms, quattro frecce `aria-pressed`, ▶ prova, «?» che
  mostra `profiles.transitionHint`, Annulla e Salva. Esc = Annulla.
  «Temi selezionati» → «Temi di base» nelle tre lingue.

## Verifiche

- Unità: `tests/ui/profiles-model.test.mjs` (6), i18n/bridge/demo (106 in tutto).
- e2e `tests/e2e/profiles.spec.mjs`: 16 casi su quattro progetti (lingua e
  tema chiaro/scuro), inclusi Automatico → Manuale + profilo, salvataggio e
  riapertura, prova della transizione, eliminazione con conferma, profilo
  incompleto mostrato prima del salvataggio, due display, axe senza
  violazioni gravi. Screenshot `dist/profiles-editor.png`,
  `dist/profiles-two-displays.png`.
- Rust: test di `bezel-runtime` (51) e il test del backend Studio
  `a_transition_preview_is_checked_and_never_saved`; clippy senza avvisi.
- Nessuna prova visiva sull'hardware della nuova fluidità.

## Lavoro futuro (non inventato)

- **Stato «attivo ora»** (pallino verde, «Attivo ora», «vera ora» sulla
  regola): il runtime tiene il profilo scelto in `Selection.active`
  (`crates/bezel-runtime/src/profiles.rs`), ma né `Overview` né il bridge lo
  espongono, e Light lo calcola in un altro processo. Serve un canale che
  riporti a Studio il profilo attivo e la regola che lo tiene; fino ad allora
  gli indicatori sono esclusi.
- La voce della tray resta «Default» (etichette native in
  `profiles::menu_labels`): da allineare a «Temi di base» se l'utente lo vuole.
