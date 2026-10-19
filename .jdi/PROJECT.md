# Bezel

## Contesto di ripresa — 2026-10-19

- Build di sviluppo corrente **0.1.48**, compilata e avviata direttamente dopo
  conferma utente di salvataggio e chiusura: alias GPU raggruppati per lettore
  e riavvio locale alla sonda supportata; 70 unitari UI e 28 e2e verdi.
  Vedi [sonde GPU e riavvio](todos/2026-10-19-sonde-gpu-riavvio.md).
- Dalla **0.1.46** sono presenti lente, campione e HEX durante il prelievo del colore.
  Superficie congelata temporaneamente per una selezione esatta; nessun setup
  .46 richiesto. Vedi [anteprima e test H264](todos/2026-10-19-contagocce-anteprima-h264.md).
- Versione installata: **0.1.45**, setup locale creato, avviato su richiesta e
  installazione verificata in `%LOCALAPPDATA%/Bezel Evo`. Versione nel registro
  Windows e hash di CLI/Studio installati corrispondono alla build del pacchetto.
  Nessun push, tag o rilascio GitHub eseguito per questi aggiornamenti.
- Grafici nativi fluidi integrati dalla .44: scorrimento di linea, area e barre,
  massimo richiesto 50 fps, cadenza indipendente per display e campionamento
  invariato. Ritardo visivo fino a un intervallo di campionamento. Sul tema reale
  Midnight dell'8.8 misurati 32,96 invii/s: non è una misura ottica del refresh.
- H264 è un esperimento separato, non attivato nel prodotto. Il CT88 Rev C
  collegato usa la seriale; la prova H264 richiede hardware USB 1CBE compatibile.
- Preferenze operative: per le iterazioni avviare direttamente l'eseguibile;
  produrre setup quando richiesto. Preservare i documenti aperti, senza chiudere
  Studio al posto dell'utente. Sessione osservata dopo l'installazione ancora da
  `target/release`: non confonderla con la copia installata; non sostituirla
  automaticamente durante una semplice ripresa del lavoro.
- Stato e lavoro aperto: [STATE.md](STATE.md). Dettagli e verifiche:
  [grafici fluidi](todos/2026-10-19-grafici-fluidi.md),
  [setup .45](todos/2026-10-19-setup-0.1.45.md),
  [prototipo H264 e prove fisiche](todos/2026-10-18-prototipo-streaming-scene.md).
- Restano la valutazione visiva dell'utente sui due display, la verifica manuale
  della fase rotazione e gli eventuali miglioramenti dei temi più pesanti.
  Non segnare la fase verificata o pubblicare senza le relative richieste.

## Vision
Controlar pelo software **tudo** que as telas USB "smart screen" (Turing/TURZX e clones: XuanFang, Kipye, WeAct, UsbMonitor, 0x43A8/0x1CBE) oferecem — imagem, vídeo, cartão SD, brilho, rotação, sensores do PC — no Windows, com um editor de temas drag-and-drop numa janela única e medições corretas.

> Piattaforma: dal 2026-10-16 è supportato solo Windows (D-2026-10-16-studio-redesign-fidelity-27). Il codice Linux ereditato non si compila, non si testa né si mantiene e può essere tolto se intralcia; le note su Linux qui sotto sono storiche.

## Type
desktop app (Tauri, janela única + bandeja) + CLI + runtime headless (serviço). Sem backend, sem nuvem.

## Stack
- Language: Rust stable 1.98 (edition 2024), cargo workspace, `Cargo.lock` versionado
- Framework: Tauri 2.12 (studio), clap 4.6 (CLI); UI em HTML/CSS/JS ES modules sem bundler (padrão `ddc-tray`)
- Devices: serialport 4.10 (CDC-ACM), nusb 0.2 (USB bulk, Rust puro), hidapi 2.6 (HID), des/cbc (cripto dos protocolos)
- Render: tiny-skia 0.12 + cosmic-text 0.19 (shaping + fontes do sistema) + image 0.25 (PNG/JPEG/GIF)
- Sensors: sysinfo 0.39 + hwmon/sysfs direto (Linux) + nvml-wrapper 0.13 (NVIDIA) + wmi 0.18 (LibreHardwareMonitor no Windows)
- Vídeo: ffmpeg externo (subprocesso) para transcodificar; nada de libav linkado
- Testes: `cargo test`, `cargo llvm-cov`; UI: `node --test` + Playwright (modo demo no navegador)
- Layout: `crates/bezel-core` (hexágono), `crates/bezel-devices`, `crates/bezel-render`, `crates/bezel-sensors`, `crates/bezel-themes` (driven), `crates/bezel-cli` (driving), `apps/bezel-studio` (driving, Tauri)

## Code Design
**LOCKED:** Hexagonal (Ports & Adapters)

Decided in /jdi-new. Do not change. Ports no core (`DeviceBus`, `ScreenLink`, `SensorSource`, `FrameRenderer`, `ThemeStore`); protocolos/transportes, renderer, sensores e formatos de tema são adapters; CLI e comandos Tauri são adapters de entrada.

## Slug
bezel

