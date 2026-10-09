# Phase 15: Studio redesign fidelity — Plan  (slug: studio-redesign-fidelity)

## Goal
Paridade visual e funcional do Bezel Studio com o canvas "Bezel Evo — proposta UI/UX", artboard por artboard (exceto LogoAlternatives), fechando as lacunas de GAPS.md.

## Locked decisions (from CONTEXT.md)
- Herdadas: D-4 (tokens, acento único), D-5 (claro+escuro), D-6 (fontes locais, CSP), D-7 (i18n, "Card"), D-8 (SVG inline, a11y), D-10 (reiniciar = só Libre), D-13. D-9 substituída.
- fidelity-1 paridade por artboard (DOM/ids podem mudar, specs sem enfraquecer) · -2 nada visual omitido · -3 todas as features do mockup com dados reais (exclusões: "Prova senza schermo", "attiva ora", udev one-click, reinício além do Libre) · -4 shoot.mjs + galeria aprovada · -5 Connect FORA do escopo (cartão atual inalterado) · -6 topbar do mockup, Salva secundário discreto (Ctrl+S) · -7 painéis redimensionáveis · -8 preview = objeto isolado via comando Rust (+ demo) · -9 tipografia 13px/11px caps/Mono · -10 dot grid, legenda, "Adatta" · -11 ícone de tray dedicado 16/20/24/32 · -12 light+dark+axe, tokens, en/pt-BR/it · -13 truncamento em Layers.
- Refinamento de forma (não de regra) pedido pelo orquestrador: os tokens de D-4 passam a viver em `src/styles/tokens.css` (único arquivo com `:root`), demais CSS por área.

## Desvios da estrutura sugerida (justificados)
1. **Backend (E) sobe para a Wave 1, em paralelo à fundação (T-3).** Assim as quatro tasks de UI testam contra bridge + demo reais e não contra stubs: sem isso, o preview isolado, os chips de app do Player, o "fps" só seriam testáveis na integração. O tempo não aumenta porque T-3 corre junto com T-1.
2. **Fundação = 2 tasks sequenciais do mesmo agente** (T-1 é um refactor sem mudança visual e T-2 traz o visual da shell), para que cada commit seja verificável: T-1 tem de deixar screenshots e suíte idênticos.
3. **O inspector vira 2 agentes (T-5 núcleo, T-7 Card), e Screen/Storage se junta a SensorStatus (T-6; Connect saiu do escopo por D-5 revista).** C tinha 8 artboards e seria o caminho crítico. Com o split ficam A=5, C1=5, C2=3 e BD=4, mais equilibrado. Assim também cabe no limite de 8 tasks.

## Contratos compartilhados (fixados aqui; T-1/T-3 implementam, wave 2 só consome)
**Bridge (T-3; erros reaproveitam códigos existentes, `backend-codes.json` inalterado):**
- `renderElement(theme, elementId, { max = 512, motion = true } = {})` → `invoke('render_element_preview', {theme, element, max, motion})` → `{width, height, nextMs, pixels, millis}` (mesmo header de 12 bytes de `render_preview`). Só o elemento (grupo: filhos; card: membros da face ativa) com as propriedades aplicadas. Fundo transparente, sem rotação da tela, lado maior ≤ `max`.
- ~~`listDevices().unbound`~~ removido (Connect fora do escopo, D-5 revista).
- `sample()` + `liveFps: number|null` + `activity: {available, foreground: string|null, applications: string[], media: [{source, title, artist, playing}]}|null` (do `Snapshot`; sem capa).
- `listThemes()`: cada entrada + `modifiedMs: number|null` · `duplicateTheme(location, name)` → `invoke('duplicate_theme', …)` → `ThemeEntryDto` (o nome vem traduzido da UI).
- Demo: tudo acima em `?demo=turing88` (Spotify tocando, Chrome aberto, fps quando ao vivo, temas com datas) (sem `?demo=nodriver`).

