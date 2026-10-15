# Phase 15: Studio redesign fidelity — Summary  (slug: studio-redesign-fidelity)

**Status:** partial (T-1, T-2 e T-3 concluídas; Wave 2 e T-8 pendentes)

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

### T-4 - Library: Widget, Sensori, Livelli, Media, Temi

- Head `fid/t4`: `48892b6`; integrato con `--no-ff` in `c6f726b`.
- Commit di completamento: `3949d92`, `6699d83`, `27d6b35`, `c621527`, `c8987ab`, `48892b6` (WIP iniziale `f9d47ea`).
- Ricerca e tre gruppi Widget; sparklines dal vero storico `updateReadings`; filtro Livelli per nome/sensore, selezione multipla con Raggruppa/Crea card, nomi completi e discendenti visibili con filtro. Media con totali reali. Temi: Nuovo tema, ricerca, Duplica/Apri; il dialogo riutilizza gli stessi nodi della griglia del pannello.
- Report dell'agente in conversazione: unit 390/390 (99,45%), e2e 212/212; un precedente `ERR_NO_BUFFER_SPACE` è stato ricontrollato in serie e con l'intera selezione di spec. Nessun REPORT.md persistente trovato nella galleria della worktree. I risultati dell'integrazione sotto sono stati nuovamente verificati.
- Primitivi: searchField, sectionTitle/count, chipButton, kindIcon, dashedHint, screenThumb; ownership/geometria già condivise per il drop dei sensori. Nessun file fuori dal piano nel branch T-4.
- Residui: nomi Livelli su due righe a 272 px (per mantenerli completi), tavola autonoma a 360 px; Temi conserva metadati e controlli reali aggiuntivi; catalogo sensori e stato importazione provengono dal bridge.

### T-5 - Inspector: core e preview isolato

- Head `fid/t5`: `add6b9a`; merge `f5ff9b0`. Commit di completamento: `9f6d2e4`, `15e4a25`, `5981600`, `672a8d7`, `add6b9a` (WIP `07400e4`).
- Header, azioni, tabs native, posizione 2 x 2, sorgente/arco Ring, controlli Graph e Player. Focus mantenuto dopo il render. Il preview usa `host.renderElement(id, opts)` e il bridge, con coalescing, scarto delle risposte obsolete, fit proporzionale e animazione `nextMs`; non ritaglia il canvas generale.
- Report in conversazione: unit 389/389 (99,46%), e2e 124/124, screenshot dark/light. REPORT.md persistente assente. Nessun file fuori dal piano nel branch T-5.
- Primitivi: prefixedField/fieldGrid, segmented, switchRow, rangeField, chipButton, listCard e icone; scheduler e animazione condivisi. La proposta di richiedere activity permanentemente NON è stata applicata: T-8 la sostituisce con la richiesta condizionale.
- Residui: Ring mantiene il preview dopo le proprietà; Graph/Player hanno geometria dopo i controlli dati. Dimensioni del preview, valori e app seguono l'oggetto effettivo, non i dati del mockup.

### T-6 - Screen, Storage, SensorStatus

- Head `fid/t6`: `32226db`; merge `24ff0d6`. Completamento dopo WIP `e604796`: `0ace380`, `af7747d`, `9f52bdc`, `cedf96a`, `a665e4b`, `d50767c`, `700ad64`, `edd7343`, `0ed11d1`, `32226db`; lavoro precedente `a7a03b1`, `2b47b18`, `ef88455`.
- Screen con dati reali del dispositivo e controlli standby. Storage: capacità interna/SD, barra per tipo, file di avvio reale, filtri per supporto e highlight del drop su avvio, azioni da tastiera con nomi accessibili. SensorStatus: quattro stati, riavvio Libre, popover con hardware fisico distinto anche quando i nomi coincidono, valore/fonte e tempo di lettura.
- Nessun REPORT.md persistente trovato nella worktree T-6; riepilogo ricostruito dal diff, dai commit e dall'handoff. Verifica autonoma T-8: unit 399/399 dopo questo merge; tutte le spec T-6 sono incluse nei gate completi finali.
- Primitivi: campi nativi, switch, segmented/chip, pill, sezioni e icone condivise; modello puro storage-breakdown e raggruppamento hardware testati. Nessun file fuori dal piano nel branch T-6. Il riquadro Connect è rimasto fuori dal redesign.
- Residui: Storage conserva la modalità a tutta larghezza; inventario, capacità e avvio sono quelli del bridge. Screen conserva i controlli avanzati reali; SensorStatus mostra i provider/hardware effettivi.

