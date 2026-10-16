# Verifica ? un solo runtime in Light

Ambito: solo il worktree `F:\dev\bezel-light`, branch `fid/light-owner`. Nessuna modifica di VERSION, installazione o sostituzione di eseguibili. Non sono stati modificati `bezel-cli/src/theme.rs` o i moduli text/catalog del renderer.

## Risultato architetturale

Light ospita `bezel-runtime::Engine`: runtime, renderer, campionamento, storici, clock monotono, transizioni, decoder host e link. Il client Studio mantiene documento, Undo e salvataggi; invia bozze revisionate, riceve immagini binarie ridotte e risposte senza pixel quando invariate. Inspector, misura, miniature e letture passano dal servizio. La chiusura del client ripristina i documenti salvati sulle scene esistenti.

Il fallback costruisce lo stesso Engine dopo il lock legacy. I proxy di controllo possono raggiungere il collegamento diretto condiviso; shutdown e passaggio A mantengono il loro ordine. Un server morto non viene sostituito silenziosamente sotto revisioni client gia confermate. Dopo un takeover legacy, un Light rimasto vivo rilegge i documenti salvati negli stessi runtime.

## Controlli automatici

- `cargo test --workspace`: 1194 superati, 15 ignorati dichiarati, nessun fallimento.
- `cargo clippy --workspace --all-targets -- -D warnings`: superato.
- `cargo fmt --check`: superato.
- `cargo llvm-cov --workspace --locked --fail-under-lines 80 --summary-only`: superato, copertura linee 90,90%.
- `npm ci`: superato, audit senza vulnerabilita.
- `npm run test:unit`: 527 superati, copertura linee 99,45%.
- `npm test -- --workers=4`: 704 superati, tutti i quattro progetti, inclusi i controlli axe.

Regressioni specifiche: attach/detach ripetuti senza nuova connessione o frame aggiuntivo; earth.mp4 avviato una volta senza Stop; storici e clock conservati; bozza non salvata ripristinata; decoder host unico con tempo crescente; miniature senza effetti sulle serie live; configurazione sensori; immagini scalate e invariate; revisione obsoleta rifiutata; errori di versione/dimensione/asset; named pipe binaria reale; client morto; SID estraneo negato dalla ACL Windows; limite runtime verificato prima di allocare il corpo; Light morto o mancante e fallback; ordine orientamento/baseline A.

I log riproducibili della verifica sono sotto `target/light-owner-*` (non versionati). Gli eseguibili di sviluppo e della copertura non sono una release installata.

## Da verificare sull'hardware

Turing 8.8 pollici Rev C su COM6, tema con `internal/video/earth.mp4` e grafici:

1. Lasciare accumulare lo storico in Light; aprire e chiudere Studio ripetutamente. Grafici continui, video senza ripartenze, nessun ridisegno completo al cambio client.
2. Trascinare/modificare elementi; chiudere scartando le modifiche. Ripristino del tema salvato con lo storico degli elementi rimasti; ripetere dopo un salvataggio.
3. Provare Return e Light on close attivo/disattivo, crash del client, arresto di Light con documento non salvato e fallback. Una vera perdita del processo puo perdere lo storico volatile, come previsto dal design.
4. Ripetere con video host e due schermi; misurare latenza durante drag, trasferimento iniziale asset e operazioni storage con progressi/cancel.

La verifica hardware non e stata eseguita da questa sessione: i test fisici restano ignorati e nessuna operazione e stata inviata a COM6.
