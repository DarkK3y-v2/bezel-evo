# Phase 15: Studio redesign fidelity — Summary  (slug: studio-redesign-fidelity)

**Status:** partial (T-1 concluída; demais tasks pendentes)

## Executed tasks
- T-1: fundação sem mudança visual (CSS por área, i18n por área, costuras do contrato Host, ferramentas de fidelidade e de e2e). Commits: 0fe8ac4, 01d37b1, 0cb8290, 438b3dc, 6f64309, 49bd158.

### T-1 — contratos como implementados
- **CSS** (`src/styles/`, linkados nesta ordem): `tokens` (único com `:root`/hex; ganhou `--motion-ui`, a transição comum) · `base` (fontes, defaults de elemento, primitivos: botões, switch/toggle-row, field/field-row/check/segmented/color-field, chip/chip-group, badge/tag/face-badge, notice, panel-head/panel-meta/panel-tools/section-head, subtabs, status-dot, diálogos, popover, help-button, hints, keyframes) · `shell` (topbar, workspace, rail, stage/canvas/overlays/framing no canvas, barras flutuantes, statusbar, toast, menu de objeto, preferências, `storage-wide` do layout) · `library` · `inspector` · `card` · `screen` (Screen, Storage/manager, standby/álbum, `#panel-screen`/drop-zone no modo wide) · `connect` (cartão Connect inalterado, udev, chip de sensores + popover Libre). Cada regra existe em um só arquivo; a regra de transição que listava controles de todas as áreas virou `transition: var(--motion-ui)` por área.
- Verificação da cascata: análise de inversões de ordem (especificidade igual + propriedades sobrepostas + classes que coexistem no markup). Declarações que nunca se aplicavam e passariam a vencer foram removidas para manter a renderização: `.framing-choice` (display) e `.framing-choice button` (padding/background) sob `.segmented`, e as larguras de `.wide-dialog`, `.udev-dialog` e `.video-preview-dialog` sob `.confirm-dialog`. **Defeito latente para T-6/T-8 decidirem:** esses três diálogos sempre abriram com 440 px (a largura pretendida 720/560/850 nunca valeu).
- **i18n:** `src/i18n/areas/{shell,library,inspector,card,screen,connect}.js` exportam `PREFIXES` e `default {en, 'pt-BR', it}` (vazios). `i18n/index.js` exporta `AREAS` e `mergeTables(bases, areas)` (erro em chave duplicada); `LOCALES` = bases + áreas.
- **Host:** `createLibrary({…, bridge, actions: {…, duplicateTheme}})` (`duplicateTheme(location, name)` chama `bridge.duplicateTheme` e relista), `library.updateReadings(readings, at)`, `library.setScreens(screens, current)` (filtro de temas). `createScreenPanel({root, t, actions})` em `ui/screen-panel.js` com `render(screens, screen, live, brightness, desktopMode, extra)` e `retranslate()`. `createInspector({…, bridge, host: {lastSample(), renderElement(id, opts)}})`; `host.renderElement` chama `bridge.renderElement(theme, id, opts)` (vem da T-3). `ui/inspector-card.js`: `CARD_TABS` e `renderCardPanel(tab, {element, t, store, update, section})`. `createSensorStatus({t, bridge, notify, fail, root, onOpenSensors})` é dono de `#status-sensors`, do dot/popover Libre e de `#restart-libre`; `update({health, sampleMillis, sampledAt, readings, catalog, error})`. Ids preservados.
- **Puro:** `src/relative-time.js`: `elapsed(fromMs, nowMs)` → `{value, unit}` e `timeAgo(fromMs, nowMs, locale)` (Intl.RelativeTimeFormat, estilo curto).
- **Ferramentas:** `scripts/fidelity/shoot.mjs [--area] [--artboard] [--scheme both|dark|light] [--only mock|app] [--out]` e `--diff A B` (pixel a pixel, sai 1 se diferente); saída padrão em `gap/{scheme}/{mock,app/<área>}` + `manifest.json`. `serve-mock.mjs` + `dc-shim.mjs` (DCLogic `renderVals()`, `{{…}}`, `sc-for`, `sc-if`; fallback estático marcado). Os 17 artboards expandem em modo dinâmico. Receitas: `recipes/{shell,library,inspector,card,screen}.mjs` (estado pode ter `demo` e `query`). `scripts/e2e-slot.mjs` (2 slots por máquina via lock em `%TEMP%/bezel-e2e-slots`, porta livre em `E2E_PORT`, 2 workers); `playwright.config.mjs` lê `E2E_PORT`.
- **Specs:** `scenarios.spec` → `scenarios-{shell,library,screen}`; `features-016.spec` → `features-016-{inspector,card,screen}`; corpos e asserções idênticos (verificado por diff das linhas). Helpers comuns (`layers`, `clickAddWidget`, `openInspectorTab`) em `tests/e2e/helpers.mjs`.

### Reuso (G9)
Nenhuma duplicação nova: cada regra CSS em um arquivo, helpers de spec uma vez em `helpers.mjs`, sem textos novos. Duplicações pré-existentes de declarações (ex.: o bloco `fill/stroke` de SVG repetido em várias regras) ficam para o catálogo de primitivos da T-2/T-8. Algumas regras de `base.css` ainda agrupam seletores de área (ex.: `.orientation-tools svg`, `.sensor-group h3`) porque separá-las duplicaria declarações.

### Desvios / notas
- Arquivo fora de `files_modified`: `tests/e2e/helpers.mjs` (helpers comuns das specs divididas, para não duplicar).
- As deleções de `scenarios.spec.mjs`/`features-016.spec.mjs` entraram no commit 438b3dc (costuras) e não no 49bd158 (split das specs), por estarem no índice; não houve amend.
- `gap/shoot.mjs` antigo continua versionado; foi substituído por `scripts/fidelity/shoot.mjs`.

## Blocked tasks
- nenhuma

## Files modified
- `apps/bezel-studio/src/styles.css` (removido), `src/styles/*.css`, `src/index.html`, `src/app.js`, `src/i18n/index.js`, `src/i18n/areas/*.js`, `src/ui/{library,inspector,sensor-status,inspector-card,screen-panel}.js`, `src/relative-time.js`
- `apps/bezel-studio/tests/ui/{static-guards,i18n,relative-time}.test.mjs`, `tests/e2e/{scenarios-*,features-016-*}.spec.mjs`, `tests/e2e/helpers.mjs`, `playwright.config.mjs`, `scripts/e2e-slot.mjs`, `scripts/fidelity/**`
- `.jdi/phases/studio-redesign-fidelity/.gitignore`

## Tests
- Unit: 362/362, linhas 99.42% (`npm run test:unit`).
- E2E: 396/396 nos 4 projetos (`node scripts/e2e-slot.mjs`, 2 workers).
- Screenshots (shoot.mjs, it, dark+light, 26 estados × 2): todos idênticos ao baseline pré-refactor. Única variação: `library/media-icons` alterna entre duas versões (~17 px) já entre duas execuções do baseline (não determinismo pré-existente do catálogo de ícones); cada execução pós-refactor bate com uma execução do baseline.
- Rust: não aplicável (T-1 não toca Rust).

## Hardware validation
- não aplicável
