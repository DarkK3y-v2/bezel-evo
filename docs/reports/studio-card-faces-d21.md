# Card faces (D-21)

Implemented in `fid/card-faces`, in `F:\dev\bezel-fid-card`. Source changes only; no executable installation or product version change.

## Commits

- `51a0520` ? migrate card timers and resolve pair transitions.
- `3053859` ? clarify card faces and edit timed transitions.

## Behaviour and reuse

Shared background is a separate `listCard` row, with its explanation and rendered thumbnail. Faces explicitly say ?Edit this face? in their title and accessible name; the face shown on the canvas has pressed/current state. The face strip includes a directed transition connector between neighbours and the wrap back to the first face. Its editor reuses the general transition controls; reset removes the override. Movement retains the fallback transition and ?Try on the next face?.

Timers use the existing `sentence()`, native numeric/select fields, list controls and Undo commands. App rules keep priority/return behaviour; timers pause during app overrides/return and while editing. English, Italian and Brazilian Portuguese strings live in the Card area; the Layers label reuses its shared-background string. Styling uses existing tokens only. `demo-render.js` already consumes resolved transition settings, so no duplicate renderer implementation was added.

## Migration and JSON

Schema remains version 1. Old `rotationSeconds` becomes an appended trigger on native load/save and demo/store load/save. Conversion is idempotent. Existing app rules and their order are retained. Native runtime also normalizes programmatic legacy Cards.

```json
{
  "triggers": [
    { "source": "timer", "intervalSeconds": 10, "nextFace": true,
      "app": "", "face": 0, "priority": 0, "returnSeconds": 0, "returnFace": null }
  ],
  "pairTransitions": [
    { "from": 0, "to": 1,
      "transition": { "effect": "slide", "direction": "up", "durationMs": 400, "includeBase": true } }
  ]
}
```

The snippet is the Card fragment; the existing fields are unchanged. A specific-face timer uses `nextFace: false` (omitted when saved) and `face`. Intervals retain the old 5?3600 s limits; the UI edits s/min. Legacy rotation is removed on canonical save. Empty pair overrides are omitted. Directed `from`/`to` indices resolve before the general `transition`; missing overrides preserve old themes. Reorder/delete remap surviving face identities and remove obsolete edges, with Undo. Validation rejects duplicate, invalid or self edges. Rendering uses the actual source/destination pair, including interrupted changes and reduced motion.

## Validation

- `cargo test --workspace`: 1,108 passed, 15 ignored, no failures.
- `cargo clippy --workspace --all-targets -- -D warnings`: passed.
- `cargo fmt --check`: passed.
- `cargo llvm-cov --workspace --fail-under-lines 80 --summary-only`: passed; 91.74% line coverage.
- `npm run test:unit`: 468 passed; 99.44% line coverage.
- `node scripts/e2e-slot.mjs tests/e2e/card-inspector.spec.mjs tests/e2e/cards.spec.mjs tests/e2e/card-animation.spec.mjs tests/e2e/features-016-card.spec.mjs`: 44 passed across four projects, including axe.
- Complete `npm test` (through the slot allocator, two workers): 468 unit tests and 596 e2e passed, four projects with axe (11.2 min e2e).
- `node scripts/e2e-slot.mjs tests/e2e/card-animation.spec.mjs --workers=1 --repeat-each=3`, in isolation: 24 passed (1.9 min).

An initial animation repeat overlapped the complete suite's artifact cleanup and finished with 23 passes and one Playwright trace `ENOENT`, without a failed animation assertion. The isolated repeat passed all 24 cases; no assertions or timeouts were weakened.

Visual captures: `node scripts/fidelity/shoot.mjs --area card --scheme dark` and `--scheme light`; eight captures each including mocks and app states. Inspected faces, pair editor and triggers. Intentional changes from the earlier mock are the separate shared row, transition connectors and timed sentence moved from Movement to Triggers.

## Protected-file integration patch

No changes were made to `ui/inspector.js`, `ui/canvas.js`, `ui/fields.js`, `styles/base.css` or `styles/shell.css`.

This worktree does not contain `src/corner-radii.js` or `cornerRadii()` yet. The existing Card radius field is deliberately unchanged, as requested in the addendum. Merge `62b94d2` first: it supplies the shared component, pure corner logic and translations. Cards already reuse `shapeForm()`, so the common shape adapter covers Cards without a local radius implementation.

A read-only `git apply --check --unidiff-zero --ignore-space-change` of this patch passed against the frozen inspector.

The exact patch below is against this branch's frozen inspector and requires those shared files/translations from `62b94d2`. If that merge has already supplied `cornersSection`, its imports and the shape call, retain them once rather than adding duplicates. The final one-line label change is also required for the member-face dropdown. No change to another agent's fields/CSS is required here.