**Host (T-1/T-2 em `app.js`; `app.js` fica congelado na wave 2):**
- `createLibrary({…, bridge, actions: {…, duplicateTheme}})`, `library.updateReadings(readings, at)`.
- `createInspector({…, bridge, host: {lastSample(), renderElement(id, opts)}})`; o Card fica em `ui/inspector-card.js` com `renderCardPanel(tab, ctx)` para as abas `faces|motion|triggers`.
- `createScreenPanel({…})` (`ui/screen-panel.js`, extraído de library.js) com `render(screens, screen, live, brightness, desktopMode, extra)`.
- Connect: sem contrato novo; `ui/connect.js` e seus estilos/chaves ficam como estão (D-5 revista).
- `createSensorStatus({t, bridge, notify, fail, root: #status-libre, onOpenSensors})` é dono do chip de sensores, do popover e do reinício. `update({health, sampleMillis, sampledAt, readings, catalog, error})`.

**CSS** (`src/styles/`, linkados nesta ordem em index.html): `tokens` (W1, único com `:root`/hex) · `base` (reset, tipografia, primitivos, W1) · `shell` (W1) · `library` (T-4) · `inspector` (T-5) · `card` (T-7) · `screen` + `connect` (T-6). Nenhuma cor nova fora de tokens.css; variações via `color-mix()` de tokens; falta de token → anotar para T-8.
**i18n:** os bases `en/pt-BR/it.js` ficam congelados após T-2. As chaves novas vão em `src/i18n/areas/{area}.js` (`{en, 'pt-BR', it}` lado a lado), mesclados em `i18n/index.js` com erro em chave duplicada. Prefixos: shell `shell.` · library `widgets. sensorsPanel. layersPanel. mediaPanel. themesPanel.` · inspector `insp.` · card `cardInsp.` · screen `screenPanel. storagePanel.` · connect `connectView. sensorChip.`. Para mudar texto existente: chave nova + troca de uso (T-8 remove órfãs).
**Ícones/primitivos:** `ui/icons.js` (todos os ícones dos 17 artboards, colhidos em T-2), `ui/fields.js` e `ui/dom.js` são da W1 e ficam congelados. Ícone faltante → constante local no módulo da área.
**Fidelidade:** `scripts/fidelity/shoot.mjs --area <a> [--artboard X] [--scheme dark|light]` usa receitas em `scripts/fidelity/recipes/{shell,library,inspector,card,screen}.mjs` (uma por dono; Connect fora da galeria, D-5 revista).

## Guardrails (valem como acceptance de TODA task; citados como "G")
- G1 `npm run test:unit` verde (linhas ≥ 80%; lógica nova pura fora de `src/ui/`, com teste).
- G2 e2e: specs próprias + regressão read-only listada, via `node scripts/e2e-slot.mjs <specs>` (2 workers, no máx. 2 execuções simultâneas na máquina, porta própria por slot, `reuseExistingServer: false`, servidor `scripts/serve-e2e.py`). Falha por tempo (ex.: `card-animation:3`) reexecutada em série (`--workers=1 --repeat-each=3`) antes de julgar.
- G3 artboards da task comparados com shoot.mjs (it, dark e light) até bater; SUMMARY lista cada desvio restante (artboard, elemento, motivo).
- G4 nenhuma asserção enfraquecida (sem `expect` removido, sem timeout inflado, sem seletor afrouxado). Spec de outro dono nunca é editada: manter ids/`data-*`/nomes acessíveis ou anotar para T-8.
- G5 só dados reais do bridge (nenhum nome/valor do mockup em `src/`); antes de declarar algo inexistente, grep no bridge/store.
- G6 cores só via tokens (`static-guards` verde). G7 textos em en/pt-BR/it no módulo de área (paridade + prefixo verdes), "Card" fica "Card".
- G8 controles nativos, SVG inline, teclado/aria, `expectAccessible` em light e dark nos 4 projetos. Conferir o modo `storage-wide` quando mexer no `#stage`.
- G9 (D-14, reuso obrigatório) o mesmo objeto visual tem UMA implementação: campo com prefixo mono, título de seção, contagem, chip/badge, switch, segmented, pill, card de lista, cabeçalho de painel, busca, dica tracejada, slider com valor, ícone por tipo e miniatura de tela vêm de `ui/fields.js`/`ui/icons.js`/`ui/dom.js` e de classes em `styles/base.css` (T-2 cria o catálogo). Nenhuma task da Wave 2 cria variante local de um primitivo existente nem copia markup/CSS/lógica/strings entre áreas: precisa de algo novo comum → anota o contrato no SUMMARY e T-8 promove ao primitivo. Mesma regra para i18n (texto comum = uma chave, sem cópias com prefixos diferentes), ícones (um SVG por símbolo), lógica pura (um módulo) e specs (helpers em `tests/e2e/helpers.mjs`). Ao terminar, cada task lista no SUMMARY os primitivos reutilizados e confirma "nenhuma duplicação".

