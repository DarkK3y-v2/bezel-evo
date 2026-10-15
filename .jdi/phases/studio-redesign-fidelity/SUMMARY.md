# Phase 15: Studio redesign fidelity — Summary  (slug: studio-redesign-fidelity)

**Status:** complete (T-1..T-8 executadas; galeria aprovada pelo usuário; avisos 1-5 da revisão corrigidos; aviso 6, itens manuais, pendente)

## Executed tasks
- T-1: fundação sem mudança visual (CSS por área, i18n por área, costuras do contrato Host, ferramentas de fidelidade e de e2e). Commits: 0fe8ac4, 01d37b1, 0cb8290, 438b3dc, 6f64309, 49bd158.
- T-2..T-8 e correções da revisão: concluídas, ver as seções abaixo.

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


### T-3: Backend — preview isolado, contratos de dados, ícone de tray
**Status:** completed · commits 560844d, 8527829, d8c0146, f75cb61 (branch fid/t3)

- Preview isolado (D-…-fidelity-8): comando `render_element_preview {theme, element, max, motion}` → mesmo header de 12 bytes de `render_preview`. `element_preview::isolate` recorta o tema para o elemento (grupo com filhos; card com base + face ativa, sem rotação/trigger/transição; o próprio elemento sempre visível e fora do grupo/card) num canvas transparente do tamanho da caixa, sem rotação da tela; `fit_within` reduz para `max` (16..2048, padrão 512) com alfa pré-multiplicado. Desenhado pelo renderer e pelas leituras da sessão via `ThemeRuntime::preview_detached` (cena própria, sem revisão de conteúdo) — nenhuma lógica de render duplicada (D-14). Testes Rust: só o elemento, cor/tamanho/valor do sensor mudam os pixels, card só com a face ativa, `max` respeitado, `invalidInput` para id desconhecido. Bridge `renderElement(theme, elementId, {max, motion})` → `{width, height, rgba, pixels (=rgba), nextMs, millis}`; demo equivalente (`demoIsolate` + `renderApprox(..., scale)`) testado.
- `sample()`: `liveFps` (`null` sem tela ao vivo ou com frames a mais de 300 ms) e `activity {available, foreground, applications, media[{source,title,artist,playing}]}|null` (lido quando o tema/lista pede `activity.processes`/`media.sessions`; T-5/T-7: incluir essas chaves em `showSensors` para ter os chips antes de existir Player/trigger). Demo: 30 fps ao vivo, Chrome em primeiro plano, Spotify tocando.
- `listThemes()` + `modifiedMs`; `duplicate_theme {location, name}` → `ThemeEntryDto`, cópia na pasta do usuário com nome livre, nunca escreve em tema bundled; `notInLibrary`/`invalidInput`, nenhum código novo. Demo com datas e `duplicateTheme`.
- Ícone de tray dedicado (D-…-fidelity-11): `build-icons.mjs` desenha `tray-{16,20,24,32}.png`; `tray.png` removido. `tray_icon.rs` escolhe o tamanho pela escala do monitor; usado pelo tray do Studio e incluído por `#[path]` no Light (uma implementação). `app-icons.test`: dimensões, PNGs = saída do script, contraste em barra clara/escura, ambos os trays usam o novo asset.
- Arquivos fora da lista da task: `crates/bezel-core/src/app/runtime.rs` + `tests/runtime_animation.rs` (`preview_detached`), `src-tauri/build.rs`, `src-tauri/src/thumbnails.rs` (reusa `fit_within`; FORMAT → `bezel-thumbnail-2`), `src-tauri/src/tray_icon.rs` (novo).
- Primitivos reutilizados: `ThemeRuntime`/renderer, `frame_bytes`, `parseFrame`, `ThemeLibrary::new_location`, `entry_at`, medidor de `Performance`, `fit_within`, `motion_of`. Única lógica espelhada: recorte em JS no demo (outra linguagem), testado contra a mesma semântica.
- Testes: `cargo test --workspace` 1058 ok / 0 falhas (15 ignorados); clippy -D warnings e fmt limpos; llvm-cov linhas 91,79%; `npm run test:unit` 356/356, linhas 99,43%. Playwright não executado.
- Pendente manual: conferir o tray em barra clara/escura com build de release (T-8). Mudança de DPI em execução não troca o ícone.

### T-2: Tipografia, primitivos, shell do Main, painéis redimensionáveis
**Status:** completed · merge de `fid/t3` (`git merge --no-ff`) + commits 3d4100d, 0e242ae, 497d62a, ce46a5e

- **Merge T-3:** sem conflitos. Depois do merge: `npm run test:unit` 371/371, `cargo test --workspace` 1058 ok / 0 falhas, `cargo clippy --workspace --all-targets -D warnings` limpo.
- **Tipografia (D-…-fidelity-9):** corpo de 13px (`--fs-base`), títulos de 11px em caixa alta com `.06em` (`--fs-caps`, `--caps-spacing`), Mono para valores, prefixos, versão, legenda, zoom e pílulas. `fonts.spec` confirma que Sans 400/500/600 e Mono 400/500 estão `loaded` e vêm de `assets/fonts/ibm-plex`. **Smoke no WebView2 (`tauri dev` / release, `document.fonts.check`) não executado nesta sessão: precisa de uma sessão interativa do app. Fica pendente para a T-8.**
- **Tokens:** paleta dos artboards em claro e escuro: `--chrome`, `--well`, `--line`, `--border-2`, `--text-2/3`, `--dim`, `--faint` (só decorativo), `--ok-ink/--ok-line`, `--accent-line`, `--dot`, `--bezel-face/line`; escala de tipo; `--ic-stroke: 1.75`. Os tons do mockup que não atingem 4.5:1 em texto foram substituídos: a legenda do mockup em #5F6870 virou `--dim`.
- **Shell = artboard Main:**
  - Topbar: marca BEZEL EVO com a versão embaixo; breadcrumb "Temi › {tema}", em que "Temi" abre a aba Temas; pílula "Non salvato" ligada a `isDirty`.
  - Chip da tela: nome, `W×H · porta` em mono e chevron sobre o `select` nativo transparente.
  - "In diretta": toggle verde quando ligado; `#live` com `role=switch` foi mantido.
  - Salva: botão secundário discreto com `Ctrl S` (aria-hidden).
  - Rail: rótulos de grupo em mono e caixa alta.
  - Stage:
    - dot grid e bezel plano;
    - legenda `480 × 1920 · ruotato 180°`;
    - barra flutuante com orientação, girar, undo/redo e grade (a grade é lembrada); copiar/colar saíram da barra e estão no menu de objeto;
    - zoom com % em mono e "Adatta".
  - O canvas ajusta-se ao espaço que sobra (padding das barras, moldura e legenda) e usa o zoom exato, sem arredondar o tamanho da caixa.
  - Statusbar de 30px: "salvo/não salvo · ultimo salvataggio N min fa" (`modifiedMs` + `relative-time`) e pílulas de sensores, render e tela. A pílula da tela fica verde com `liveFps` ao vivo.
