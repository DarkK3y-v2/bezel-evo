# Phase 20: Rotazione degli oggetti — Context  (slug: object-rotation)

## Goal
Ogni oggetto di un tema (con le esclusioni sotto) si può ruotare di un angolo libero, in Studio e sul device, con lo stesso risultato nei due renderer.

## Locked decisions
- D-2026-10-18-object-rotation-01 (utente): si ruotano tutti gli oggetti TRANNE il video di sfondo del device, le Card (e i loro membri) e i gruppi. Per gli esclusi e per i membri di Card/gruppo il campo Rotazione non compare.
- D-2026-10-18-object-rotation-02 (utente): campo "Rotazione" nell'inspector con angolo libero (gradi) più maniglia di rotazione sul canvas; Shift durante il trascinamento aggancia a 15°. La maniglia segue lo stile delle maniglie esistenti del canvas (il mockup non la disegna).
- D-2026-10-18-object-rotation-03 (utente): allineamento, aggancio e campi X/Y/W/H lavorano sul riquadro NON ruotato (`frame`). Il riquadro che contiene l'oggetto ruotato serve solo per selezione/hit-test, dirty rect e avviso di uscita dallo schermo.
- D-2026-10-18-object-rotation-04 (utente): ruota tutto il contenuto dell'elemento (testo, grafici, spettro, immagini). Il fit-to-content resta calcolato sul riquadro non ruotato.
- D-2026-10-18-object-rotation-05 (tecnica): `Element` (crates/bezel-core/src/domain/theme.rs) riceve `rotation: f32` in gradi, centro = centro del `frame`, normalizzato in (-180, 180], default 0.
- D-2026-10-18-object-rotation-06 (tecnica): DTO (crates/bezel-themes/src/dto.rs, deny_unknown_fields) scrive il campo solo se diverso da zero (skip_serializing_if + default), come D-AS-11: i temi senza rotazione restano identici e le versioni vecchie li aprono.
- D-2026-10-18-object-rotation-07 (tecnica): nel renderer (crates/bezel-render) l'elemento si disegna nel suo Layer ritagliato sul riquadro; la rotazione si applica in composizione (trasformazione attorno al centro, campionamento bilineare, con l'opacità). Il bounding box ruotato alimenta i dirty rect. demo-render.js e l'anteprima isolata dell'inspector applicano la stessa trasformazione.
- D-2026-10-18-object-rotation-08 (tecnica): canvas con hit-test e maniglie nel sistema locale dell'elemento; copia/incolla/duplica mantengono l'angolo; un trascinamento di rotazione = un solo passo di Annulla; chiavi i18n in en, pt-BR, it con parità.

## Canonical refs
- .jdi/todos/2026-10-17-rotazione-oggetti.md
- D-2026-10-16-studio-redesign-fidelity-27 (solo Windows; test mirati)
- D-AS-11 (campi DTO opzionali non scritti a valore di default)

## Out of scope
- Rotazione di gruppi, Card e relativi membri, e del video di sfondo (vedi Rinvii).
- Aggancio a scatti fissi di 90° (solo Shift = 15°).

## Definition of Done

### Auto-verifiable
- [ ] Un tema con rotazione 0 si serializza senza il nuovo campo, identico a prima.
      **Verify:** `cargo test -p bezel-themes rotation_zero_omitted`
      **Source:** CONTEXT
- [ ] Un tema con rotazione diversa da 0 fa round-trip senza perdite e l'angolo è normalizzato in (-180, 180].
      **Verify:** `cargo test -p bezel-themes rotation_roundtrip`
      **Source:** CONTEXT
- [ ] Il renderer ruota l'elemento attorno al centro del `frame` rispettando l'opacità (golden 0°, 90°, 45°).
      **Verify:** `cargo test -p bezel-render rotation`
      **Source:** CONTEXT
- [ ] Il dirty rect di un elemento ruotato copre tutto il suo bounding box ruotato.
      **Verify:** `cargo test -p bezel-render dirty_rotated`
      **Source:** CONTEXT
- [ ] Studio: campo Rotazione, maniglia con Shift a 15°, hit-test corretto sul riquadro ruotato, un trascinamento = un passo di Annulla; il campo non compare per video di sfondo, Card, gruppi e loro membri.
      **Verify:** `node scripts/e2e-slot.mjs <spec rotation>` da apps/bezel-studio (spec nuova, es. rotation.spec)
      **Source:** CONTEXT
- [ ] Copia, incolla e duplica mantengono l'angolo.
      **Verify:** `node scripts/e2e-slot.mjs <spec rotation>` da apps/bezel-studio (caso dedicato nella stessa spec)
      **Source:** CONTEXT
- [ ] Parità delle chiavi i18n nuove in en, pt-BR e it.
      **Verify:** `node --test tests/ui/i18n.test.mjs`
      **Source:** CONTEXT
- [ ] La resa di demo-render.js e dell'anteprima inspector coincide con quella Rust per un angolo di riferimento (30°).
      **Verify:** test di confronto pixel/snapshot nuovo in tests/ui (comando da fissare nel piano)
      **Source:** CONTEXT
- [ ] I crate toccati passano per intero (una volta, prima del push).
      **Verify:** `cargo test -p bezel-core -p bezel-themes -p bezel-render`
      **Source:** CONTEXT

### Manual
- [ ] Controllo visivo su device o simulatore con testo, un grafico e lo spettro ruotati a 30°.
      **Verify:** human confirmation required
      **Evidence:** screenshot allegato
      **Source:** CONTEXT

## Deferred (rinvii)
- Rotazione di gruppi e Card (e membri): fase futura, richiede decidere il centro di gruppo e l'effetto sulle transizioni flip/slide.
- Rotazione del video di sfondo del device.
- Aggancio a 90° e altri scatti oltre i 15° con Shift.
- Allineamento/aggancio basato sul bounding box ruotato.

## Notes
Il piano deve fissare i comandi esatti dei test nominati (nomi indicativi). Branch di lavoro: windows-improvements. Test mirati durante il lavoro, suite completa solo prima del push.