## Tasks

### Wave 1a — Fundação + Backend (paralelo; T-3 em worktree `fidelity/t3-backend`)

#### T-1: Fundação sem mudança visual — CSS por área, i18n por área, costuras, ferramentas
- **Specialist:** jdi-doer-bezel
- **Files modified:** `apps/bezel-studio/src/styles.css` (removido) → `src/styles/{tokens,base,shell,library,inspector,card,screen,connect}.css`, `src/index.html`, `src/app.js`, `src/i18n/index.js`, `src/i18n/areas/{shell,library,inspector,card,screen,connect}.js`, `src/ui/{library,inspector,sensor-status}.js`, `src/ui/{inspector-card,screen-panel}.js` (novos), `src/relative-time.js` (novo), `tests/ui/{static-guards,i18n,relative-time}.test.mjs`, `tests/e2e/{scenarios,features-016}.spec.mjs` → `scenarios-{shell,library,screen}.spec.mjs` + `features-016-{inspector,card,screen}.spec.mjs`, `playwright.config.mjs`, `scripts/e2e-slot.mjs`, `scripts/fidelity/{shoot,dc-shim,serve-mock}.mjs` + `recipes/*.mjs` (novos), `.jdi/phases/studio-redesign-fidelity/.gitignore`
- **Acceptance:**
  - Refactor puro: shoot.mjs antes/depois gera PNGs idênticos (diff 0 px) em todos os estados atuais, e suíte completa verde. `static-guards` lê todos os `src/styles/*.css`, exige que index.html linke cada um uma vez na ordem do contrato, `:root`/hex só em tokens.css, sem `@import`, e nas folhas de área todo seletor com classe ou id (sem elemento/universal solto).
  - `i18n/index.js` mescla bases + áreas e falha em chave duplicada. `i18n.test` cobre paridade, placeholders, prefixo por área, prefixos disjuntos e o scan de prosa tratando `areas/` como tradução. Costuras do contrato Host extraídas sem mudar comportamento (`#status-libre*`, `#restart-libre` e ids do Card/Tela preservados).
  - shoot.mjs reutilizável: sobe os próprios servidores, roteia `fonts.googleapis/gstatic` para os woff2 locais e preenche os mockups com o `renderVals()` do DCLogic via `dc-shim` (`{{…}}`, `sc-for`, `sc-if`). Se algum artboard não renderizar, cai para estático e marca na saída. `e2e-slot.mjs` + `E2E_PORT` em `playwright.config.mjs`.
- **Dependencies:** none
- **Test:** G1 (static-guards, i18n, relative-time); `npm test` completo (specs divididas sem mudar asserções)
- **Status:** completed

