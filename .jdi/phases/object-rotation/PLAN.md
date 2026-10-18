# Phase 20: Rotazione degli oggetti — Plan  (slug: object-rotation)

## Goal
Ogni oggetto di un tema (esclusi video di sfondo, Card e loro membri, gruppi e loro membri) si ruota di un angolo libero, in Studio e sul device, con lo stesso risultato nei due renderer.

## Locked decisions (da CONTEXT.md)
- D-2026-10-18-object-rotation-01: esclusi video di sfondo, Card (+membri), gruppi (+membri); per loro il campo non compare.
- D-2026-10-18-object-rotation-02: campo "Rotazione" (gradi liberi) + maniglia sul canvas; Shift = scatti di 15°.
- D-2026-10-18-object-rotation-03: allineamento, aggancio e X/Y/W/H sul `frame` non ruotato; il bbox ruotato serve a selezione/hit-test, dirty rect, avviso fuori schermo.
- D-2026-10-18-object-rotation-04: ruota tutto il contenuto; fit-to-content sul riquadro non ruotato.
- D-2026-10-18-object-rotation-05: `Element.rotation: f32` in gradi, centro = centro del `frame`, normalizzato in (-180, 180], default 0.
- D-2026-10-18-object-rotation-06: DTO scrive `rotation` solo se ≠ 0 (come D-AS-11).
- D-2026-10-18-object-rotation-07: Layer ritagliato sul riquadro, rotazione in composizione (bilineare, con opacità); bbox ruotato nei dirty rect; demo-render.js e anteprima isolata fanno lo stesso.
- D-2026-10-18-object-rotation-08: hit-test e maniglie nel sistema locale; copia/incolla/duplica tengono l'angolo; un trascinamento = un Annulla; i18n en/pt-BR/it.

## Scelte del piano (da confermare in verifica)
- Verso: angolo positivo = orario sullo schermo (y verso il basso), come `Transform::from_rotate` di tiny-skia e `ctx.rotate` del canvas 2D.
- Esclusi: oltre a Card/membri/gruppi/membri, anche le forme `videoWindow` (sono il "buco" sul video di sfondo; il video di sfondo vero è `theme.background`, non un elemento). `Element::applied_rotation()` restituisce 0 per tutti gli esclusi in entrambi i renderer; il caricamento DTO azzera l'angolo degli esclusi (nessun errore).
- Raggruppare o mettere in una Card un oggetto ruotato ne azzera la rotazione (Annulla la ripristina): il campo per i membri non esiste, l'angolo resterebbe non modificabile.
- Ridimensionare un oggetto ruotato: maniglie nel sistema locale, l'angolo opposto resta fermo sullo schermo; l'aggancio dei bordi si salta se `rotation ≠ 0` (i bordi del `frame` non coincidono con quelli visibili). Lo spostamento aggancia sul `frame` come oggi (D-03).
- Dirty rect: nascono da un diff pixel dei frame interi (`bezel_core::domain::frame::dirty_rects`, tile 16 px), quindi coprono per costruzione ciò che il renderer disegna. Il DoD diventa: il renderer non ritaglia l'oggetto ruotato sul `frame` né sul canvas prima della rotazione, e `dirty_rects` copre tutti i pixel del bbox ruotato con inchiostro.
- Parità JS-Rust: un confronto pixel dell'immagine intera non è realizzabile (canvas 2D del browser e tiny-skia rasterizzano testo e bordi AA in modo diverso; demo-render è dichiaratamente approssimato). Si declassa a parità geometrica + campioni pixel su un fixture condiviso `crates/bezel-core/tests/fixtures/rotation-parity.json`: canvas 160x120, rettangolo rosso opaco `frame {x:50,y:45,width:60,height:30}`, `rotation: 30`, variante con `opacity: 0.5`; bbox ruotato atteso (tolleranza 1e-3) e punti campione a ≥3 px dai bordi ruotati: inchiostro (almeno uno fuori dal `frame` non ruotato) e vuoto (almeno uno dentro il `frame` non ruotato). Inchiostro: canali ±3, alfa 255 (o 128±3 con opacità 0.5); vuoto: alfa ≤3. Lo leggono il test core, il test Rust di render, il test JS e lo spec e2e (pixel reali del canvas 2D).

## Tasks

### Wave 1