- **Painéis (D-…-fidelity-7):** `ui/panel-resizer.js` + `panel-sizes.js` (100% coberto). Cada separador tem `role=separator`, `aria-valuenow/min/max`, setas, Shift, Home e End, e o duplo clique restaura. A largura é lembrada em `localStorage` (`bezel.panelWidths`). Limites: biblioteca 240–480 (padrão 272, como no mockup), inspector 280–520 (320). Janela estreita: o inspector cede primeiro. `panels.spec` cobre o DoD; `helpers.setPanelWidths` está disponível.
- **Contrato Host completo com a T-3:** `host.renderElement` → `bridge.renderElement`; `actions.duplicateTheme` → `bridge.duplicateTheme`; `liveFps` na statusbar; `lastSample()` para o inspector.

#### Catálogo de primitivos (D-14/G9): reutilizar, nunca recriar
O CSS fica em `styles/base.css`, os builders em `ui/fields.js`, os ícones em `ui/icons.js` e `ui/dom.js`. Todos os textos chegam já traduzidos pelo chamador.

| Primitivo | Builder (API) | Classes |
|---|---|---|
| Ícone | `icon(ICONS.name, size)` (dom.js); no HTML, `<svg data-icon="name">` + `applyIcons(root, ICONS)` | `.ic` (traço na cor atual; o lugar só define tamanho e cor) |
| Título de seção (+contagem) | `sectionTitle(text, {count, id})` | `.section-head` > `h3.section-title` + `.count` |
| Contagem / leitura mono | `count(text)` | `.count` (equivale a `.panel-meta`) |
| Cabeçalho de painel | `panelHead(title, {count: Node\|string, tools: Node[], id})` | `.panel-head`, `h2` de 15px, `.panel-tools` |
| Campo com prefixo mono | `prefixedField(prefix, label, value, onChange, {min, max, step, unit})`; grade 2×2: `fieldGrid([...])` | `.fld`, `.fld-prefix`, `.fld-unit`, `.fld-grid` |
| Campo rotulado (legado) | `numberField`, `textField`, `selectField`, `checkField`, `colorField` | `.field`, `.check`, `.color-field` |
| Switch à direita | `switchRow(label, checked, onChange)` (input `role=switch`) | `.switch-row` + `.track > .thumb` (também `.switch`, `.toggle-row`) |
| Segmented | `segmented(label, value, [[v,l]], onChange, {bare})` | `.segmented` (mesmo visual de `.subtabs` em role=tab) |
| Chip de filtro | `chipButton(text, pressed, onClick, attrs)` | `.chip` (+ `.chip-group`) |
| Pílula de status | `pill(text, {tone: 'ok'\|'accent'\|'warn', dot, as: 'span'\|'button', attrs})` | `.pill`, `.pill-dot`, `[data-tone]` |
| Badge / tag | sem builder (markup simples) | `.badge`, `.face-badge`, `.tag` |
| Busca | `searchField(label, onInput, {placeholder, id, value})` | `.search-box` |
| Dica tracejada | `dashedHint(children, {iconName})` | `.dashed-hint` (com `kbd`) |
| Slider com valor | `rangeField(label, value, onChange, {min, max, step, format})` | `.slider-field`, `.slider-head` + `output` mono |
| Card de lista | `listCard({icon, title, subtitle, value, label, onClick, pressed})` | `.list-card`, `-title`, `-sub` (mono), `-value`, `-chevron` |
| Ícone por tipo | `kindIcon(kind, {small})` | `.kind-icon` (34px; `.small` 28px) |
| Miniatura de tela | `screenThumb({width, height, url})` | `.screen-thumb` (`--ratio`) |
| Botões | markup | `.icon-button`, `.text-button`, `.primary-button`, `.danger-button`, `.chip-button`; variante `.quiet` (sem moldura até o hover) |
| Outros | — | `.notice`, `.status-dot`, `.confirm-dialog`/`.dialog-*`, `.popover`, `.hint`, `.empty-note`, `.mono`, `kbd` |

- **Ícones:** `ui/icons.js` reúne os 81 símbolos colhidos nos 17 artboards (exceto LogoAlternatives) mais os do app, uma vez cada. Grupos: tipos de widget, painéis, ações, navegação, alinhamento, estado, hardware/mídia. As cópias locais (`GROUP_ICON`, `BASE_ICON`, `FACE_ICON`, `BACKGROUND_ICON`, `PLACE_ICON`, `SCREEN_GLYPHS`, `CHEVRON_*`, `PLUS`, `FRAME_ICON`, os `GLYPHS` do manager, o `keep` do standby e os chevrons da dobra de camadas) passaram a apontar para o catálogo. A chave `card` estava definida duas vezes (o widget mostrava o ícone de cartão SD); agora `card` é o widget e `sdCard` o cartão.
- **Duplicação consolidada:** 22 regras de SVG das folhas de área repetiam `fill/stroke/linecap/linejoin` e agora usam `.ic`. O traço ficou uniforme em 1.75; cores de traço viraram `color`. A busca de Sensores (`#panel-sensors .search`) e a da busca de GIF passaram ao `.search-box`. O `.search` antigo saiu: colidia com `.field.search` do manager.
- **Nenhuma duplicação nova.**

#### Desvios restantes (Main, dark e light, `shoot.mjs --area shell`)
- **Painel Widget e inspector** ainda no layout antigo: grupos, busca, contagem e dica tracejada (T-4); cabeçalho, abas, grade 2×2, Sorgente e Arco (T-5). Os primitivos para isso já existem.
- **Chip de sensores:** pílula neutra "Sensori 3 ms". No mockup é verde com ponto ("sensori · 3 ms") e o dot Libre fica separado. Os 4 estados são da T-6.
- **Salva:** o mockup desenha em laranja, mas D-…-fidelity-6 decidiu secundário discreto, então está assim de propósito.
- **Versão:** o demo mostra "demo", porque o backend demo não tem número de versão.
- **Rótulo do rail em it:** "Dispositivo" em 9px, onde o mockup diz "Device".
- **Zoom:** 35%. O mockup rotula "38%", mas o canvas dele é 672px = 35%.
- **Claro:** o mockup só existe em escuro. O claro usa a mesma estrutura com os tokens claros (axe ok).
- **Ícones do cartão Connect** passam a vir do catálogo; o cartão (markup e CSS) não foi tocado. O "warning" agora é o triângulo do mockup.
- **Larguras de diálogo (440px):** inalteradas. D-…-fidelity-15 manda corrigi-las na T-8.