#### T-3: Backend — preview isolado, contratos de dados, ícone de tray
- **Specialist:** jdi-doer-bezel
- **Files modified:** `apps/bezel-studio/src-tauri/src/{commands,backend,studio,dto,lib,library,tray,performance}.rs`, `apps/bezel-studio/src-tauri/src/element_preview.rs` (novo), `apps/bezel-studio/src-tauri/capabilities/default.json` (se exigir), `crates/bezel-cli/src/light_tray.rs`, `apps/bezel-studio/scripts/build-icons.mjs`, `apps/bezel-studio/src-tauri/icons/tray-{16,20,24,32}.png`, `apps/bezel-studio/src/{bridge,demo-backend,demo-data,demo-render}.js`, `apps/bezel-studio/tests/ui/{bridge,demo-backend,app-icons}.test.mjs`
- **Acceptance:**
  - `render_element_preview` + `renderElement` conforme contrato. Testes Rust: (a) pixels fora do elemento transparentes e um elemento sobreposto ausente; (b) mudar cor/tamanho/valor muda o resultado; card renderiza só a face ativa. O demo tem o mesmo comportamento, com teste em `demo-backend.test`.
  - `liveFps`, `activity`, `modifiedMs` e `duplicate_theme` com testes Rust (duplicar nunca escreve em tema bundled) e demo equivalente; `bridge.test` cobre os nomes/args de invoke.
  - `build-icons.mjs` gera o tray dedicado (matriz simplificada, legível em barra clara e escura). `app-icons.test` confere 16/20/24/32 px e que `light_tray.rs` e `tray.rs` referenciam o novo asset. `cargo test --workspace`, `clippy -D warnings`, `fmt --check` e `llvm-cov ≥ 80%` verdes.
- **Dependencies:** none
- **Test:** `cargo test/clippy/fmt/llvm-cov --workspace`; G1
- **Status:** pending

### Wave 1b — Shell visual (mesmo agente de T-1; começa fazendo merge de `fidelity/t3-backend`)

#### T-2: Tipografia, primitivos, shell do Main, painéis redimensionáveis
- **Specialist:** jdi-doer-bezel
- **Files modified:** `src/styles/{tokens,base,shell}.css`, `src/index.html` (topbar, rail, stage, statusbar), `src/app.js`, `src/ui/{canvas,object-menu,fields,icons,dom}.js`, `src/panel-sizes.js` (novo), `src/i18n/{en,pt-BR,it}.js`, `src/i18n/areas/shell.js`, `scripts/fidelity/recipes/shell.mjs`, `tests/ui/panel-sizes.test.mjs` (novo), `tests/e2e/{shell,panels,fonts,clipboard,alignment-019,multi-screen,debug,live-screen-controls,device-label-020,scenarios-shell,workspace-selection}.spec.mjs` (`panels`, `fonts` novos), `tests/e2e/helpers.mjs`
- **Acceptance:**
  - Tipografia D-9: 13px Sans, títulos 11px caixa alta `.06em` muted, Mono em valores/prefixos; tokens cobrindo todas as cores dos 17 artboards. `fonts.spec` confirma Sans 400/500/600 + Mono 400/500 `loaded` e servidos de `assets/fonts`. Smoke manual no WebView2 (`tauri dev` + build de release: `document.fonts.check`) registrado no SUMMARY. Primitivos em `fields.js` (campo com prefixo mono, grade 2×2, switch à direita, título de seção com contagem, pills, dica tracejada, busca) e ícones colhidos dos artboards em `icons.js`.
  - Shell = artboard Main (G3): breadcrumb "Temi › {tema}", chip "Non salvato" (`isDirty`), versão sob o logo, chip da tela com `W×H · porta` mono e chevron (select nativo), "In diretta" verde (`#live` preservado), Salva secundário + Ctrl+S, rail com grupos mono, barra flutuante sem copiar/colar (que vão para o menu de objeto, `clipboard.spec` reescrita sem perder casos) e com grade, dot grid, legenda `W × H · ruotato N°`, zoom com "Adatta", statusbar "… · ultimo salvataggio N min fa" + chips render/fps (`liveFps`). Contrato Host completo ligado a T-3.
  - Painéis (D-7): `role=separator` com `aria-valuenow/min/max`, setas/Shift/Home/End, duplo clique reseta, persistido (`localStorage`), mín/máx. `panel-sizes.js` 100% coberto. `panels.spec` cobre o DoD; `helpers.mjs` ganha `setPanelWidths` e as specs de escala do canvas fixam larguras (aprendizado 1).
- **Dependencies:** T-1, T-3
- **Test:** G1–G9; gate de saída da Wave 1: `npm test` completo + `cargo test --workspace` verdes no commit-base das worktrees da Wave 2
- **Status:** pending