### T-7 - Card: Facce, Movimento, Trigger

- Head `fid/t7`: `1823f0d`; merge `70f61af`. WIP `6f69571`, completamento `7c7d1b0`, test `1823f0d`.
- Fonte: `F:/dev/bezel-fid-t7/.jdi/phases/studio-redesign-fidelity/gap/gallery/card/REPORT.md` e relativa `T7-integration.patch` (unico report persistente presente nelle gallerie delle quattro worktree).
- Base come stato UI senza Undo, miniature proporzionali e raster per faccia, oggetti/spostamento e comandi esistenti del documento. Movimento con stepper, intervalli rapidi, radio illustrati, durata e direzione, base comune e `card.animateNext`. Trigger in frasi native, priorità/ritorno, riordino pointer/tastiera, ritorno comune e suggerimenti dal sample; escluso il badge "attiva ora". "Card" resta "Card".
- Report dell'agente: unit 385/385 (99,45%), e2e 68/68 nei quattro progetti; card-animation seriale 12/12 dopo un primo risultato sensibile al timing. Nessuna assertion indebolita. Otto file nel diff rispetto alla base, tutti nel piano.
- Primitivi: prefixedField/fieldGrid, switchRow, segmented, rangeField, chipButton, listCard, screenThumb, dashedHint e icone; modello puro card-rules. La T-8 passa bridge+host, ripristina il parametro bridge del core T-5 e fotografa Card realmente popolate.
- Residui: due facce e contenuti effettivi anziché i tre esempi del mockup; tile e testi completi occupano più spazio e il badge della faccia segue il nome. Il quarto tab Aspetto conserva le opzioni esistenti. Effetti illustrati a tratto; aiuto completo nel details. In T-8 geometria e preview sono stati spostati DOPO il contenuto Card per avvicinare il layout al riferimento.

### T-8 - Integrazione, consolidamento e gate finali (2026-10-15)

Merge eseguiti nell'ordine richiesto, senza conflitti e senza violazioni di ownership nei merge:

| Ordine | Branch / head | Commit merge | Unit subito dopo il merge |
| --- | --- | --- | --- |
| 1 | fid/t4 - 48892b6 | c6f726b | 390/390 - 99,45% |
| 2 | fid/t6 - 32226db | 24ff0d6 | 399/399 - 99,46% |
| 3 | fid/t5 - add6b9a | f5ff9b0 | 412/412 - 99,48% |
| 4 | fid/t7 - 1823f0d | 70f61af | 421/421 - 99,49% |

Commit propri dell'integrazione:

- `7c9c6b8` - host/bridge Card, richieste activity condizionali e larghezze D-15 con unit/e2e.
- `4a0f4e1` - rustls 0.23.45 - 0.23.46 nel lockfile, correggendo quattro advisory del 14 ottobre (una media, tre basse).
- `deea4ee` - contatore atomico nei nomi delle directory temporanee del test handoff, per evitare collisioni durante llvm-cov parallelo. Nessuna logica runtime cambiata.
- `1a3e327` - sezioni, icon button, durate, CSS e prime famiglie di testi condivisi; rimozione delle etichette obsolete.
- `a45084d` - contenuto Card prima di geometria/preview.
- `6e846b1` - tutte le ulteriori etichette identiche consolidate in chiavi canoniche; mapping unico dei nomi derivati dagli enum.
- `8572094` - galleria completa, Logo, Card popolate, ritagli dei pannelli e acquisizioni incrementali.
- `763eb1a` - dimensioni esplicite delle immagini per evitare salti di layout durante il lazy loading della galleria.
- `e1068b0` - dettagli Screen comprendenti standby e acquisizione incrementale per stato.
- `25ff273` - filtro di luminosità applicato una sola volta per frame prima della proiezione flip del demo, con regression test sui draw filtrati e sulle facce renderizzate.