```diff
--- a/apps/bezel-studio/src/ui/inspector.js
+++ b/apps/bezel-studio/src/ui/inspector.js
@@ -17 +17 @@
-  checkField, chipButton, colorField as colorInputs, dashedHint, fieldGrid, joinColor, kindIcon, listCard, numberField,
+  checkField, chipButton, colorField as colorInputs, cornerRadii, dashedHint, fieldGrid, joinColor, kindIcon, listCard, numberField,
@@ -19,0 +20 @@
+import { CORNERS, cornerValue } from '../corner-radii.js';
@@ -818,0 +820,10 @@
+  // Thin adapter to the shared corner control from commit 62b94d2.
+  function cornersSection(title, label, value, onChange, { individual = true, box = null } = {}) {
+    const texts = {
+      label, prefix: t('insp.radius'), mode: t('insp.cornersMode'), same: t('insp.cornersSame'), each: t('insp.cornersEach'),
+      corners: Object.fromEntries(CORNERS.map((name) => [name, t(`inspector.${name}`)])),
+    };
+    const { tool, control } = cornerRadii(texts, value, onChange, { individual, box });
+    return section('corners', title, [control], { tool });
+  }
+
@@ -823,4 +833,0 @@
-      ...(k.shape === 'rect' ? [
-        switchRow(t('inspector.individualCorners'), Boolean(k.corners), enabled => update(e.id, { kind: { corners: enabled ? Array(4).fill(k.radius ?? 0) : null, radius: k.corners?.[0] ?? k.radius ?? 0 } })),
-        ...(k.corners ? ['topLeft','topRight','bottomRight','bottomLeft'].map((name,i)=>numberField(t(`inspector.${name}`),k.corners[i],v=>update(e.id,{kind:{corners:k.corners.map((r,n)=>n===i?Math.max(0,v):r)}}),{min:0})) : [numberField(t('inspector.radius'),k.radius ?? 0,v=>update(e.id,{kind:{radius:Math.max(0,v)}}),{min:0})]),
-      ] : []),
@@ -834 +841,3 @@
-    ])] };
+    ]),
+    k.shape === 'rect' ? cornersSection(t('insp.cornersTitle'), t('inspector.radius'), cornerValue(k.radius ?? 0, k.corners),
+      ({ radius, corners }) => update(e.id, { kind: { radius, corners } }), { box: e.frame }) : null] };
@@ -859 +868 @@
-      parent && selectField(t('card.face'), e.cardMember.face === null ? '' : String(e.cardMember.face), [['', t('card.base')], ...parent.card.faces.map((name, i) => [String(i), name])], value => store.dispatch('attachCard', { ids: [e.id], parent: parent.id, face: value === '' ? null : Number(value) })),
+      parent && selectField(t('card.face'), e.cardMember.face === null ? '' : String(e.cardMember.face), [['', t('cardInsp.base')], ...parent.card.faces.map((name, i) => [String(i), name])], value => store.dispatch('attachCard', { ids: [e.id], parent: parent.id, face: value === '' ? null : Number(value) })),
```

## Changed source and test files

- `apps/bezel-studio/scripts/fidelity/recipes/card.mjs`
- `apps/bezel-studio/src-tauri/src/backend.rs`
- `apps/bezel-studio/src-tauri/src/element_preview.rs`
- `apps/bezel-studio/src-tauri/src/studio.rs`
- `apps/bezel-studio/src/card-config.js`
- `apps/bezel-studio/src/card-rules.js`
- `apps/bezel-studio/src/demo-backend.js`
- `apps/bezel-studio/src/editor/card-motion.js`
- `apps/bezel-studio/src/editor/card-timer.js`
- `apps/bezel-studio/src/editor/store.js`
- `apps/bezel-studio/src/i18n/areas/card.js`
- `apps/bezel-studio/src/sensor-sampling.js`
- `apps/bezel-studio/src/styles/card.css`
- `apps/bezel-studio/src/ui/inspector-card.js`
- `apps/bezel-studio/src/ui/library.js`
- `apps/bezel-studio/tests/e2e/card-animation.spec.mjs`
- `apps/bezel-studio/tests/e2e/card-inspector.spec.mjs`
- `apps/bezel-studio/tests/e2e/cards.spec.mjs`
- `apps/bezel-studio/tests/ui/card-config.test.mjs`
- `apps/bezel-studio/tests/ui/card-rules.test.mjs`
- `apps/bezel-studio/tests/ui/sensor-sampling.test.mjs`
- `crates/bezel-core/src/app/card_timer.rs`
- `crates/bezel-core/src/domain/playback.rs`
- `crates/bezel-core/src/domain/theme.rs`
- `crates/bezel-core/tests/runtime_cards.rs`
- `crates/bezel-render/src/cards.rs`
- `crates/bezel-render/src/renderer.rs`
- `crates/bezel-themes/src/dto.rs`
- `crates/bezel-themes/src/native.rs`

This report is the additional documentation file. No PLAN or SUMMARY edits.