#### Testes
- `npm test`: unit 376/376, linhas 99,44%. Playwright: 411 passed e 1 failed (`card-animation`, timing). Reexecutado em série (`--workers=1 --repeat-each=3`): 12/12 ok.
- Specs alteradas sem enfraquecer asserções:
  - `clipboard` cobre os mesmos casos pelo menu de objeto (vazio sem menu, colar habilitado, copiar e colar pelo menu);
  - `cards`/`device-video`/`ring-gradient`/`weather` copiam pelo teclado (`copyAndPaste`);
  - `layer-drag`: "Copiar desabilitado" virou "inspector mostra o tema" (sem seleção);
  - `workspace-selection` foca `#grid-toggle`;
  - `live-screen-controls` clica `label.live-toggle`;
  - `shell` lista `grid-toggle` em vez de copiar/colar;
  - `i18n.test`: a marca agora é dividida em "Bezel" + "Evo".
- `cargo test --workspace`: 1058 ok (pós-merge; T-2 não toca Rust).

### T-4 - Library: Widgets, Sensores, Camadas, Mídia, Temas

- Head `fid/t4`: `48892b6`; integrado com `--no-ff` em `c6f726b`.
- Commits de conclusão: `3949d92`, `6699d83`, `27d6b35`, `c621527`, `c8987ab`, `48892b6` (WIP inicial `f9d47ea`).
- Busca e três grupos de Widgets; sparklines a partir do histórico real de `updateReadings`; filtro de Camadas por nome/sensor, seleção múltipla com Agrupar/Criar cartão, nomes completos e descendentes visíveis com filtro. Mídia com totais reais. Temas: Novo tema, busca, Duplicar/Abrir; o diálogo reutiliza os mesmos nós da grade do painel.
- Relatório do agente na conversa: unit 390/390 (99,45%), e2e 212/212; um `ERR_NO_BUFFER_SPACE` anterior foi reconferido em série e com a seleção inteira de specs. Nenhum REPORT.md persistente encontrado na galeria da worktree. Os resultados da integração abaixo foram verificados de novo.
- Primitivos: searchField, sectionTitle/count, chipButton, kindIcon, dashedHint, screenThumb; ownership/geometria já compartilhadas para o drop de sensores. Nenhum arquivo fora do plano no branch T-4.
- Resíduos: nomes de Camadas em duas linhas a 272 px (para mantê-los completos), artboard autônomo a 360 px; Temas mantém metadados e controles reais a mais; catálogo de sensores e estado de importação vêm do bridge.

### T-5 - Inspector: núcleo e preview isolado

- Head `fid/t5`: `add6b9a`; merge `f5ff9b0`. Commits de conclusão: `9f6d2e4`, `15e4a25`, `5981600`, `672a8d7`, `add6b9a` (WIP `07400e4`).
- Cabeçalho, ações, abas nativas, posição 2 x 2, fonte/arco do Ring, controles de Graph e Player. Foco mantido depois do render. O preview usa `host.renderElement(id, opts)` e o bridge, com coalescing, descarte de respostas obsoletas, ajuste proporcional e animação por `nextMs`; não recorta o canvas geral.
- Relatório na conversa: unit 389/389 (99,46%), e2e 124/124, screenshots dark/light. REPORT.md persistente ausente. Nenhum arquivo fora do plano no branch T-5.
- Primitivos: prefixedField/fieldGrid, segmented, switchRow, rangeField, chipButton, listCard e ícones; scheduler e animação compartilhados. A proposta de pedir activity permanentemente NÃO foi aplicada: a T-8 a substitui pelo pedido condicional.
- Resíduos: o Ring mantém o preview depois das propriedades; Graph/Player têm a geometria depois dos controles de dados. Tamanho do preview, valores e apps seguem o objeto real, não os dados do mockup.

### T-6 - Screen, Storage, SensorStatus

- Head `fid/t6`: `32226db`; merge `24ff0d6`. Conclusão depois do WIP `e604796`: `0ace380`, `af7747d`, `9f52bdc`, `cedf96a`, `a665e4b`, `d50767c`, `700ad64`, `edd7343`, `0ed11d1`, `32226db`; trabalho anterior `a7a03b1`, `2b47b18`, `ef88455`.
- Screen com dados reais do dispositivo e controles de standby. Storage: capacidade interna/SD, barra por tipo, arquivo de boot real, filtros por mídia e destaque do drop no boot, ações por teclado com nomes acessíveis. SensorStatus: quatro estados, reinício do Libre, popover com hardware físico distinto mesmo quando os nomes coincidem, valor/fonte e tempo da leitura.
- Nenhum REPORT.md persistente encontrado na worktree T-6; resumo reconstruído a partir do diff, dos commits e do handoff. Verificação autônoma da T-8: unit 399/399 depois deste merge; todas as specs da T-6 estão nos gates completos finais.
- Primitivos: campos nativos, switch, segmented/chip, pill, seções e ícones compartilhados; modelo puro storage-breakdown e agrupamento de hardware testados. Nenhum arquivo fora do plano no branch T-6. O cartão Connect ficou fora do redesign.
- Resíduos: Storage mantém o modo de largura total; inventário, capacidade e boot são os do bridge. Screen mantém os controles avançados reais; SensorStatus mostra os providers/hardware reais.

### T-7 - Card: Faces, Movimento, Gatilhos

- Head `fid/t7`: `1823f0d`; merge `70f61af`. WIP `6f69571`, conclusão `7c7d1b0`, testes `1823f0d`.
- Fonte: `F:/dev/bezel-fid-t7/.jdi/phases/studio-redesign-fidelity/gap/gallery/card/REPORT.md` e o respectivo `T7-integration.patch` (único relatório persistente presente nas galerias das quatro worktrees).
- Base como estado de UI sem Undo, miniaturas proporcionais e raster por face, objetos/movimentação e comandos existentes do documento. Movimento com stepper, intervalos rápidos, radios ilustrados, duração e direção, base comum e `card.animateNext`. Gatilhos em frases nativas, prioridade/retorno, reordenação por ponteiro/teclado, retorno comum e sugestões a partir do sample; o badge "ativa agora" ficou de fora. "Card" continua "Card".
- Relatório do agente: unit 385/385 (99,45%), e2e 68/68 nos quatro projetos; card-animation em série 12/12 depois de um primeiro resultado sensível a timing. Nenhuma asserção enfraquecida. Oito arquivos no diff contra a base, todos no plano.
- Primitivos: prefixedField/fieldGrid, switchRow, segmented, rangeField, chipButton, listCard, screenThumb, dashedHint e ícones; modelo puro card-rules. A T-8 passa bridge+host, restaura o parâmetro bridge do núcleo da T-5 e fotografa Cards realmente preenchidos.
- Resíduos: duas faces e conteúdo real em vez dos três exemplos do mockup; tiles e textos completos ocupam mais espaço e o badge da face segue o nome. A quarta aba, Aparência, mantém as opções existentes. Efeitos ilustrados em traço; ajuda completa no details. Na T-8, geometria e preview foram movidos para DEPOIS do conteúdo do Card, para aproximar o layout da referência.

