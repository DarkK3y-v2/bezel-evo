# Handoff — object-rotation a ChatGPT (2026-10-18)

## Dove lavorare
- Worktree: `F:\dev\bezel-rotation`, branch `fid/rotation` (creato da `windows-improvements` @ `55d2d24`, release 0.1.32).
- Lavora SOLO lì. In `F:\dev\bezel` (branch `windows-improvements`) l'utente e Claude provano lo spettro: non toccarlo.
- Niente push e niente release: a fine fase Claude integra `fid/rotation` in `windows-improvements` (merge `--no-ff`).

## Cosa fare
- Esegui `PLAN.md` di questa cartella (7 task in 4 wave), rispettando le decisioni di `CONTEXT.md`
  (D-2026-10-18-object-rotation-01..08) e le "Scelte del piano".
- Un task = un commit, Conventional Commits con scope `object-rotation`, es.
  `feat(object-rotation): rotation field in the theme model`. Ogni commit termina con
  `Co-Authored-By: ChatGPT <noreply@openai.com>`.
- Codice, commit e test in inglese; `SUMMARY.md` di questa cartella in italiano alla fine.
- Testi dell'interfaccia sempre via i18n, con parità di chiavi in en, pt-BR e it (`node --test tests/ui/i18n.test.mjs`).

## Test (regole del progetto, `AGENTS.md`)
- Durante il lavoro: solo i crate e i moduli toccati (`cargo test -p <crate>`,
  `cargo clippy -p <crate> --all-targets -- -D warnings`, `node --test tests/ui/<file>.test.mjs`) e solo gli e2e
  dell'area (`node scripts/e2e-slot.mjs tests/e2e/object-rotation.spec.mjs` da `apps/bezel-studio`).
- Suite completa e copertura una volta sola, alla fine (verifica della fase).
- Un test instabile si riesegue da solo, mai tutta la suite.

## Attenzione
- I campi nuovi del file del tema si scrivono solo se diversi dal default (come `gain`/`audio` dello spettro e
  `midpoint` della sfumatura), così i temi si aprono con le versioni precedenti.
- Lo spettro ha appena ricevuto `gain` (D-AS-12) e `audio` (D-AS-13) e la sfumatura `midpoint`: i letterali di
  `Element`/`Spectrum`/`Fade` nei test vanno aggiornati con i valori di default se ne aggiungi altri.
- La maniglia di rotazione non usa la classe `.handle` né `data-h` (gli spec esistenti contano 8 maniglie).