#### T-1: Campo `rotation` nel modello e nel DTO, geometria condivisa e fixture
- **Specialist:** jdi-doer-bezel
- **Files modified:** `crates/bezel-core/src/domain/rotation.rs` (nuovo: `normalize_degrees`, `rotated_bounds(BoxF, f32) -> BoxF`, `Element::applied_rotation()`), `crates/bezel-core/src/domain/mod.rs`, `crates/bezel-core/src/domain/theme.rs` (campo `rotation`), `crates/bezel-core/tests/fixtures/rotation-parity.json` (nuovo), `crates/bezel-themes/src/dto.rs` (`#[serde(default, skip_serializing_if = "is_zero_f32")] rotation: f32`; da DTO: non finito = errore `invalid rotation`, normalizza, 0 per gli esclusi), `crates/bezel-themes/src/native.rs` (test) e tutti i letterali `Element { .. }` (`rotation: 0.0`): `crates/bezel-themes/src/import/mod.rs`, `crates/bezel-render/src/testkit.rs`, `crates/bezel-render/src/renderer.rs` (solo letterali nei test), `crates/bezel-render/tests/support/showcase.rs`, `crates/bezel-runtime/src/tests.rs`, `crates/bezel-runtime/src/element_preview.rs` (solo helper `shape` dei test), `crates/bezel-core/src/app/card_timer.rs`, `crates/bezel-core/src/domain/{spectrum,transition,theme}.rs`, `crates/bezel-core/tests/runtime_{cards,sensors,animation,transitions,editor}.rs`, `crates/bezel-cli/src/{live,theme}.rs`, `crates/bezel-cli/tests/{runtime,animation}.rs`, `apps/bezel-studio/src-tauri/src/{backend,studio,element_preview}.rs`, `apps/bezel-studio/src-tauri/src/gifs/tests.rs`
- **Acceptance:**
  - `normalize_degrees`: 180→180, -180→180, 540→180, 190→-170, -0.0→0.0; `rotated_bounds` a 0°, 90°, 45° e sui valori del fixture (30°).
  - Un tema con rotazione 0 si serializza byte-identico a prima (nessuna chiave `rotation`); uno con 200° fa round-trip come -160°; `NaN` viene rifiutato; una Card/membro/gruppo/videoWindow con rotazione carica a 0.
  - `cargo check --workspace --all-targets` passa su Windows.
- **Dependencies:** none
- **Test:** `cargo test -p bezel-core --lib domain::rotation::tests` ; `cargo test -p bezel-themes --lib native::tests::rotation_zero_omitted_and_old_themes_unchanged -- --exact` ; `cargo test -p bezel-themes --lib native::tests::rotation_roundtrip_normalizes_and_rejects_non_finite -- --exact`
- **Status:** completed

### Wave 2 (parallel-eligible)

#### T-2: Rotazione in composizione nel renderer Rust
- **Specialist:** jdi-doer-bezel
- **Files modified:** `crates/bezel-render/src/renderer.rs`, `crates/bezel-render/src/composite.rs`, `crates/bezel-render/src/lib.rs` (`#[cfg(test)] mod rotation_tests;`), `crates/bezel-render/src/rotation_tests.rs` (nuovo)
- **Acceptance:**
  - Con `applied_rotation() ≠ 0` il Layer copre il `frame` intero (arrotondato, non intersecato col canvas, lato limitato come il canvas) e si compone con `Transform::from_rotate_at(angle, cx, cy)`, campionamento bilineare e l'opacità dell'elemento sull'area `rotated_bounds ∩ canvas`; a 0° il percorso attuale resta identico (stessi byte, nessun ricampionamento). La cache dei layer resta valida (chiave = elemento intero, angolo compreso).
  - Testo, grafico, spettro e immagine ruotano col contenuto (D-04); Card, membri, gruppi e videoWindow ignorano l'angolo.
  - Il campione del fixture a 30° (opaco e opacità 0.5) è rispettato.
- **Dependencies:** T-1
- **Test:** `cargo test -p bezel-render rotation` (test: `rotation_zero_keeps_pixels_identical`, `rotation_90_turns_box_around_center`, `rotation_45_blends_with_opacity`, `rotation_30_matches_parity_fixture`, `rotation_turns_text_graph_and_spectrum_content`, `rotation_ignored_for_cards_groups_and_video_windows`) ; `cargo test -p bezel-render dirty_rotated` (test `dirty_rotated_covers_rotated_bbox`: inchiostro negli angoli del bbox ruotato fuori dal `frame`, tutti coperti da `dirty_rects(blank, frame)`)
- **Status:** pending

#### T-3: Anteprima isolata dell'inspector (runtime) sul bbox ruotato
- **Specialist:** jdi-doer-bezel
- **Files modified:** `crates/bezel-runtime/src/element_preview.rs`
- **Acceptance:**
  - `bounds()` usa `rotated_bounds(frame, applied_rotation())`: un elemento ruotato ha un canvas grande quanto il suo bbox ruotato e nessun angolo tagliato; per angolo 0 il risultato è identico a oggi.