### Wave 2 — UI por área (4 agentes em paralelo, worktree/branch próprios a partir do commit de T-2)

#### T-4 (A): Painéis Widget, Sensori, Livelli, Media, Temi
- **Specialist:** jdi-doer-bezel
- **Files modified:** `src/index.html` (só as `section` dentro de `.library`; único dono na wave 2), `src/ui/{library,collection,icon-picker,gif-search,layer-drag}.js`, `src/ui/themes-dialog.js` (novo, se o artboard pedir modal), `src/library-model.js` (novo: grupos/busca de widget, filtro de camadas, histórico de sparkline), `src/{theme-filter,collection}.js`, `src/editor/layers.js`, `src/styles/library.css`, `src/i18n/areas/library.js`, `scripts/fidelity/recipes/library.mjs`, `tests/ui/{library,layers,collection,theme-filter,gif-search,library-model}.test.mjs`, `tests/e2e/{library,layer-drag,themes,gif-search,icons,workspace-selection,scenarios-library}.spec.mjs` (`library` novo)
- **Acceptance:**
  - G1–G9 nos artboards Main (painel), Sensors, Layers, Media, Themes. Widget: contagem, busca, 3 grupos, cards 3 colunas, dica tracejada no rodapé. Sensors: sparklines do histórico real de `updateReadings`, "aggiornati ogni N s", alerta Libre → `restartLibre`. Layers: filtro por nome/sensor, "IN PRIMO PIANO" + contagem, meta mono, barra de seleção múltipla (Raggruppa Ctrl G / Crea card com comandos existentes do store, nomes acessíveis sem colidir com o inspector). Themes: card "Nuovo tema", busca, Duplica (`duplicateTheme`) / Apri.
  - `library.spec`: "Background" e "CPU Analog" (ou equivalentes do demo) sem truncar na largura padrão (`scrollWidth ≤ clientWidth`) — DoD fidelity-13.
  - Regressão read-only: `cards`, `shell`, `panels`, `scenarios-shell`.
- **Dependencies:** T-2
- **Test:** G1, G2 (specs listadas), G3
- **Status:** pending

#### T-5 (C1): Inspector — cabeçalho, abas, posição, Ring/Main, Graph, Player, preview isolado
- **Specialist:** jdi-doer-bezel
- **Files modified:** `src/ui/inspector.js`, `src/inspector-tabs.js`, `src/element-preview.js` (novo, puro: agenda/coalesce de `renderElement`, encaixe), `src/styles/inspector.css`, `src/i18n/areas/inspector.js`, `scripts/fidelity/recipes/inspector.mjs`, `tests/ui/{inspector-tabs,element-preview}.test.mjs`, `tests/e2e/{inspector-sections,inspector-preview,ring-gradient,clock,weather,video-framing,video-background,video-preview,device-video,editing-017,features-016-inspector}.spec.mjs` (`inspector-preview` novo)
- **Acceptance:**
  - G1–G9 nos artboards Main (inspector), GraphData/Look, PlayerData/Look: cabeçalho com ícone + nome + subtítulo "tipo · livello N di M", olho e "…"; abas logo abaixo; grade 2×2 com prefixo mono + alinhamento; fonte do anel em card (sensor, chave mono, valor atual, chevron); arco com preview + inizio/ampiezza; switches à direita; Player: chips de app de `activity.media` (ponto verde = tocando, "Altra…"), "quando não toca" em cards de rádio.
  - Preview = `renderElement` (D-8): `inspector-preview.spec` mostra que outro elemento sobreposto não aparece e que mudar a cor muda os pixels; `role=img` com nome traduzido; sem chamadas em rajada (coalesce testado em unit).
  - Regressão read-only: `cards`, `card-animation`, `features-016-card`.
- **Dependencies:** T-2
- **Test:** G1, G2, G3
- **Status:** pending

