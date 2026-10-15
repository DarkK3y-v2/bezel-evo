# Phase 15: Review  (slug: studio-redesign-fidelity)

**Verdict:** APPROVED_WITH_WARNINGS

Revisado em 2026-10-15 sobre `windows-improvements` @ `c28b861` (inclui o ajuste das linhas de sensores pedido após a galeria). Base da phase: `edc6e36`; base da Wave 2: `33e4b03`. Todos os gates foram reexecutados nesta revisão; nenhum número abaixo foi copiado do SUMMARY.md.

## Gates
| Gate | Status | Details |
|---|---|---|
| Build | PASS | `cargo build --workspace --locked`, exit 0 (o lock com rustls 0.23.46 é aceito por `--locked`) |
| Tests | PASS | Rust: 1058 passed, 0 failed, 15 ignored (hardware, preexistentes); igual à T-3/T-8, sem queda. Studio: unit 426/426; Playwright 536/536 nos 4 projetos (light-pt, dark-pt, light-en, dark-en), 10 workers, primeira passada; `card-animation` passou, sem precisar de nova execução em série |
| Coverage | PASS | Rust 91.79% lines (TOTAL do `cargo llvm-cov`, `--fail-under-lines 80` exit 0; regions 91.30%). Studio unit 99.48% lines (all files) |
| Lint | PASS | `cargo fmt --all --check` e `cargo clippy --workspace --all-targets --locked -D warnings` limpos. Nenhum `#[allow` novo na phase |
| Hexagonal/Safety/Protocol/Hygiene | PASS | 5.1, 5.2, 5.3a, 5.4 sem saída. 5.5/5.6: nenhum `unsafe`; os `unwrap` novos (backend.rs, element_preview.rs) ficam em `#[cfg(test)]`. 5.7/5.9: só achados preexistentes em doc comments e módulos de teste (core/devices não foram tocados pela phase, exceto `runtime.rs` da T-3, sem achados). 5.8: protocolo não tocado. 5.10: `render_element_preview` e `duplicate_theme` são `async fn`. 5.11: `cargo audit` limpo (634 crates), `npm audit --audit-level=high` 0 vulnerabilidades, nenhum segredo |
| Consistency | PASS (com WARN) | Todos os commits com scope `studio-redesign-fidelity`. Arquivos fora do plano julgados abaixo, todos aceitáveis. D-5, D-6, D-14, D-15 e a amostragem condicional de activity conferidos no código. SUMMARY.md com cabeçalho desatualizado (WARN) |
| UI Validation | PASS | `npm test` com axe (zero serious/critical) em claro e escuro, pt e en; dados reais do bridge; cores só por tokens; SVG inline; controles nativos |
| DoD | PASS | 8/8 Auto PASS; Manual (galeria) confirmado pelo usuário. Itens não verificáveis aqui listados como pendentes, sem bloquear |

## Blockers
Nenhum.

## Warnings
1. **G9/D-14: variante de primitivo fora de `base.css`.** `apps/bezel-studio/src/styles/connect.css:40-44` define `.pill[data-tone="warn"|"danger"|"info"]`, com o comentário "pending promotion to base.css, T-8". A T-8 não fez essa promoção. O tom `warn` fica dividido entre `base.css:136` (color) e `connect.css:42` (border/background). Hoje só o chip de sensores usa esses tons, então não há cópia, mas a regra pede um primitivo em um só lugar. Sugestão: mover as três regras para `base.css` junto de `ok`/`accent` e remover o comentário.
2. **Nome duplicado com semântica diferente (clean-code).** `shownSensorKeys` é exportado por `src/inspector-tabs.js:8` (chaves + activity condicional, criado na T-8) e por `src/ui/library.js:60` (chaves visíveis no catálogo). Sugestão: renomear o primeiro, por exemplo para `sampledSensorKeys`. A política de amostragem também caberia melhor num módulo próprio do que em `inspector-tabs.js`.
3. **Chaves canônicas emprestadas de outras áreas.** `preferences.js:195` usa `framing.done`, `preferences.js:143` usa `library.sensors`, `collection.js:140` usa `inspector.delete` e o delete do Storage usa `standby.album.remove` (via spec `storage.spec.mjs`). Isso está de acordo com D-14 (uma chave por texto comum). O texto foi verificado: 84 consultas de aliases `SHARED_LABELS` nos 3 locales têm 0 diferenças contra `33e4b03`, e a paridade en/pt-BR/it está completa (0 faltando, 0 sobrando). O problema é o namespace: ele acopla áreas sem relação. Se alguém mudar o texto do framing, a tela de Preferências também muda. Sugestão: um namespace neutro (`common.*`, como já existe `dialog.close`).
4. **Números mágicos de tipografia.** As folhas de área ainda têm `font-size` em px literal (ex.: `connect.css` 10.5px/12px/14px, ao todo 55 ocorrências), embora exista a escala `--fs-*` em `tokens.css`. O 60 da sparkline também aparece duas vezes, em `ui/library.js:202-203` e em `library.css` (grid `60px`, `.sparkline width: 60px`).
5. **SUMMARY.md desatualizado.** A linha 3 ainda diz "partial (… Wave 2 e T-8 pendentes)". A aprovação da galeria aparece como "pendente", e `c28b861` não está registrado. As seções T-4..T-8 estão em italiano, mas a convenção para `.jdi/` é pt-BR.
6. **Manual não verificável nesta revisão** (fora do DoD Auto, sem bloquear, por instrução):
   - fontes woff2 carregadas no WebView2 (D-fidelity-9, `document.fonts.check` em `tauri dev`/release);
   - ícone de tray em barra de tarefas real, clara e escura (D-fidelity-11);
   - build de release.