### T-8 - Integração, consolidação e gates finais (2026-10-15)

Merges feitos na ordem pedida, sem conflitos e sem violações de ownership:

| Ordem | Branch / head | Commit de merge | Unit logo depois do merge |
| --- | --- | --- | --- |
| 1 | fid/t4 - 48892b6 | c6f726b | 390/390 - 99,45% |
| 2 | fid/t6 - 32226db | 24ff0d6 | 399/399 - 99,46% |
| 3 | fid/t5 - add6b9a | f5ff9b0 | 412/412 - 99,48% |
| 4 | fid/t7 - 1823f0d | 70f61af | 421/421 - 99,49% |

Commits próprios da integração:

- `7c9c6b8` - host/bridge do Card, pedidos de activity condicionais e larguras D-15, com unit/e2e.
- `4a0f4e1` - rustls 0.23.45 → 0.23.46 no lockfile, corrigindo quatro advisories de 14 de outubro (uma média, três baixas).
- `deea4ee` - contador atômico nos nomes dos diretórios temporários do teste de handoff, para evitar colisões durante o llvm-cov paralelo. Nenhuma lógica de runtime mudou.
- `1a3e327` - seções, icon button, durações, CSS e primeiras famílias de textos compartilhados; remoção dos rótulos obsoletos.
- `a45084d` - conteúdo do Card antes de geometria/preview.
- `6e846b1` - todos os demais rótulos idênticos consolidados em chaves canônicas; mapeamento único dos nomes derivados de enums.
- `8572094` - galeria completa, Logo, Cards preenchidos, recortes dos painéis e capturas incrementais.
- `763eb1a` - dimensões explícitas das imagens, para evitar saltos de layout durante o lazy loading da galeria.
- `e1068b0` - detalhes do Screen incluindo standby e captura incremental por estado.
- `25ff273` - filtro de brilho aplicado uma só vez por frame antes da projeção flip do demo, com regression test sobre os draws filtrados e as faces renderizadas.
- `c28b861` - colunas fixas da linha de sensor como no mockup (`minmax(0, 1fr) 60px 80px`): a única mudança pedida pelo usuário na revisão da galeria.

**Activity e desempenho.** A política de amostragem (hoje `sampledSensorKeys` em `src/sensor-sampling.js`; na T-8 era `shownSensorKeys` em `inspector-tabs.js`) mantém a ordem e os pedidos da Library e acrescenta `activity.processes` e `media.sessions` só com um único Player selecionado ou um Card com gatilhos, e só quando o inspector está visível. Multisseleção, outra seleção, Card sem gatilhos, Storage wide e janela oculta liberam o pedido extra. A assinatura do pedido evita invokes duplicados. Os unit cobrem seleções/visibilidade; o e2e verifica Player - Ring - Card - inclusão/remoção de gatilho com Undo/Redo - Storage - editor e as miniaturas raster reais.

**D-15.** `.wide-dialog`: 720 px, `.udev-dialog`: 560 px, `.video-preview-dialog`: 850 px; limite comum `calc(100vw - 32px)`. E2e nos diálogos reais nos quatro projetos, a 1280, 640 e 480 px, incluindo fechamento nativo e axe.