## Research notes
- Engenharia reversa completa em `docs/reverse-engineering/` (protocolos A/B/C/D/WeAct/TUR_USB/WCH/HID, `.turtheme` NRBF, sensores, UI TURZX, logs). Fonte: `turing-smart-screen-python` (GPL-3) e TURZX V3.07 (descompilado, strings Dotfuscator decodificadas).
- Tela do dev: Turing 8.8" 480x1920 = hub interno com MCU `1a86:ca88` (serial `CT88INCH`) + SoC Allwinner Linux `0525:a4a7`; su Windows lo schermo è su COM6 (storico Linux: /dev/ttyACM0 e /dev/ttyACM1). Protocolo rev C: blocos de 250 B `xx ef 69 ...`, HELLO → `chs_88inch.dev1_romX.YY`.
- TURZX faz diff de frame com run-list (`idx24|0x80`, BGRA ou BGRA comprimido 3 B) e máscara POSLEN (0xD0) para sobrepor tema a vídeo tocado na própria tela (MP4 H.264 em `/mnt/SDCARD/video` ou `/mnt/UDISK/video`).
- Linux: permissão via regra udev `uaccess` para os VID:PID; Windows: usbser (CDC) e WinUSB para 0x1CBE/0x43A8.
- CPU temp no Windows exige driver de kernel: via LibreHardwareMonitor (WMI) quando presente; nunca inventar valor — mostrar "indisponível".

## Frontend
- has_frontend: true (D-2026-09-30-studio-app-6)
- App: `apps/bezel-studio/src` — HTML/CSS/JS ES modules sem bundler, embutidos pelo Tauri; ponte `bridge.js` (Tauri ou modo demo)
- Testes: `cd apps/bezel-studio && npm test` (node --test com piso de 80% de linhas nos módulos de lógica; Playwright + axe em claro e escuro sobre o modo demo)
- Regras: i18n en/pt-BR/it com paridade de chaves e nenhuma string fixa no JS; tokens de cor com claro/escuro; operável por teclado; `prefers-reduced-motion`; diálogos in-app (nunca `window.confirm`); CSP estrita

## Global constraints
- Cobertura mínima 80% (linhas) em `crates/` e `apps/`
- Conventional Commits, commits atômicos por task
- Lingua: codice, commit e PR in inglese; discussione con l'utente e documenti in `.jdi/` in italiano (dal 2026-10-16; i documenti precedenti restano in portoghese); UI con i18n (en + pt-BR + it), mai stringhe fisse nel JS
- `cargo fmt --check` e `cargo clippy -- -D warnings` limpos; nenhum comando destrutivo (formatar SD, firmware, apagar arquivo) sem confirmação explícita
- Build e installazione locale per la prova sull'hardware reale: `scripts/windows/build-evo.ps1` (nuova versione da `VERSION`), aggiornando sul posto `dist/bezel` (vedi `AGENTS.md`); `scripts/install-local.sh` è storico (Linux)
- Test: si testa solo ciò che si tocca durante il lavoro; suite completa e copertura una volta prima di pubblicare (push) o alla verifica della phase
- Commit: trailer `Co-Authored-By` dell'agente che ha scritto il lavoro (ChatGPT o Claude)

## Definition of Done

**LOCKED — project-wide baseline.** Inherited by every phase's reviewer (Gate 8). Change requires a new D-XX in DECISIONS.md plus manual edit here.

### Auto-verifiable
- [ ] `cargo test --workspace` exits 0
      **Verify:** `cargo test --workspace --locked && echo OK`
      **Source:** PROJECT
- [ ] Coverage >= 80% of lines
      **Verify:** `cargo llvm-cov --workspace --locked --fail-under-lines 80 --summary-only && echo OK`
      **Source:** PROJECT
- [ ] No `TODO`/`FIXME` without linked issue reference
      **Verify:** `export LC_ALL=C.UTF-8; ! git grep -nIiE '\b(todo|fixme)' -- . ':!*.md' ':!*.json' ':!*.lock' ':!.jdi' ':!docs' ':!.githooks' ':!apps/bezel-studio/scripts/e2e-passed.mjs' ':!apps/bezel-studio/tests/ui/e2e-passed.test.mjs' | sed -E "s/(todo|fixme)s?\(#[0-9]+\)//Ig" | grep -qE 'TODO|FIXME|[Ff][Ii][Xx][Mm][Ee]|\b[Tt][Oo][Dd][Oo]\b|\bT[Oo]D[Oo][Ss]?\b' && echo OK`
      **Source:** PROJECT

### Manual
- [ ] CHANGELOG.md updated with entry per release
      **Verify:** human confirmation required
      **Evidence:** new `## [version]` heading in CHANGELOG.md for current release
      **Source:** PROJECT
- [ ] README accurately describes current behavior
      **Verify:** human confirmation required
      **Evidence:** README diff reviewed in PR
      **Source:** PROJECT

## LLM config

```yaml
llm_config:
  default_model_opencode: anthropic   # (a) Anthropic Claude — default do JDI (auto-locked)
```

Applied by `/jdi-bootstrap` to `.opencode/opencode.jsonc`. Other runtimes ignore.