## Specs alteradas na Wave 2 (G4): sem enfraquecimento
Revisei `git diff 33e4b03..HEAD -- apps/bezel-studio/tests/e2e`: 28 arquivos, +1225/-107. Todas as linhas removidas se encaixam em uma destas categorias:
- **Troca de chave pela canônica, com o mesmo texto** (`gif-search`, `scenarios-shell`, `storage-manager`, `themes`, `video-background`, `shell`, `connect`, entre outros). A asserção é a mesma.
- **Mudança de controle exigida pelo artboard.** `card-animation`/`cards`: select -> radiogroup/switch/botões de direção. O corpo da animação original continua com 10 amostras, 140 ms e >= 4 hashes.
- **Mudança de comportamento decidida:**
  - `inspector-sections`: o preview isolado (D-8) agora aparece fora do canvas. A asserção "previewOff" virou uma checagem de pixels visíveis, mais forte. A ordem das seções agora é verificada em todos os filhos.
  - `libre`: com outros providers o chip fica visível (artboard SensorStatus, D-10). Ganhou mais asserções: tons, linhas por hardware, foco no Escape.
  - `standby`: a ordem das opções segue o artboard (`ef88455`). A navegação por teclado foi ajustada com o mesmo número de passos.
  - `storage`: o total de bytes passou para o grupo do medidor.

Não houve timeout aumentado, `expect` removido sem substituto equivalente ou mais forte, nem seletor afrouxado. `helpers.mjs` e `playwright.config.mjs` não mudaram desde `33e4b03` (`retries: 0`, axe serious/critical). Novas guardas em `static-guards.test.mjs`: corpos CSS repetidos entre folhas e path SVG em mais de um módulo.

## Pontos verificados a pedido
- **D-5 (Connect fora do escopo):** `ui/connect.js` só trocou `connect.hide` por `dialog.close` (2 linhas). `connect.spec.mjs` mantém a mesma asserção com a chave canônica. As mudanças em `connect.css` são do chip de sensores (T-6, dono previsto no plano) e da mudança de `.connect-device-list` para `base.css:271`. O cartão Connect não foi redesenhado.
- **D-6 (Salvar secundário):** `#save` é `.text-button.save-button` (`index.html:52`, `shell.css:42`), sem laranja e com `Ctrl S`.
- **D-15:** `base.css:223-225` vem depois de `.confirm-dialog` (`base.css:222`), com 720/560/850 px e `calc(100vw - 32px)`. `fidelity-integration.spec` confere as larguras em 1280/640/480 px com axe.
- **Activity sob demanda:** `shownSensorKeys` (`inspector-tabs.js:8`) só adiciona `activity.processes`/`media.sessions` com um único Player selecionado ou uma Card com triggers, inspector visível e janela visível. `app.js:166-176` evita invoke repetido comparando a assinatura. Os casos estão cobertos em unit (`inspector-activity.test`) e e2e (Player -> Ring -> Card -> trigger com Undo/Redo -> Storage -> volta).
- **Dados reais:** nenhum valor do mockup em `src/` fora de `demo-*`. `FALLBACK_APP = 'Spotify'` (`card-rules.js:24`) é o padrão das regras que já existia antes da phase (`33e4b03:src/ui/inspector-card.js:43,52`), não um valor de mockup.
- **Cores:** nenhum hex/rgb novo fora de `tokens.css`. Os `rgb()` de `shell.css`/`base.css:226` já existiam em `33e4b03`. As variações novas usam `color-mix()` de tokens.
- **SVG:** nenhum path fora de `ui/icons.js`, exceto os gerados dinamicamente (arco, sparkline). O `<img src="icon.svg">` do logo já existia.
- **`c28b861`:** a linha de sensor sempre tem 3 filhos (`library.js:223-230`), então a grade `1fr/60px/80px` é segura. Coberto pela suíte completa verde em HEAD.
- **Arquivos fora do plano:**
  - `Cargo.lock` (rustls 0.23.45 -> 0.23.46): aceitável, é um patch de segurança e `cargo audit` está limpo.
  - `crates/bezel-power/src/handoff.rs`: aceitável. Só o helper de teste mudou (contador atômico no nome do diretório temporário); não há código de runtime.
  - `ui/preferences.js`: aceitável, só troca de chave com o mesmo texto (ver warning 3).
  - `connect.js`/`connect.spec.mjs`: aceitável (ver D-5 acima).

