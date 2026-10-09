# Phase 15: Studio redesign fidelity — Context  (slug: studio-redesign-fidelity)

## Goal
Levar o Bezel Studio à paridade visual e funcional com o canvas "Bezel Evo — proposta UI/UX", artboard por artboard (exceto LogoAlternatives), corrigindo as lacunas de GAPS.md.

## Locked decisions
Valem da phase anterior (studio-redesign): D-4 (tokens, acento fixo), D-5 (tema claro), D-6 (fontes locais, CSP), D-7 (i18n, "Card"), D-8 (SVG inline, a11y), D-10 (Reiniciar sensores = só LibreHardwareMonitor), D-13 (rótulo neutro do Connect).
Substituída: D-9 (não se aplica a visuais; features do mockup agora são implementadas).

- D-2026-10-09-studio-redesign-fidelity-1: paridade visual por artboard; DOM/painéis/ids podem mudar; e2e atualizados sem enfraquecer asserções.
- D-...-fidelity-2: nenhum elemento visual omitido (ícones, miniaturas, rótulos, cabeçalhos, contagens, valores mono, ilustrações, dicas).
- D-...-fidelity-3: implementar TODAS as features do mockup omitidas antes, com dados reais do bridge e backend novo onde preciso. Excluídas (todos): "Prova senza schermo", badge "attiva ora", udev one-click, reinício de fontes de sensor além do Libre.
- D-...-fidelity-4: doers comparam mockup × app com gap/shoot.mjs (extensível); galeria lado a lado ao fim, aprovada pelo usuário.
- D-...-fidelity-5 (revista): Connect FORA do escopo; o cartão atual não muda (ver todos).
- D-...-fidelity-6: topbar do mockup (breadcrumb, "Non salvato", versão, chip da tela, "In diretta" verde); Salva continua visível (Ctrl+S) como botão secundário discreto, não laranja.
- D-...-fidelity-7: painéis laterais redimensionáveis (separator com teclado/aria, mín/máx, duplo clique reseta, persistido).
- D-...-fidelity-8: preview do inspector = objeto sozinho via novo comando Rust/Tauri (+ equivalente no demo).
- D-...-fidelity-9: tipografia do mockup (13px Sans, títulos 11px caixa alta, Mono para valores/prefixos); woff2 verificados no WebView2.
- D-...-fidelity-10: canvas com dot grid, legenda mono do dispositivo, zoom com "Adatta".
- D-...-fidelity-11: ícone de tray dedicado (16/20/24/32px) gerado por build-icons.mjs, usado em Light e Studio.
- D-...-fidelity-12: light+dark com axe, tokens, i18n en/pt-BR/it, "Card" fica "Card".
- D-...-fidelity-13: corrigir truncamento de nomes em Layers.

## Canonical refs
- .jdi/phases/studio-redesign-fidelity/GAPS.md (lacunas e feedback literal)
- .jdi/phases/studio-redesign/design/project/*.dc.html (referência visual não confiável) e canvas.json
- .jdi/phases/studio-redesign/{CONTEXT,PLAN,SUMMARY,REVIEW,SHIPPED}.md
- gap/shoot.mjs (screenshots mockup × app; saída em gap/mock e gap/app)
- apps/bezel-studio/src-tauri/tauri.conf.json (CSP); scripts/build-icons.mjs; crates/bezel-cli/src/light_tray.rs

## Out of scope
- LogoAlternatives; os 4 itens excluídos em D-3 (já em `.jdi/todos/2026-10-09-studio-redesign.md`, nenhum todo novo).

## Definition of Done

### Auto-verifiable
- [ ] Testes do Studio: unit com cobertura >= 80% e Playwright + axe nos 4 projetos (light/dark)
      **Verify:** `npm test` em apps/bezel-studio sai com código 0 (inclui cobertura de linhas >= 80% e zero violações axe)
      **Source:** CONTEXT
- [ ] Rust íntegro e coberto
      **Verify:** `cargo test --workspace`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo fmt --check` com código 0 e `cargo llvm-cov --workspace` com linhas >= 80% (cargo em %USERPROFILE%\.cargo\bin, já no PATH)
      **Source:** CONTEXT
- [ ] Guardas estáticas mantidas: CSP inalterada, sem fonts.googleapis/gstatic, sem hex fora dos blocos de token
      **Verify:** teste em tests/ui executado por `npm run test:unit`
      **Source:** CONTEXT
- [ ] Paridade de chaves i18n en/pt-BR/it
      **Verify:** teste em tests/ui compara as chaves dos três locales e falha em divergência
      **Source:** CONTEXT
- [ ] Ícone de tray com dimensões corretas
      **Verify:** teste automatizado de dimensões (16/20/24/32px) do asset gerado por `node scripts/build-icons.mjs`; Light e Studio referenciam o novo asset
      **Source:** CONTEXT
- [ ] Comando de preview isolado renderiza só o elemento com propriedades aplicadas
      **Verify:** testes Rust do novo comando: (a) pixels fora do elemento ficam transparentes/fundo neutro, outros elementos ausentes; (b) mudar uma propriedade (cor/tamanho/valor) altera o resultado
      **Source:** CONTEXT
- [ ] Painéis redimensionáveis persistem e são acessíveis
      **Verify:** spec Playwright: separator com aria-valuenow, teclas alteram largura, duplo clique reseta, largura persiste após reload, respeitando mín/máx
      **Source:** CONTEXT
- [ ] Layers sem truncamento indevido
      **Verify:** spec Playwright: nomes "Background" e "CPU Analog" (ou equivalentes do demo) exibidos por completo na largura padrão
      **Source:** CONTEXT

### Manual
- [ ] Galeria lado a lado aprovada pelo usuário para todos os artboards exceto LogoAlternatives
      **Verify:** human confirmation required
      **Evidence:** página da galeria gerada a partir de gap/shoot.mjs com pares mockup × app de cada artboard/estado
      **Source:** CONTEXT

## Notes
- Para o planner (galeria): os mockups renderizam sem runtime DC e `{{…}}` aparece literal. Sugestão: a galeria lê valores de exemplo do script DCLogic de cada artboard e os substitui antes do screenshot; se inviável, aceitar renderização estática (layout vale como referência) e anotar na página.
- Painéis laterais: escala do canvas e seleção de workspace nos e2e dependem das larguras; fixar largura padrão nos specs.
- Preview isolado exige comando Tauri novo + equivalente no backend demo (D-8).
- Gates ao fim de cada wave; itens do GAPS.md (Shell, Widget, Inspector, Card, Livelli, outros painéis (Connect fora do escopo), tray) mapeiam para waves.