**D-14/G9.** Verificadas todas as folhas CSS, ui/*.js, i18n, paths SVG e helpers puros. `propertySection` e `iconButton` estão agora em fields.js; o Card usa o contrato único das seções, sem fallback do inspector antigo. `durationParts` é uma só implementação, reutilizada pelas regras do Card; os nomes das abas derivam do modelo comum. Vinte grupos de blocos CSS idênticos entre áreas estão definidos uma só vez em base.css (campos, layout, estados, texto truncado, selects nativos sobrepostos e botões). Removidos 27 textos obsoletos e consolidados os textos comuns; minutos/horas têm chaves `unit.*`. Os rótulos dinâmicos derivados de enums são resolvidos com `canonicalLabelKey`, sem cópias das traduções. Guardas automáticas: nenhum corpo CSS com pelo menos três declarações repetido entre folhas no mesmo contexto; nenhum path SVG igual em mais de um módulo de UI; nenhum texto idêntico nos três locales sob duas chaves do catálogo inteiro. Um teste separado verifica que cada rótulo derivado aponta para uma chave canônica existente em cada locale, preservando parâmetros e resultado. Plurais e traduções que diferem em pelo menos um locale continuam distintos. Nenhuma duplicação identificada restante; as verificações automáticas são heurísticas, não uma prova geral sobre todo algoritmo.

**Gates finais.**

| Gate | Resultado |
| --- | --- |
| npm run test:unit (também nas duas execuções de npm test) | 426/426; linhas 99,48% |
| npm test, quatro projetos, workers padrão (10), axe | 536/536; segunda passada de estabilidade: 536/536, verde |
| Card / inspector-sections / card-animation, workers=1, repeat-each=3 | 120/120 antes da conclusão do renderer; card-animation original 12/12 em série depois de 25ff273 |
| cargo test --workspace | 1058 aprovados, 15 ignorados pré-existentes |
| cargo clippy --workspace --all-targets -- -D warnings | verde |
| cargo fmt --check | verde |
| cargo llvm-cov --workspace --fail-under-lines 80 | verde, linhas 91,79% (regiões 91,30%) |
| npm audit --audit-level=high | 0 vulnerabilidades |
| cargo audit | verde, nenhuma vulnerabilidade |

A primeira suíte completa teve 11 falhas, causadas pela ordem dos sensores e pela chave antiga da dica de Mídia: a ordem foi restaurada e a spec atualizada para o texto atual, sem remover nem afrouxar a asserção. Uma passada intermediária teve 10 erros ENOENT nos artefatos do Playwright, porque um segundo run na mesma worktree limpou o diretório; foi invalidada e repetida sem runs sobrepostos. Passadas intermediárias reproduziram o flip com 3 hashes em vez de 4; a repetição em série ficou verde 12/12. No demo o brilho era filtrado de novo para cada faixa da projeção: agora o filtro roda uma só vez por frame. A nova spec verifica um único draw filtrado e faces com pixels diferentes; o corpo da spec de animação original continua idêntico byte a byte, incluindo 10 amostras, intervalo de 140 ms, duração e limite >= 4 hashes. O primeiro llvm-cov detectou a colisão dos diretórios temporários corrigida em deea4ee. Nenhum timeout aumentado, nenhum limite reduzido.

**Galeria.** Comando reprodutível `node scripts/fidelity/gallery.mjs`; página `.jdi/phases/studio-redesign-fidelity/gap/gallery/index.html`, 16 artboards - dark/light, italiano, Connect e LogoAlternatives excluídos. 132 capturas canônicas no manifest, mais os recortes para comparação; Cards recapturados depois do último deslocamento de layout via `shoot.mjs --area card --merge`. Referências expandidas com o dc-shim; um eventual fallback ESTÁTICO aparece com o motivo. Verificadas no navegador 32 seções e todos os caminhos das imagens. Screenshot de controle `gallery-card-review.png`. Cada seção lista os seus resíduos; o tema claro usa os tokens claros, enquanto as referências são na maioria escuras. **Aprovada pelo usuário**; a única mudança pedida foram as colunas fixas da linha de sensor, feita em `c28b861`.

**Arquivos fora das listas pontuais do plano.**

- `Cargo.lock`: patch de segurança necessário para deixar o cargo audit verde.
- `crates/bezel-power/src/handoff.rs`: só a correção do isolamento do teste temporário que apareceu no gate do llvm-cov.
- `apps/bezel-studio/src/ui/preferences.js`: troca das chaves de rótulos comuns pelas chaves compartilhadas, texto e comportamento inalterados.
- `apps/bezel-studio/tests/e2e/connect.spec.mjs`: mesma asserção sobre o botão Close, com a chave canônica `dialog.close`; nenhum redesign do Connect. No seu módulo de UI mudaram só as chaves de textos já idênticos.

As novas specs `fidelity-integration.spec.mjs` e `inspector-activity.test.mjs` (hoje `sensor-sampling.test.mjs`) atendem ao pedido explícito de regression tests da T-8 e entram nos globs agregados do plano. Nenhum executável entregue ou substituído; VERSION e dist/bezel inalterados. O arquivo não rastreado do usuário `.claude/launch.json` ficou intacto. Documentação em commit separado do código. Logs finais: `gap/gallery/logs/`; relatório também em `gap/gallery/REPORT.md`.

### Correções da revisão (avisos 1-5 do REVIEW.md, 2026-10-15)

O aviso 6 (itens manuais: fontes no WebView2, tray em barra real, build de release) continua pendente, fora deste ciclo por instrução.

- `f36fbd8` - **Aviso 1 (G9/D-14).** Os tons `warn`, `danger` e `info` da `.pill` saíram de `connect.css` e estão em `base.css`, ao lado de `ok`/`accent`; o `warn`, antes dividido entre `base.css` (cor) e `connect.css` (borda/fundo), é agora uma só regra. Nova guarda estática: toda regra `.pill[data-tone]` fica em `base.css`, uma por tom.
- `31de19c` - **Aviso 2.** Os dois `shownSensorKeys` ganharam nomes distintos: a política de amostragem virou `sampledSensorKeys` num módulo próprio, `src/sensor-sampling.js` (teste `sensor-sampling.test.mjs`, antes `inspector-activity.test.mjs`), e a lista da Library virou `catalogKeysInView` (`ui/library.js`).
- `e4c413a` - **Aviso 3 (D-14).** 22 rótulos comuns a áreas sem relação foram para o namespace neutro `common.*`, nas tabelas base (en/pt-BR/it, mesmos textos): `framing.done` → `common.done`, `inspector.delete` → `common.delete`, `standby.album.remove` → `common.deleteNamed`, `library.sensors` → `common.sensors`, e também `collection.retry`, `inspector.duplicate`, `inspector.name`, `inspector.background`, `inspector.otherSensor`, `top.save`, `media.video`, `inspector.asset` (→ `common.image`), `collection.rename`, `collection.filter` (o "Mostrar" que também servia de ação → `common.show`), `layers.hide/lock/unlock`, `inspector.shape`, `inspector.text`, `card.direction(.left/.right)`. Os aliases de `SHARED_LABELS` apontam para as novas chaves; `card.direction.left/right` continuam como aliases derivados do enum. As chaves antigas foram removidas, sem órfãs. Novas guardas: as chaves `common.` ficam nas tabelas base, sob um prefixo que nenhuma área possui, e cada uma é lida em pelo menos dois lugares; a varredura de chaves cruas no e2e passou a incluir `common.`. Specs e2e e a receita `scripts/fidelity/recipes/card.mjs` atualizadas para as novas chaves (helper `libraryTabKey` em `tests/e2e/helpers.mjs`).
- `6b7454a` - **Aviso 4.** Os 55 `font-size` em px literal (folhas de área e base) usam a escala `--fs-*`. Para manter os pixels, a escala ganhou os outros tamanhos dos artboards, por papel: `--fs-micro` 9, `--fs-tiny` 10, `--fs-meta` 10.5, `--fs-compact` 12, `--fs-field` 12.5, `--fs-heading` 14. A largura da sparkline tem uma só fonte, `--spark-width: 60px` em `tokens.css`: `library.css` a usa na coluna da linha de sensor (ainda fixa em 1fr / 60px / 80px, `c28b861`) e na `.sparkline`, e `ui/library.js` a lê para o desenho (`sparkPath` recebe a largura do chamador). Guardas estáticas: nenhum `font-size` em px fora de `tokens.css`, largura da sparkline só no token. Os `font-size` em rem (39) ficaram como estão, fora do escopo do aviso.
- **Aviso 5.** Este resumo: status, galeria aprovada, `c28b861` registrado, seções T-4..T-8 traduzidas para pt-BR.

**Verificação.**

| Gate | Resultado |
| --- | --- |
| `npm run test:unit` | 431/431; linhas 99,48% |
| e2e afetados (`node scripts/e2e-slot.mjs`) | aviso 3: 364/364 (22 specs); aviso 4: 104/104 (library, scenarios-library, libre, connect, fidelity-integration) |
| `npm test` completo, quatro projetos, axe | unit 431/431 + e2e 536/536 |
| Diff visual (`shoot.mjs --only app`, dark e light, `--diff`) | sem mudança: as 168 capturas têm pelo menos uma execução depois das correções idêntica pixel a pixel a uma das duas baselines (`da86d86`) |

O diff visual tem ruído pré-existente: duas baselines do mesmo commit `da86d86` já diferem em 34 de 168 capturas (sparklines do demo, que dependem do número de amostras, e anti-aliasing de ±1 em poucas linhas). Por isso a comparação usou duas baselines e três execuções depois das correções. Uma execução completa depois das correções caiu no meio, num clique no rail interceptado pelo seletor da topbar; as duas execuções seguintes passaram nesse ponto sem erro. Rust não foi tocado.

### Correções do teste no app real (2026-10-15, D-16)

**Problema 1 — preview isolado com resíduos do estado anterior (causa raiz).** Nenhum cache de canvas, de renderer ou de resposta atrasada: reproduzido no app real (release via CDP do WebView2), mudanças de cor e de estilo eram limpas. O resíduo vinha do histórico do gráfico. `Histories` era dimensionado pelo gráfico mais longo de cada sensor e cortado de novo a cada troca de tema (cada preview de uma edição faz `set_theme`), enquanto o renderer desenhava a série inteira. Efeitos: um gráfico que divide o sensor com outro mais longo desenhava os pontos antigos do outro; uma janela encurtada e depois alargada perdia os pontos e mostrava os restos espremidos na borda direita. Correção (`96261a5`): o histórico guarda até `GRAPH_POINTS_MAX` (3600) valores, qualquer que seja a janela atual, e cada gráfico desenha só os seus `history` pontos mais recentes (`Histories::points`). Com D-16, uma mudança de intervalo abre outra série: nunca se misturam pontos de dois ritmos. Os testes de regressão falhavam antes da correção: golden `graph_own_window` e `a_window_cut_short_then_widened_again_keeps_its_points`. O demo não tem o problema, porque desenha cada frame num canvas novo e sem estado.

**Problema 2 — tempo do gráfico (D-16).**
- Core (`214737c`): `ElementKind::Graph` ganhou `interval_seconds: Option<u32>`. No JSON é `intervalSeconds`, opcional e omitido quando ausente. Ausente significa um ponto por refresh, como antes. O valor 0 é lido como ausente, e acima de 3600 s vale 3600.
  - `Histories` funciona por `SeriesId {key, cadence}`. Os ritmos possíveis são `EveryRefresh` ou `Every(d)`. Os registros usam `Tick::{Untimed, At{now, refresh}}`.
  - `ThemeRuntime::sample_on_time` amostra quando o refresh ou o próximo ponto de um gráfico vence; um intervalo menor que o refresh amostra antes. Um gráfico sem intervalo só recebe pontos no refresh.
  - Uma amostra que falha adia os pontos devidos (`skip`) em vez de repetir em loop.
  - Tela ao vivo e canvas dividem o runtime: ritmo idêntico, verificado no teste `the_live_screen_and_the_canvas_draw_a_graph_at_its_own_interval`.
- UI (`8bee9e6`):
  - O inspector do gráfico tem "Durata" (valor + s/min/h) e "Un punto ogni" (valor + s/min), feitos com `prefixedField` + `segmented` + `chipButton`.
  - As durações rápidas mantêm o intervalo.
  - A dica mono diz "N punti · a questo ritmo, da X a Y". A duração é limitada a 2..3600 pontos (`graphTimingPatch`).
  - Um gráfico antigo mostra o refresh como intervalo e avisa isso.
  - Gráficos novos: `intervalSeconds: 1`.
  - O eixo do preview e o pico usam a janela real (`−1 h`).
  - i18n en/pt-BR/it: textos de amostras removidos, nenhum hex novo.
- Demo (`2fd73bb`): desenha `history` pontos espaçados pelo intervalo (`demoGraphPoints`).
- Decisão: `bf08654`.

**Verificação.**

| Gate | Resultado |
| --- | --- |
| `cargo test --workspace` (via llvm-cov) | 1069 aprovados, 15 ignorados pré-existentes |
| `cargo clippy --workspace --all-targets -- -D warnings` / `cargo fmt --check` | verde |
| `cargo llvm-cov --workspace --fail-under-lines 80` | verde, linhas 91,94% |
| `npm run test:unit` | 435/435; linhas 99,48% |
| `inspector-preview.spec` (`e2e-slot`) | 20/20 |
| `npm test` completo, quatro projetos, axe | 536/536 |
| `shoot.mjs --area inspector --only app`, dark e light | inspector do gráfico conferido visualmente |

### Janela do gráfico como frase e preview no topo (2026-10-15, D-17)

- `cdc9be0` - **Preview sempre no topo (D-17b).** O preview isolado fica logo após o cabeçalho e antes das abas em todos os objetos (antes, Anel e Card o deixavam embaixo). O `inspector-sections.spec` verifica a ordem para Anel, Barra, Gráfico e Card.
- `74dae94` - **Frase compartilhada.** A frase de palavras e tokens dos gatilhos do Card virou a primitiva `sentence()` em `ui/fields.js`. O estilo dela está em `base.css` (`.sentence`, `.sentence-word`, `.sentence-token`), sem markup copiado. O módulo puro `src/sentence.js` divide um template traduzido em palavras e `{slots}`, e cada locale mantém a sua ordem de palavras. O Card renderiza igual (capturas da área card dentro do ruído).
- `ab88c24` - **Janela do gráfico como frase (D-17a).**
  - "Mostra l'ultima [1] [ora], con un punto ogni [30] [secondi]" usa inputs numéricos e selects nativos, com um template por locale (en/pt-BR/it).
  - A palavra antes da duração e os nomes das unidades concordam com a unidade e o número (`graphSentence`).
  - Embaixo fica uma régua do tempo de −janela a "ora": uma marca por ponto, ou uma a cada N quando há mais de 60 (`graphRuler`), e a contagem "120 punti".
  - As durações rápidas continuam. A dica "A questo ritmo, una finestra da X a Y" fica embaixo.
  - A semântica de D-16 (`graphTiming`/`graphTimingPatch`, 2–3600 pontos) não mudou.
  - Os dois seletores de unidade (3 contra 2 opções) agora são selects da mesma largura, e o e2e verifica isso.
  - `sentence()` junta palavras consecutivas e tira a margem do `.field` dentro da frase. Com isso, as palavras dos gatilhos do Card ficam alinhadas aos tokens (4 px a menos por linha).
  - `svgEl` foi para `ui/dom.js` (arco e régua).

| Gate | Resultado |
| --- | --- |
| `npm run test:unit` | 441/441; linhas 99,49% (`sentence.js` e `inspector-tabs.js` 100%) |
| e2e afetados (`e2e-slot`: inspector-sections, inspector-preview, card-inspector) | 56/56 e depois 44/44 |
| `npm test` completo, quatro projetos, axe | 536/536 |
| `shoot.mjs --area inspector` e `--area card`, dark e light | conferidos visualmente: preview no topo, frase e régua legíveis, gatilhos do Card iguais |

## Blocked tasks
- nenhuma

## Files modified
- `apps/bezel-studio/src/styles.css` (removido), `src/styles/*.css`, `src/index.html`, `src/app.js`, `src/i18n/index.js`, `src/i18n/areas/*.js`, `src/ui/{library,inspector,sensor-status,inspector-card,screen-panel}.js`, `src/relative-time.js`
- `apps/bezel-studio/tests/ui/{static-guards,i18n,relative-time}.test.mjs`, `tests/e2e/{scenarios-*,features-016-*}.spec.mjs`, `tests/e2e/helpers.mjs`, `playwright.config.mjs`, `scripts/e2e-slot.mjs`, `scripts/fidelity/**`
- `.jdi/phases/studio-redesign-fidelity/.gitignore`
- Correções da revisão: `src/styles/*.css`, `src/sensor-sampling.js` (novo), `src/inspector-tabs.js`, `src/library-model.js`, `src/i18n/{en,pt-BR,it,index}.js`, `src/index.html`, `src/ui/{fields,library,collection,gif-search,inspector,inspector-card,object-menu,preferences,standby,storage,themes-dialog}.js`, `tests/ui/{static-guards,i18n,library,library-model,sensor-sampling}.test.mjs`, 22 specs em `tests/e2e/` + `helpers.mjs`, `scripts/fidelity/recipes/card.mjs`

## Tests (T-1, histórico; resultados atuais em T-8 e em Correções da revisão)
- Unit: 362/362, linhas 99.42% (`npm run test:unit`).
- E2E: 396/396 nos 4 projetos (`node scripts/e2e-slot.mjs`, 2 workers).
- Screenshots (shoot.mjs, it, dark+light, 26 estados × 2): todos idênticos ao baseline pré-refactor. Única variação: `library/media-icons` alterna entre duas versões (~17 px) já entre duas execuções do baseline (não determinismo pré-existente do catálogo de ícones); cada execução pós-refactor bate com uma execução do baseline.
- Rust: não aplicável (T-1 não toca Rust).

## Hardware validation
- não aplicável

### Transições suaves de valor (D-2026-10-15-studio-redesign-fidelity-18)
- **Modelo:** campo opcional `valueTransition: {mode: none|smooth, durationMs}` por elemento (Anel, Barra, Ponteiro, Valor). Ausente = salta, como antes; nunca gravado quando ausente. Duração lida em 50..5000 ms; 0 salta.
- **Core:** `domain::transition` (ease-out cubic, tween por elemento, teto de 20 fps, ritmo da tela). O `ThemeRuntime` reinicia o tween a cada amostra a partir do valor mostrado; canvas, preview e tela usam o mesmo runtime; o renderer desenha os valores em movimento com a mesma faixa e o mesmo formatador.
- **Desempenho:** frames só enquanto algo se move; um frame por conexão; tela lenta recebe menos frames e, se não cabem dois frames na transição, vê o valor novo na hora. Medido: 20 fps (tela de 5 ms), 7,5 fps (150 ms), snap (250 ms); demo ~16,2 fps, 0 com movimento reduzido.
- **Atualização parcial:** já usada pelos drivers (retângulos sujos rev A/B/D e WeAct; runs na rev C); TUR_USB e WCH só frame inteiro, protegidos pelo snap. Nenhum opcode novo (`docs/reverse-engineering/rendering.md` § 4.1).
- **UI:** objetos novos nascem suaves a 400 ms; seção "Transição" (Nenhuma | Suave + 100–2000 ms) em Anel, Barra, Ponteiro e Valor com primitivos existentes.
- **Commits:** bfc60f1, d71e650, 2229198, b0c29f6, 6f6d9b6, fecd3e7, 6529103 (branch fid/transitions, merge na windows-improvements).
- **Gates após o merge:** cargo test 1093 ok; clippy limpo; unit 450/450. Validação em hardware pendente.

### Zoom do canvas com a roda (D-2026-10-15-studio-redesign-fidelity-19, item 3)
- Roda e pinça do touchpad fazem zoom centrado no cursor, deltas acumulados, passos e limites dos botões (5%–800%); modo de enquadramento de vídeo inalterado. Commits 0954e5a, 8d61cfe (feitos com ChatGPT/Codex, branch fid/wheel-zoom, merge 6210c4e).

### Memória do Bezel (D-2026-10-15-studio-redesign-fidelity-20)
- Amostragem única em `bezel-sensors` (`memory.rs`, `memory/windows.rs`): Toolhelp para enumerar processos, caminhos canônicos dos executáveis e SID do usuário (só esta instalação/usuário); `GetProcessMemoryInfo` → `PrivateWorkingSetSize`; resultado (inclusive falhas) em cache de 5 s; outros SOs → indisponível. `unsafe` só em chamadas Win32 de leitura, com justificativa, como em `windows/activity.rs`.
- Studio: pill "memoria N MB" na statusbar com detalhe por processo (Studio, WebView2, Light, leitor de sensores); consulta enquanto visível; demo com valores marcados. Light: item informativo desabilitado no menu do tray, atualizado ao abrir o menu.
- Commits b029a6d, b668e09, 735385e, e9eace4 (feitos com ChatGPT/Codex, branch fid/memory). Após o merge: cargo test 1098 ok, clippy/fmt limpos, unit 455/455, e2e memória/shell/transições/zoom 48/48.

### Um controle de cantos, foco do stage, passos numéricos e tipo de fundo (D-2026-10-15-studio-redesign-fidelity-22 e -23)

- `d78312f` - **Anel de foco do stage só pelo teclado.**
  - Causa: `onPointerDown` chama `preventDefault()` e foca `#stage-scroll` por script. Nesse caso o Chromium marca `:focus-visible`, e o anel aparecia em volta do stage inteiro depois de qualquer clique. Depois de um pan com o botão do meio o anel continuava lá.
  - Correção: `focus({ preventScroll: true, focusVisible: false })` no stage e no overlay do enquadramento. Tab continua mostrando o anel.
  - Spec `stage-focus.spec` (cliques, teclas, pan com e sem foco, Tab de volta, axe). Ela falha sem a correção.
- `a607505` - **Setas e spin buttons sem a UI pular.**
  - Causa: cada passo dispara `change`, o store atualiza e `inspector.render()` faz `replaceChildren`. O input focado era trocado por outro, e com isso se perdiam o caret, a repetição da tecla e o spin button. O preview novo nascia vazio (≈80 px mais baixo), então o `scrollTop` do painel era cortado. No Anel, aba Aspetto, no fim do painel: 228 → 148.
  - Correção:
    - Os inputs numéricos de `ui/fields.js` (`numberField`, `prefixedField`, alpha do `colorField`) guardam o handler num `WeakMap`.
    - `adoptControl(current, fresh)` mantém o input focado no lugar do seu equivalente no form novo. Ele recebe o handler, os atributos e o valor do novo, e é movido com `moveBefore` (o foco fica). Sem `moveBefore`, faz `insertBefore` e foca de novo.
    - `render()` anexa o form novo antes de tirar o velho e restaura o `scrollTop`. Quando o foco não é adotado, ele volta com `preventScroll`.
    - O preview do mesmo objeto mantém a imagem até chegar a próxima.
  - Spec `inspector-stepping.spec`: segura ArrowUp 12× em dois campos e verifica que o nó é o mesmo, que está focado, o valor, o `scrollTop` idêntico, a aba Aspetto e o Undo por passo. Ela falha sem a correção.
- `62b94d2` - **Um controle de raio de canto (D-14).** O desenho da capa do Player virou a primitiva `cornerRadii()`. Shape (retângulo), Barra (só raio único) e capa do Player usam essa primitiva. Saíram o switch "Angoli singoli" + números do Shape, o número solto da Barra, `.corner-grid/.corner-cover` e a chave órfã `inspector.individualCorners`. O `editing-017.spec` agora usa o botão "Singoli" no lugar do switch, com as mesmas asserções e mais uma de `aria-pressed`. Spec nova: `corner-radii.spec`.
- `d8c651e` - **Tipo de fundo explícito (D-23).**
  - A seção Sfondo do tema abre com o segmented `Colore | Dal PC | Dallo schermo` (`insp.bgType`).
    - Colore: cor + opacidade.
    - Dal PC: uma linha de explicação, o link "Apri il pannello Media" (`#bg-open-media`, novo `video.openMedia`) e "Usa un'immagine…/Usa un video…". Com vídeo, mostra o vídeo com enquadramento como antes.
    - Dallo schermo: uma linha, o link "Apri Schermo › Archivio" (`#bg-open-storage`), o nome do arquivo, o loop e a cor de fora para as janelas de vídeo.
  - Cada troca é um único comando `setTheme` (um passo de Undo) e traz de volta o último fundo daquele tipo; Dal PC só se o asset ainda existe. Um tipo ainda sem arquivo fica só escolhido na UI, com a dica "Lo sfondo resta com'è finché non scegli un file", e o tema não muda.
  - "Usa un colore pieno" e "Rimuovi lo sfondo" viraram a opção Colore (chaves removidas). "Colore" reutiliza `inspector.color`.
  - `video-background.spec` foi ajustado sem enfraquecer: o Colore aparece como escolha, Dal PC traz o vídeo de volta e o Undo volta à cor. Spec nova: `background-kind.spec`, com os três tipos, os dois links, teclado e um passo de Undo por troca, também com vídeo do display em `?demo=vendorCard`.
  - Receitas do `shoot.mjs` (inspector): `theme-pc`, `theme-screen`, `shape-corners`, `bar-look`.

**API da primitiva `cornerRadii` (`ui/fields.js`, estilos em `base.css`, modelo puro em `src/corner-radii.js`):**

```js
const { tool, control } = cornerRadii(
  { label, prefix, mode, same, each, corners: { topLeft, topRight, bottomRight, bottomLeft } }, // textos já traduzidos
  { radius, corners },          // corners: null (todos = radius) ou [tl, tr, br, bl]
  (next) => { /* next: { radius, corners } , nunca < 0 */ },
  { individual = true, box = null, unit = 'px' },  // box {width,height}: proporções do objeto no desenho
);
section('corners', titulo, [control], { tool });   // tool = segmented Uguali|Singoli (null se !individual)
```

- O `control` é um `role="group"` com `aria-label=label` e `data-mode="same|each"`.
  - Em `same`: o desenho e um `prefixedField` (aria-label `label`).
  - Em `each`: quatro `prefixedField` (`data-corner`) em volta do desenho, em ordem de leitura tl, tr, bl, br.
- O campo focado acende o canto dele (`.corner-mark`). O desenho é `aria-hidden`.
- `src/corner-radii.js`: `CORNERS`, `cornerValue(radius, corners)`, `cornerMode`, `withCornerMode`, `withRadius`, `withCorner`, `radiiOf`, `cornerDrawing(value, box, frame)`. Cada raio mantém a sua fração do lado menor, de modo que uma barra pill continua pill no desenho. Coberto por `tests/ui/corner-radii.test.mjs`.
- No inspector, `cornersSection(title, label, value, onChange, opts)` faz o mapeamento para os campos do tema: `coverRadius/coverCorners`, `radius/corners`, `radius`.

**Card:** o raio de canto do Card não existe nesta árvore. As faces do Card são de outra ferramenta, no worktree `bezel-fid-card` (`inspector-card.js`, `card.css`). Para alinhar quando houver controle de cantos lá, usar `cornerRadii()` + `cornerValue()` e não criar uma variante local.

Primitivos reutilizados: `segmented`, `prefixedField`, `propertySection`, `.text-button`, `icon`/`ICONS.media`/`ICONS.sdCard`, `.hint`, `checkField`, `colorField`. Nenhuma duplicação.

| Gate | Resultado |
| --- | --- |
| `npm run test:unit` | 471/471; linhas 99,43% (`corner-radii.js` coberto) |
| e2e afetados (`e2e-slot`): stage-focus, inspector-stepping, corner-radii, background-kind, video-background, device-video, editing-017, inspector-sections/preview, video-framing, gif-search, themes… | todos verdes. O único vermelho foi `canvas-wheel-zoom:87` (light-pt) em paralelo, verde em série 60/60 com `--workers=1 --repeat-each=3`; com e sem a correção ele se comporta igual |
| `npm test` completo, quatro projetos, axe | 612/612 |
| `shoot.mjs --area inspector --only app`, dark e light | conferido: cantos (Shape, Barra pill, capa do Player) e Sfondo (Colore, Dal PC, Dallo schermo sem quebra de linha) |

### Facetas da Card mais claras (D-2026-10-15-studio-redesign-fidelity-21)
- Feito com ChatGPT/Codex no branch fid/card-faces (51a0520, 3053859, 024bcc5), merge na windows-improvements. "Base" → "Sfondo comune" (linha separada, explicada); clique numa face = "Modifica questa faccia"; rotação automática vira trigger temporal "Ogni N s → faccia successiva | faccia X" com migração automática dos temas antigos (testada em Rust); faces em fila com transição por par (fallback para a transição geral). Relatório completo em `reports/studio-card-faces-d21.md`.
- Pós-merge: a Card usa `shapeForm()`, então o controle único de cantos (D-22) já a cobre; aplicado o rótulo `cardInsp.base` no seletor de face dos membros.
- Gates após todos os merges: cargo test 1108 ok, clippy limpo, unit 476/476, Playwright 615/616 com `canvas-wheel-zoom` (timing sob carga) verde em série 60/60.