## DoD Checklist (gate 8)
| # | Criterion | Source | Type | Status | Evidence |
|---|---|---|---|---|---|
| 1 | Testes do Studio: unit >= 80% + Playwright + axe nos 4 projetos | CONTEXT | Auto | PASS | `npm test` exit 0: unit 426/426, linhas 99.48%; Playwright 536/536, axe sem serious/critical |
| 2 | Rust íntegro e coberto | CONTEXT | Auto | PASS | `cargo test` 1058/0/15 ignored; clippy -D warnings e fmt limpos; llvm-cov TOTAL 91.79% lines |
| 3 | Guardas estáticas (CSP, sem Google Fonts, hex só em tokens) | CONTEXT | Auto | PASS | `static-guards.test.mjs` verde em `npm run test:unit` |
| 4 | Paridade i18n en/pt-BR/it | CONTEXT | Auto | PASS | `i18n.test.mjs` verde; conferência independente: 0 chaves faltando/sobrando em pt-BR e it |
| 5 | Ícone de tray 16/20/24/32 px, usado por Light e Studio | CONTEXT | Auto | PASS | `app-icons.test.mjs` ok 6-8 |
| 6 | Preview isolado renderiza só o elemento, e propriedades alteram o resultado | CONTEXT | Auto | PASS | Testes Rust de `element_preview`/`backend` na suíte de 1058; `inspector-preview.spec` verde |
| 7 | Painéis redimensionáveis persistem e são acessíveis | CONTEXT | Auto | PASS | `panels.spec.mjs` verde nos 4 projetos |
| 8 | Layers sem truncamento | CONTEXT | Auto | PASS | `library.spec.mjs` verde nos 4 projetos |
| 9 | Galeria lado a lado aprovada (exceto LogoAlternatives) | CONTEXT | Manual | CONFIRMED | O usuário revisou `gap/gallery/index.html` e pediu uma única correção, as colunas fixas das linhas de sensores, feita em `c28b861`. Depois mandou prosseguir |
| - | Fontes woff2 no WebView2 (D-fidelity-9) | CONTEXT/PLAN | Manual | MANUAL_REQUIRED (não verificável aqui) | Sugestão: "`tauri dev` + release: `document.fonts.check('13px IBM Plex Sans')` e Mono = true em AAAA-MM-DD" |
| - | Tray em barra clara/escura real (D-fidelity-11) | PLAN | Manual | MANUAL_REQUIRED (não verificável aqui) | Sugestão: "Tray do Studio e do Light legível em barra clara e escura, Windows 11, escala 100/150%" |
| - | Build de release | PLAN | Manual | MANUAL_REQUIRED (não verificável aqui) | Sugestão: "`cargo tauri build` ok e app abre com CSP inalterada" |

## Recommendation
A phase pode seguir para `/jdi-ship`. Todos os gates automáticos passaram na reexecução, e o item manual do DoD (galeria) foi confirmado pelo usuário. Antes ou logo depois do ship:
- promover os tons `warn`/`danger`/`info` de `.pill` para `base.css` (warning 1);
- renomear o `shownSensorKeys` de `inspector-tabs.js` (warning 2);
- atualizar o cabeçalho e o status da galeria no SUMMARY.md (warning 5).

As checagens de WebView2, do tray em barra real e do build de release ficam registradas como pendências manuais, sem bloquear o ship.