- **Dependencies:** T-1
- **Test:** `cargo test -p bezel-runtime --lib element_preview::tests::a_rotated_element_gets_a_canvas_of_its_rotated_box -- --exact`
- **Status:** pending

#### T-4: Geometria e store dello Studio (JS)
- **Specialist:** jdi-doer-bezel
- **Files modified:** `apps/bezel-studio/src/editor/rotation.js` (nuovo: `normalizeDegrees`, `rotatePoint`, `rotatedCorners`, `rotatedBounds`, `toLocal`, `containsRotated`, `snapAngle(deg, 15)`, `canRotate(theme, e)`), `apps/bezel-studio/src/editor/geometry.js` (`hitTest` nel sistema locale, `marqueeSelect` sul bbox ruotato, resize locale con angolo opposto fermo), `apps/bezel-studio/src/editor/store.js` (azione `rotate {id, rotation}` normalizzata, rotazione 0 = chiave rimossa; `groupSelection`/`attachCard` azzerano la rotazione), `apps/bezel-studio/tests/ui/rotation.test.mjs` (nuovo)
- **Acceptance:**
  - Stessi valori del core: `normalizeDegrees` e `rotatedBounds` coincidono con il fixture letto da `crates/bezel-core/tests/fixtures/rotation-parity.json` (`readFileSync` relativo a `import.meta.url`); `containsRotated` dà inchiostro/vuoto come i punti campione.
  - `canRotate` è falso per Card, membri di Card, gruppi, membri di gruppo, videoWindow; `snapAngle` aggancia a multipli di 15°.
  - `beginGesture` + più `rotate` + `endGesture` = un solo passo di `undo`; `duplicate`/`paste` mantengono `rotation`; raggruppare un oggetto ruotato lo porta a 0 e `undo` lo ripristina.
- **Dependencies:** T-1 (fixture)
- **Test:** `node --test tests/ui/rotation.test.mjs` (da `apps/bezel-studio`) ; `node --test tests/ui/editor-geometry.test.mjs tests/ui/editor-store.test.mjs` (non regressione)
- **Status:** pending

### Wave 3 (parallel-eligible)

#### T-5: Renderer demo e anteprima demo
- **Specialist:** jdi-doer-bezel
- **Files modified:** `apps/bezel-studio/src/demo-render.js`, `apps/bezel-studio/src/demo-backend.js`, `apps/bezel-studio/tests/ui/demo-backend.test.mjs`
- **Acceptance:**
  - `renderApprox` disegna ogni elemento con `canRotate` e angolo ≠ 0 dentro `save/translate(cx,cy)/rotate/translate(-cx,-cy)`, ritagliato sul `frame` (anche nel ramo con `fade` e nello spettro); esclusi e angolo 0 invariati.
  - `demoIsolate` dimensiona il canvas sul bbox ruotato come `element_preview::isolate` (T-3).
- **Dependencies:** T-4
- **Test:** `node --test --test-name-pattern="rotated" tests/ui/demo-backend.test.mjs` (test nuovo `demoIsolate: a rotated element gets a canvas of its rotated box`); i pixel del canvas 2D si provano nello spec e2e (T-7)
- **Status:** pending

#### T-6: Canvas e inspector: maniglia, campo Rotazione, i18n
- **Specialist:** jdi-doer-bezel
- **Files modified:** `apps/bezel-studio/src/ui/canvas.js`, `apps/bezel-studio/src/ui/inspector.js`, `apps/bezel-studio/src/styles/shell.css`, `apps/bezel-studio/src/i18n/areas/inspector.js`
- **Acceptance:**
  - `sel-box`, `hover-box` e le 8 maniglie seguono l'angolo (CSS `transform: rotate()` attorno al centro, punti da `rotatedCorners`); maniglia di rotazione nuova (classe `rotate-handle`, `data-rotate`, NON classe `.handle` né `data-h`, per non rompere gli spec che contano/usano le 8 maniglie) sopra il lato `n` nel sistema locale, stile delle maniglie esistenti; trascinamento = `beginGesture`/`rotate`/`endGesture`, Shift = `snapAngle(…, 15)`; nessuna maniglia per esclusi e oggetti bloccati.
  - Avviso fuori schermo (`off-canvas-box`) e `editingRoom` usano il bbox ruotato; aggancio dello spostamento invariato sul `frame`.
  - Inspector: campo "Rotazione" (gradi, decimali ammessi, suffisso `°`, normalizzato al commit) nella sezione geometria accanto a X/Y/W/H, assente se `!canRotate`; chiavi nuove `insp.rotation` e `insp.rotateHandle` (etichetta/`aria-label` della maniglia) in en, pt-BR, it, nessuna stringa fissa.
