# Diferenças mockup × app (studio-redesign-fidelity)

Levantamento de 2026-10-09 sobre `windows-improvements` @ f8d0cfa. Fonte: canvas
`.jdi/phases/studio-redesign/design/project/*.dc.html` × app em modo demo
(`?demo=turing88`, dark, locale it, 1440×900). Screenshots reproduzíveis com
`gap/shoot.mjs` (saída em `gap/mock/` e `gap/app/`, não versionada).

Observação: os mockups foram renderizados sem o runtime DC, então `{{…}}` aparece
literal nas listas; o layout estático vale como referência.

## Feedback do usuário (literal, 2026-10-09)
1. Os dois painéis laterais não são redimensionáveis horizontalmente.
2. Widget não tem a divisão do mockup.
3. O fundo da área do canvas não é pontilhado.
4. As fontes estão diferentes.
5. Em geral está muito distante do mockup.
6. Faltam ícones em toda parte e os labels são feitos de outro jeito.
7. A pré-visualização deve mostrar o objeto selecionado sozinho, com as características aplicadas (hoje mostra um pedaço da tela).

## Causas sistêmicas (da phase studio-redesign)
- Restyle incremental preservando DOM/ids → layouts das tavolas nunca reconstruídos.
- D-9 aplicada a elementos puramente visuais (ícones, miniaturas, rótulos, legendas) que não precisam de lógica.
- DoD sem paridade visual; nenhum confronto lado a lado.
- Preview = recorte do frame (decisão do plano), não render isolado.

## Shell (Main)
- Topbar: falta breadcrumb "Temi › {tema}", chip "• Non salvato", versão sob o logo; chip da tela com nome + `480×1920 · COM5` em mono e chevron; botão "In diretta" verde à direita em vez de toggle+Salva laranja.
- Rail: rótulos de grupo "DESIGN"/"DEVICE" em caixa alta mono; item ativo com fundo e ícone em acento.
- Barra flutuante: "Verticale/Orizzontale" + girar + undo/redo + grade; no app há copiar/colar e o girar com borda laranja.
- Canvas: fundo pontilhado (dot grid) em vez de gradiente radial; legenda `480 × 1920 · ruotato 180°` em mono sob o dispositivo; zoom com "Adatta".
- Statusbar: texto "Modifiche non salvate · ultimo salvataggio 4 min fa"; chips com ponto verde (`sensori · 3 ms`, `render 11 ms`, `schermo attivo · 30 fps`).
- Painéis laterais com largura fixa (300/320) — devem ser redimensionáveis (feedback 1).

## Tipografia (feedback 4)
- Mockup: base 13px Plex Sans; títulos de seção 11px caixa alta, letter-spacing .06em, cor muted; muitos valores/rótulos em Plex Mono (X/Y/L/A, min/max, chaves de sensor).
- App: corpo maior, labels "Nome", "X (px)" em Sans comum acima do campo, inputs com fonte maior. Verificar também se o WebView2 carrega de fato os woff2 locais.

## Widget (feedback 2)
- Mockup: título + contagem "13 elementi", busca "Cerca widget", grupos "TESTO E DATI", "INDICATORI", "MEDIA E STRUTTURA" (Gruppo incluso), cards maiores (3 colunas, ícone acima do rótulo), dica tracejada no rodapé ("Trascina… oppure seleziona e premi Invio").
- App: grade única 3×4 sem grupos, sem busca, dica no topo.

## Inspector (geral; Main, Card*, Graph*, Player*)
- Cabeçalho: ícone do tipo + nome em negrito + subtítulo "Anello · livello 3 di 9" / "Card · 3 facce · 9 oggetti"; botões olho e "…". App: título = tipo, campo "Nome" separado, sem subtítulo.
- Abas logo abaixo do cabeçalho (Dati/Aspetto/Movimento; Facce/Movimento/Trigger) — no app as abas ficam abaixo da preview, com 4 abas na card.
- Posição e dimensão: grade 2×2 compacta com prefixo mono dentro do campo (`X 90`, `L 300`) + botões de alinhamento; no app labels acima e campos altos, mais "Bloccato" e ações no fim.
- Sorgente do anel: card com ícone, nome do sensor, chave mono e valor atual + chevron; min/max com prefixo mono. App: dois `select` nativos simples.
- Arco: preview do arco + campos inizio/ampiezza; espessura com valor `24 px` e slider; toggles (Senso orario, Estremi arrotondati) como switches à direita.
- Preview: mockup do anel não tem caixa de preview no topo; feedback 7 pede preview isolada do objeto renderizado sozinho → comando Rust dedicado.

## Card (CardFaces/Motion/Triggers)
- Faces como miniaturas verticais (proporção da tela) com nome mono, chip "Base" tracejado, "+" grande; app usa chips de texto.
- Editor da face em card com nome mono, ‹ › , "Duplica" e lixeira vermelha.
- Seção "OGGETTI IN {FACCIA}" com lista e "Sposta"; dica tracejada no fim.
- Motion: pills de duração, stepper, cards ilustrados de efeito, slider de duração, direção com setas.
- Triggers: regras em frase ("Quando … mostra …") com tokens.

## Livelli
- Mockup: busca "Filtra per nome o sensore", rótulo "IN PRIMO PIANO" + contagem, linhas com nome + meta mono, badges, olho/cadeado; barra inferior de seleção múltipla ("2 selezionati · Raggruppa Ctrl G · Crea card").
- App: nomes truncados de forma ruim ("Backgr…", "CPU An…") — bug de layout; sem busca; sem barra de seleção.

## Connect
- Mockup é tela cheia (hero "PASSO 1 DI 2", título grande 36px, lista de dispositivos, passos, "Temi recenti" à direita). App: cartão modal sobre o canvas, com o inspector do tema visível ao lado.

## Outros painéis
- Comparar Sensors, Media, Themes, Screen, Storage e SensorStatus com `gap/mock/*.png` × `gap/app/panel-*.png` na fase de discuss/plan (mesmos padrões: ícones, rótulos mono, cabeçalhos de seção, contagens).

## Ícone do tray (pedido do usuário)
- Light (`crates/bezel-cli/src/light_tray.rs`) e o tray do Studio usam `src-tauri/icons/tray.png`, já regenerado com a marca Pixel na T-8 — o usuário ainda vê o antigo porque o `bezel.exe` instalado é anterior.
- Problema: `tray.png` é o ícone completo do app (matriz 5×7 com fundo) reduzido a 64px; a 16–20px no tray fica ilegível. Criar um ícone de tray dedicado (célula maior / matriz simplificada, legível em 16/20/24/32px, claro e escuro da barra do Windows) gerado por `scripts/build-icons.mjs`, com teste de dimensões, e verificar com build de release/instalador.