#### T-6 (B+D): Screen, Storage, SensorStatus (Connect fora do escopo)
- **Specialist:** jdi-doer-bezel
- **Files modified:** `src/ui/{screen-panel,storage,manager,standby,udev,sensor-status}.js`, `src/storage-breakdown.js` (novos, puros), `src/{standby,storage-manager,libre-status}.js`, `src/styles/{screen,connect}.css`, `src/i18n/areas/{screen,connect}.js`, `scripts/fidelity/recipes/screen.mjs`, `tests/ui/{storage,storage-manager,standby,libre-status,storage-breakdown}.test.mjs`, `tests/e2e/{storage,storage-manager,standby,libre,scenarios-screen,features-016-screen}.spec.mjs`
- **Acceptance:**
  - G1–G9 nos artboards Screen, Storage, SensorStatus. NÃO tocar em `ui/connect.js`, no cartão Connect nem em `connect.spec` (D-5 revista). Storage: cartões interna/SD, barra por tipo (Video/Immagini/Altro somados de `managerOverview.files`), slot "All'accensione" com o arquivo `protected==='boot'`, chips Tutti/SD/Interna. Screen: card do dispositivo com porta, W×H e protocolo mono.
  - SensorStatus: 4 estados do chip (ok com ms, âmbar com N faltando, vermelho com reinício direto, girando), popover com linha por hardware (valor + fonte), "ultima lettura N s fa", Escape devolve o foco.
  - Regressão read-only: `shell`, `scenarios-shell`, `live-screen-controls`, `device-label-020`, `multi-screen`.
- **Dependencies:** T-2
- **Test:** G1, G2, G3
- **Status:** pending

#### T-7 (C2): Inspector do Card — Facce, Movimento, Trigger
- **Specialist:** jdi-doer-bezel
- **Files modified:** `src/ui/inspector-card.js`, `src/editor/{store,cards,card-motion,card-timer}.js`, `src/card-rules.js` (novo, puro: frase da regra ↔ trigger), `src/styles/card.css`, `src/i18n/areas/card.js`, `scripts/fidelity/recipes/card.mjs`, `tests/ui/{cards,card-motion,card-timer,editor-store,groups,card-rules}.test.mjs`, `tests/e2e/{cards,card-animation,card-inspector,features-016-card}.spec.mjs` (`card-inspector` novo)
- **Acceptance:**
  - G1–G9 nos artboards CardFaces/Motion/Triggers. Faces: miniaturas verticais (proporção da tela, `renderElement` por face ou recorte declarado), nome mono, chip "Base" tracejado, "+" grande; editor da face com ‹ ›, Duplica, lixeira vermelha; "OGGETTI IN {FACCIA}" + Sposta; dica tracejada.
  - Motion: pills de duração, stepper, cards ilustrados de efeito (SVG inline), slider, direção com setas. Triggers: regras em frase com tokens, app via `activity.applications`/`foreground` + texto livre, prioridade/retorno mono, "Quando un trigger finisce". Sem "attiva ora".
  - Comandos novos do store com teste e Undo de um passo; regressão read-only: `inspector-sections`, `layer-drag`, `workspace-selection`.
- **Dependencies:** T-2
- **Test:** G1, G2, G3
- **Status:** pending

### Wave 3 — Integração (1 agente)