**Activity e performance.** `shownSensorKeys` mantiene ordine e richieste della Library, aggiunge `activity.processes` e `media.sessions` solo con un singolo Player selezionato o una Card con trigger, e solo quando l'inspector è mostrato. Multi-selezione, selezione diversa, Card senza trigger, Storage wide e finestra nascosta rilasciano la richiesta aggiuntiva. La firma della richiesta evita invoke duplicati. Unit coprono selezioni/visibilità; l'e2e verifica Player - Ring - Card - aggiunta/rimozione trigger con Undo/Redo - Storage - editor e le miniature raster reali.

**D-15.** `.wide-dialog`: 720 px, `.udev-dialog`: 560 px, `.video-preview-dialog`: 850 px; limite comune `calc(100vw - 32px)`. E2e sui veri dialoghi nei quattro progetti, a 1280, 640 e 480 px, inclusi chiusura nativa e axe.

**D-14/G9.** Controllati tutte le foglie CSS, ui/*.js, i18n, path SVG e helper puri. `propertySection` e `iconButton` sono ora in fields.js; Card usa il contratto unico delle sezioni senza fallback del vecchio inspector. `durationParts` è una sola implementazione, riutilizzata dalle regole Card; i nomi dei tab derivano dal modello comune. Venti gruppi di blocchi CSS identici fra aree sono definiti una sola volta in base.css (campi, layout, stati, testo troncato, selettori nativi sovrapposti e bottoni). Rimossi 27 testi obsoleti e consolidati i testi comuni; minuti/ore hanno chiavi `unit.*`. Le etichette dinamiche derivate dagli enum vengono risolte con `canonicalLabelKey`, senza copie delle traduzioni. Guardie automatiche: nessun corpo CSS con almeno tre dichiarazioni ripetuto fra fogli nello stesso contesto; nessun path SVG uguale in più moduli UI; nessun testo identico in tutti e tre i locali sotto due chiavi del catalogo intero. Test separato verifica che ogni label derivata punti a una chiave canonica esistente in ogni locale, preservando parametri e risultato. Plurali e traduzioni che differiscono in almeno un locale restano distinti. Nessuna duplicazione individuata rimasta; i controlli automatici sono euristici, non una prova generale su ogni algoritmo.

**Gate finali.**

| Gate | Risultato |
| --- | --- |
| npm run test:unit (anche nelle due esecuzioni npm test) | 426/426; righe 99,48% |
| npm test, quattro progetti, worker predefiniti (10), axe | 536/536; seconda passata di stabilità: 536/536, verde |
| Card / inspector-sections / card-animation, workers=1, repeat-each=3 | 120/120 prima del completamento del renderer; card-animation originale 12/12 in serie dopo 25ff273 |
| cargo test --workspace | 1058 passati, 15 ignorati preesistenti |
| cargo clippy --workspace --all-targets -- -D warnings | verde |
| cargo fmt --check | verde |
| cargo llvm-cov --workspace --fail-under-lines 80 | verde, righe 91,79% (regioni 91,30%) |
| npm audit --audit-level=high | 0 vulnerabilità |
| cargo audit | verde, nessuna vulnerabilità |

La prima suite completa aveva 11 fallimenti dovuti all'ordine dei sensori e alla vecchia chiave del suggerimento Media: ordine ripristinato e spec aggiornata al testo attuale, senza rimuovere o rendere meno precisa l'assertion. Una passata intermedia ha avuto 10 errori ENOENT degli artefatti Playwright perché un secondo run nello stesso worktree ne aveva ripulito la directory; invalidata e ripetuta senza sovrapporre run. Passate intermedie hanno riprodotto flip con 3 hash invece di 4; la ripetizione seriale era verde 12/12. Nel demo la luminosità veniva filtrata di nuovo per ogni striscia della proiezione: ora il filtro viene eseguito una sola volta per frame. La nuova spec verifica un solo draw filtrato e facce con pixel diversi; il corpo della spec animazione originale resta identico byte per byte, inclusi 10 campioni, intervallo di 140 ms, durata e soglia >= 4 hash. Il primo llvm-cov ha rilevato la collisione delle directory temporanee corretta in deea4ee. Nessun timeout aumentato, nessuna soglia abbassata.

**Galleria.** Comando riproducibile `node scripts/fidelity/gallery.mjs`; pagina `.jdi/phases/studio-redesign-fidelity/gap/gallery/index.html`, 16 artboard - dark/light, italiano, Connect e LogoAlternatives esclusi. 132 acquisizioni canoniche nel manifest, più i ritagli per il confronto; Card riacquisite dopo l'ultimo spostamento del layout tramite `shoot.mjs --area card --merge`. Riferimenti espansi con dc-shim; eventuale fallback STATICO viene mostrato con il motivo. Verificati nel browser 32 sezioni e tutti i percorsi delle immagini. Screenshot di controllo `gallery-card-review.png`. Ogni sezione elenca i residui specifici; il tema chiaro usa i token chiari mentre i riferimenti sono prevalentemente scuri. Approvazione visiva manuale dell'utente ancora pendente.

**File fuori dagli elenchi puntuali del piano.**

- `Cargo.lock`: patch di sicurezza necessaria per rendere verde cargo audit.
- `crates/bezel-power/src/handoff.rs`: sola correzione dell'isolamento del test temporaneo emersa dal gate llvm-cov.
- `apps/bezel-studio/src/ui/preferences.js`: sostituzione delle chiavi di etichette comuni con le chiavi condivise, testo e comportamento invariati.
- `apps/bezel-studio/tests/e2e/connect.spec.mjs`: stessa assertion sul bottone Close, con chiave canonica `dialog.close`; nessun redesign del Connect. Nel suo modulo UI sono cambiate solo le chiavi di testo già identico.

Le nuove spec `fidelity-integration.spec.mjs` e `inspector-activity.test.mjs` attuano la richiesta esplicita di regression test T-8 e rientrano nei glob aggregati del piano. Nessun eseguibile consegnato o sostituito; VERSION e dist/bezel invariati. Il file utente non tracciato `.claude/launch.json` è rimasto intatto. Documentazione in un commit separato dal codice. Log finali: `gap/gallery/logs/`; report consultabile anche in `gap/gallery/REPORT.md`.

## Blocked tasks
- nenhuma

## Files modified
- `apps/bezel-studio/src/styles.css` (removido), `src/styles/*.css`, `src/index.html`, `src/app.js`, `src/i18n/index.js`, `src/i18n/areas/*.js`, `src/ui/{library,inspector,sensor-status,inspector-card,screen-panel}.js`, `src/relative-time.js`
- `apps/bezel-studio/tests/ui/{static-guards,i18n,relative-time}.test.mjs`, `tests/e2e/{scenarios-*,features-016-*}.spec.mjs`, `tests/e2e/helpers.mjs`, `playwright.config.mjs`, `scripts/e2e-slot.mjs`, `scripts/fidelity/**`
- `.jdi/phases/studio-redesign-fidelity/.gitignore`

## Tests (T-1, storico; risultati correnti nella sezione T-8)
- Unit: 362/362, linhas 99.42% (`npm run test:unit`).
- E2E: 396/396 nos 4 projetos (`node scripts/e2e-slot.mjs`, 2 workers).
- Screenshots (shoot.mjs, it, dark+light, 26 estados × 2): todos idênticos ao baseline pré-refactor. Única variação: `library/media-icons` alterna entre duas versões (~17 px) já entre duas execuções do baseline (não determinismo pré-existente do catálogo de ícones); cada execução pós-refactor bate com uma execução do baseline.
- Rust: não aplicável (T-1 não toca Rust).

## Hardware validation
- não aplicável