- **Dependencies:** T-4
- **Test:** `node --test tests/ui/i18n.test.mjs tests/ui/static-guards.test.mjs` (da `apps/bezel-studio`); comportamento nello spec e2e (T-7)
- **Status:** pending

### Wave 4

#### T-7: Spec e2e `object-rotation`
- **Specialist:** jdi-doer-bezel
- **Files modified:** `apps/bezel-studio/tests/e2e/object-rotation.spec.mjs` (nuovo, con il `test` e gli helper di `tests/e2e/helpers.mjs`, controllo axe incluso)
- **Acceptance:** cinque test, tutti verdi in ogni progetto Playwright:
  - `rotation field and handle turn an object, Shift snaps to 15° and one drag is one Undo`
  - `a click hits the rotated box, not the unrotated corners`
  - `no rotation field or handle for cards, their members, groups, group members and video windows`
  - `copy, paste and duplicate keep the angle`
  - `demo render and inspector preview match the Rust parity fixture at 30°` (fixture letto con `fs` lato Node e passato a `page.evaluate`; pixel di `renderApprox` e del frame di `renderElement` sui punti campione)
- **Dependencies:** T-5, T-6
- **Test:** `node scripts/e2e-slot.mjs tests/e2e/object-rotation.spec.mjs` (da `apps/bezel-studio`); singolo caso: `node scripts/e2e-slot.mjs tests/e2e/object-rotation.spec.mjs -g "copy, paste and duplicate"`; non regressione mirata: `node scripts/e2e-slot.mjs tests/e2e/clipboard.spec.mjs tests/e2e/alignment-019.spec.mjs tests/e2e/inspector-preview.spec.mjs`
- **Status:** pending

## Execution
- Total tasks: 7
- Waves: 4 (1 → 3 → 2 → 1)
- Estimated parallel speedup: 1.75x
- Commit: uno per task, `feat(object-rotation): …` / `test(object-rotation): …`, con riferimento al D-XX e trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Files modified (all tasks)
- `crates/bezel-core/src/domain/{rotation.rs,mod.rs,theme.rs,spectrum.rs,transition.rs}`, `crates/bezel-core/src/app/card_timer.rs`, `crates/bezel-core/tests/fixtures/rotation-parity.json`, `crates/bezel-core/tests/runtime_*.rs`
- `crates/bezel-themes/src/{dto.rs,native.rs,import/mod.rs}`
- `crates/bezel-render/src/{renderer.rs,composite.rs,lib.rs,rotation_tests.rs,testkit.rs}`, `crates/bezel-render/tests/support/showcase.rs`
- `crates/bezel-runtime/src/{element_preview.rs,tests.rs}`
- `crates/bezel-cli/src/{live.rs,theme.rs}`, `crates/bezel-cli/tests/{runtime.rs,animation.rs}`
- `apps/bezel-studio/src-tauri/src/{backend.rs,studio.rs,element_preview.rs,gifs/tests.rs}`
- `apps/bezel-studio/src/editor/{rotation.js,geometry.js,store.js}`, `apps/bezel-studio/src/{demo-render.js,demo-backend.js}`, `apps/bezel-studio/src/ui/{canvas.js,inspector.js}`, `apps/bezel-studio/src/styles/shell.css`, `apps/bezel-studio/src/i18n/areas/inspector.js`
- `apps/bezel-studio/tests/ui/{rotation.test.mjs,demo-backend.test.mjs}`, `apps/bezel-studio/tests/e2e/object-rotation.spec.mjs`

## Test requirements
- Durante il lavoro: solo i comandi del task (test mirati; un test instabile si riesegue da solo).
- DoD: `cargo test -p bezel-themes rotation_zero_omitted` ; `cargo test -p bezel-themes rotation_roundtrip` ; `cargo test -p bezel-render rotation` ; `cargo test -p bezel-render dirty_rotated` ; `node --test tests/ui/i18n.test.mjs` ; `node --test tests/ui/rotation.test.mjs` (parità geometrica) ; `node scripts/e2e-slot.mjs tests/e2e/object-rotation.spec.mjs` (parità pixel sui campioni, UI, copia/incolla).
- Una volta, prima del push / in verifica: `cargo test -p bezel-core -p bezel-themes -p bezel-render -p bezel-runtime` + suite completa e copertura ≥ 80% righe (PROJECT.md).
- Manuale: device o simulatore con testo, grafico e spettro a 30°, screenshot allegato.
