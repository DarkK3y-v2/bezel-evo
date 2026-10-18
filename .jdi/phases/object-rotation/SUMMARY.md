# Fase object-rotation — riepilogo

Data: 2026-10-18. Worktree: `F:\dev\bezel-rotation`, branch `fid/rotation`, base `55d2d24`.

## Risultato

Implementati i sette task del piano, rispettando D-2026-10-18-object-rotation-01..08 e le scelte tecniche della fase. Gli oggetti indipendenti ruotano in senso orario intorno al centro del frame. Card, gruppi, relativi membri e forme `videoWindow` ignorano l'angolo e non espongono i controlli.

- Modello Rust e DTO: angolo normalizzato in (-180, 180], valori non finiti rifiutati; `rotation` assente dal JSON a zero. Il caricamento azzera l'angolo degli esclusi. I temi senza rotazione mantengono gli stessi byte serializzati.
- Renderer Rust: layer locale non intersecato con il canvas prima della rotazione, composizione tiny-skia bilineare con opacità; percorso a zero invariato. La cache confronta l'intero elemento. Il diff pixel esistente copre anche l'inchiostro fuori dal frame non ruotato.
- Anteprima isolata Rust e demo: canvas calcolato sul bounding box ruotato, senza tagliare gli angoli. L'isolamento di un membro conserva l'esclusione prima di rimuovere la relazione con il contenitore.
- Studio: hit-test locale, marquee sul bounding box, resize locale con angolo opposto fermo; nessun aggancio dei bordi durante il resize ruotato. Spostamento, allineamento e campi X/Y/W/H continuano a usare il frame.
- Campo Rotazione con decimali e suffisso in gradi; maniglia `rotate-handle` / `data-rotate` separata dalle otto maniglie esistenti. Shift aggancia a 15°; un trascinamento equivale a un Annulla. La maniglia supporta anche frecce, Shift+frecce e Home.
- Copia/incolla/duplica conservano l'angolo. Raggruppare o inserire in Card lo azzera; Annulla lo ripristina.
- Fixture condiviso `crates/bezel-core/tests/fixtures/rotation-parity.json`: geometria a 30°, campioni di inchiostro e trasparenza, opacità 1 e 0,5; letto da test Rust, JS e Playwright.

## Dettagli emersi in implementazione

- `insp.rotation` e la preesistente `framing.rotation` sono alias della chiave canonica `common.rotation`, con traduzioni en/pt-BR/it: il controllo D-14 vieta la duplicazione della stessa frase nelle tre lingue. `insp.rotateHandle` appartiene all'area inspector. Il controllo delle chiavi statiche ora risolve gli alias con la stessa funzione del traduttore.
- Il resize ruotato passa `precise: true` a `setFrame`: l'arrotondamento delle coordinate a ogni movimento farebbe slittare il punto opposto. Gli altri chiamanti mantengono l'arrotondamento precedente.
- I test del renderer comprendono testo, grafico, spettro, immagine, trasparenza, cache/percorso a zero, esclusioni e sorgenti inizialmente fuori canvas. Non si richiede identità pixel globale fra canvas 2D e tiny-skia; la verifica segue i campioni del fixture, come stabilito dal piano.

## Verifiche

- `cargo check --workspace --all-targets`: passato su Windows.
- Test mirati di modello/DTO, renderer e anteprima: passati.
- `cargo clippy -p bezel-core -p bezel-themes -p bezel-render -p bezel-runtime -p bezel -p bezel-studio --all-targets -- -D warnings`: passato; `bezel` è il nome Cargo del pacchetto CLI.
- `cargo fmt --all --check`: passato.
- Test mirati JS di rotazione, geometria, store, demo backend, i18n e controlli statici: passati.
- Nuovo spec `object-rotation`: 20/20 sui quattro progetti Playwright, controlli axe inclusi. Dopo l'aggiunta della prova di resize e dello screenshot, rieseguiti solo i casi interessati: 12/12. Verifica finale dello spec: 20/20.
- Regressioni mirate clipboard, alignment-019 e inspector-preview: 28/28.
- Suite unitaria UI con copertura (`npm run test:unit`), eseguita una volta: 548/548; righe 99,46%. `rotation.js` e `geometry.js`: 100% righe.
- Suite Rust e copertura del workspace, eseguite insieme una volta con `cargo llvm-cov --workspace --locked --fail-under-lines 80 --summary-only`: 1238 passati, 0 falliti, 16 ignorati; righe 90,45%.
- Suite Playwright completa (`node scripts/e2e-slot.mjs`), eseguita una volta: 744/744 in 13,7 minuti, nessun fallimento.

## Evidenza visiva e consegna

Evidenza allegata: [simulatore a 30°](rotation-30-simulator.png).

Lo spec genera e allega uno screenshot del simulatore con testo, grafico e spettro ruotati a 30°. Verificato visivamente dall'agente; resta la conferma umana richiesta dal DoD manuale. Nessuna prova sul device fisico.

Un commit per task, Conventional Commits con scope `object-rotation` e trailer ChatGPT. Nessun push, merge, release, modifica a `VERSION` o installazione in `dist`. Nessuna modifica a `F:\dev\bezel`.