#### T-8: Merge, gates completos, correções e galeria lado a lado
- **Specialist:** jdi-doer-bezel
- **Files modified:** qualquer arquivo citado acima só para corrigir integração; `src/styles/tokens.css` e `src/i18n/*` (tokens/chaves pendentes, órfãs); `scripts/fidelity/gallery.mjs` (novo); `.jdi/phases/studio-redesign-fidelity/SUMMARY.md`
- **Acceptance:**
  - Verificação de duplicação (D-14/G9): varrer `src/styles/*.css` (regras/declarações repetidas entre áreas), `src/ui/*.js` (markup/funções repetidas, primitivos reimplementados), `src/i18n/**` (mesmo texto em chaves diferentes), SVGs repetidos e lógica pura duplicada; consolidar tudo nos primitivos e registrar o resultado (o que foi unificado) no SUMMARY. Se possível, um teste automático simples (ex.: mesmo valor de texto en em >1 chave, mesmo `d` de SVG em >1 arquivo) que falha em regressão.
  - Merge `--no-ff` na ordem T-4 → T-6 → T-5 → T-7, rodando `npm run test:unit` após cada merge. Conflito de arquivo = violação de contrato, anotada no SUMMARY. Pendências anotadas pelos agentes aplicadas.
  - Gates: `npm test` (unit ≥ 80% + Playwright 4 projetos + axe, workers padrão, depois 2ª rodada de estabilidade); `cargo test --workspace`, `clippy --all-targets -D warnings`, `fmt --check`, `llvm-cov --workspace ≥ 80%`; `npm audit` e `cargo audit` sem alta/crítica nova. Specs por tempo reexecutadas em série antes de qualquer veredito.
  - `node scripts/fidelity/gallery.mjs` gera `gap/gallery/index.html` (gitignored) com par mockup × app (dark e light, it) por artboard/estado, valores do DCLogic via `dc-shim` e nota nos artboards estáticos; desvios restantes de cada agente listados na página. Aprovação do usuário = DoD manual.
- **Dependencies:** T-4, T-5, T-6, T-7
- **Test:** gates completos acima
- **Status:** pending

## Execution
- Total de tasks: 8 · Etapas sequenciais: 4 (1a: T-1 ∥ T-3 → 1b: T-2 → 2: T-4 ∥ T-5 ∥ T-6 ∥ T-7 → 3: T-8) · Speedup ≈ 8/4 = 2x (até 4 agentes simultâneos).
- Arquivos congelados na Wave 2 (sem dono): `app.js`, `bridge.js`, `demo-*.js`, `i18n/{index,en,pt-BR,it}.js`, `styles/{tokens,base,shell}.css`, `ui/{fields,icons,dom,canvas,object-menu,dialog,dragdrop,video-preview}.js`, `editor/{widgets,geometry,snap,background,video-framing}.js`, `e2e/helpers.mjs`, `playwright.config.mjs`, Rust. Se uma mudança neles for inevitável, o agente anota o patch exato no seu bloco do SUMMARY e a T-8 aplica.

## Files modified (all tasks)
- `apps/bezel-studio/src/{index.html,app.js,bridge.js,demo-backend.js,demo-data.js,demo-render.js,relative-time.js,panel-sizes.js,library-model.js,element-preview.js,storage-breakdown.js,card-rules.js,inspector-tabs.js,theme-filter.js,collection.js,standby.js,storage-manager.js,libre-status.js}`
- `apps/bezel-studio/src/styles/*.css`, `src/i18n/{index,en,pt-BR,it}.js`, `src/i18n/areas/*.js`, `src/editor/{layers,store,cards,card-motion,card-timer}.js`
- `apps/bezel-studio/src/ui/{library,inspector,inspector-card,screen-panel,themes-dialog,sensor-status,connect,storage,manager,standby,udev,collection,icon-picker,gif-search,layer-drag,canvas,object-menu,fields,icons,dom}.js`
- `apps/bezel-studio/tests/ui/*.test.mjs` e `tests/e2e/*.spec.mjs` (listados por task), `playwright.config.mjs`, `scripts/{e2e-slot,build-icons}.mjs`, `scripts/fidelity/**`
- `apps/bezel-studio/src-tauri/src/*.rs`, `src-tauri/icons/tray-*.png`, `crates/bezel-{core,devices,cli}/src/**`

## Test requirements
- Unit + guardas + paridade/prefixo i18n: `npm run test:unit` (linhas ≥ 80%; `src/ui/**`, `app.js` e `demo-render.js` fora da cobertura)
- E2E + axe (light-pt, dark-pt, light-en, dark-en): `npm test`; nas worktrees, `node scripts/e2e-slot.mjs <specs>`
- Rust: `cargo test --workspace`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo fmt --check`, `cargo llvm-cov --workspace` (≥ 80%)
- Manual: galeria (T-8); WebView2 fontes (T-2); tray em barra clara/escura (T-3/T-8)
- Minimum coverage: 80% (PROJECT.md)
