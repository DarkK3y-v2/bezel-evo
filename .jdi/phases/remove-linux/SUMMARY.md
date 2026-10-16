# Rimozione del supporto Linux

## Ambito e risultato

Worktree `F:\dev\bezel-nolinux`, branch `fid/remove-linux`, base `ad520868e79c83fbe5f99839be816035241d3efa`. Applicata D-2026-10-16-studio-redesign-fidelity-27. Nessuna modifica a VERSION, nessuna installazione o sostituzione di eseguibili in dist.

Rimossi sensori sysfs/procfs/hwmon/RAPL e AMDGPU Linux, MangoHud e fixture, logind/D-Bus con fake di test, regole/CLI/dialogo udev, scansione dei proprietari in /proc, rami Unix dei processi e dei test, workaround DMA-BUF, configurazione Tauri Linux, packaging deb/rpm/AppImage e script esclusivi Linux. Rimosse le relative stringhe in en/pt-BR/it e aggiornati i test Connect, Screen e Preferences. Conservati i messaggi Windows di accesso negato.

Dipendenze dirette eliminate: dbus da bezel-power, rustix dai sensori; feature hidapi linux-native-basic-udev e serialport libudev disattivate, feature Windows mantenute. Dal lock spariscono basic-udev 0.1.2, libudev 0.3.0, libudev-sys 0.1.4 e nix 0.30.1. dbus/libdbus-sys e rustix possono ancora comparire come dipendenze transitive upstream: per esempio dbus arriva da tao/Tauri per altri target e non compare nell'albero Windows. Non alterato il codice delle dipendenze.

## Separazioni autorizzate e regressioni Windows

| Chiamata precedente su Windows | Effetto precedente | Rimozione e parti conservate | Verifica |
|---|---|---|---|
| Setup Studio ? power::watch_shutdowns ? Logind::connect | Thread che terminava su Unsupported, senza azioni sugli schermi | Eliminati watcher, BusAddress, tipi/errori esclusivi logind, stub e fake. Conservati session_ending, at_exit, shut_down e limite di quattro secondi | power::tests::a_session_end_applies_the_choice_and_a_quit_does_not; a_session_end_waits_four_seconds_at_most; the_final_state_lets_nothing_reach_a_screen; test bezel-power |
| blocking ? Backend::explain per gli errori | Lo stub udev non produceva istruzioni; UiError restituito identico | Eliminati wrapper identita e campo opzionale udevCommand; conservati code/args/message, notifiche e stato accessDenied | messages::tests::errors_carry_code_arguments_and_english verifica esattamente i tre campi; test JS storage/access denied e scenari Screen |
| SystemPorts::holders ? scanner /proc | Su Windows senza procfs restituiva nessun proprietario; apertura COM esclusiva affidata al sistema | Eliminato scanner Linux; conservati Holders e gestione errori/apertura COM; risposta vuota esplicita | Nuovo connector::tests::windows_holder_probe_keeps_ownership_with_the_os; a_new_windows_com_port_retries_access_denied_before_hello; a_windows_com_port_that_stays_denied_fails_without_a_restart |
| SensorOptions.mangohud_dir, impostazione e inoltro del launcher Light | Valore ignorato dal provider Windows; controllo UI nascosto | Eliminata opzione ignorata dalla catena CLI/runtime/Studio e dal launcher; conservati ping, RTSS, LibreHardwareMonitor e sensori Windows | Test sensori/CLI/runtime/Studio; Preferences e bridge; parsing AST del launcher e verifica degli argomenti FFmpeg/ping conservati (le vecchie impostazioni mangohudDir non producono piu un argomento CLI inutile) |

I rami reali Windows per sessione, RTSS, memoria, LibreHardwareMonitor, creazione processi senza finestra, timeout e chunk seriali sono stati mantenuti; sono stati tolti solo i rami alternativi e i relativi cfg. Il builder exclusively resta l'identita gia usata da Windows: l'esclusivita COM resta quella di CreateFile. Nei test dei permessi restano il comportamento Windows e il file tenuto aperto, eliminati chmod e shell Unix. Coperti dai test bezel-devices, bezel-media e Studio (cache GIF).

## Riduzione

Diff rispetto alla base, esclusi i nuovi report di fase: 115 file modificati, 32 file eliminati, 215 righe aggiunte e 11753 rimosse: saldo -11538 righe. Nei file Rust/JS/MJS/C (codice e test): 138 aggiunte, 10220 rimosse, saldo -10082 righe.

## Parti conservate

Core, renderer e adattatore KLIPY non modificati. Conservati i moduli portabili senza cfg, inclusi il risolutore di percorsi con Platform::Unix e HostSystem per i suggerimenti FFmpeg: non introducono API o processi Linux nel runtime Windows. Restano input sintetici Unix/Linux nelle verifiche di sicurezza del sorgente e indirizzi fittizi dei protocolli. Conservate le informazioni di protocollo indipendenti dall'host e i riferimenti al firmware Linux interno degli schermi, che non rappresentano supporto Linux dell'app.

Conservato check-docs.sh, controllo portabile Bash/Python; tolti i requisiti che avrebbero imposto di documentare comandi e pacchetti Linux rimossi. Non modificati i documenti riservati ne la storia .jdi precedente. L'inventario completo e in [DOCUMENTI-RISERVATI.md](DOCUMENTI-RISERVATI.md).

## Validazione

- Build Windows --locked dei pacchetti modificati: bezel-sensors, bezel-devices, bezel-power, bezel-media, bezel-runtime, bezel-themes, bezel (CLI), bezel-studio: passata.
- Test e Clippy mirati --all-targets -D warnings degli stessi pacchetti: passati. Una prima esecuzione del test temporizzato GIF era instabile; rieseguito da solo, passato. Il test del guardiano dei logger e stato adeguato alla rimozione della dev-dependency Tauri non-Windows usando un manifest sintetico.
- Test JS mirati bridge/storage/i18n/demo-backend: 122 passati.
- E2E mirati tramite e2e-slot: le aree Screen, Preferences e fidelity sono passate; Connect aggiornato da tre a due passi e rieseguito, 8 passati.
- Suite completa Rust, una sola volta: cargo test --workspace --locked, 1196 passati, 15 ignorati, zero fallimenti.
- Clippy completo, una sola volta: cargo clippy --workspace --all-targets --locked -- -D warnings, passato.
- Suite npm completa, una sola volta, tramite node scripts/e2e-slot.mjs --full: 535 test unitari passati; e2e 699 passati e un timeout nel caso Card light-pt (il selettore schermo intercettava il clic su Widgets). Il solo caso fallito, card-animation.spec.mjs / card built in the editor, rieseguito tramite slot con --project=light-pt: passato. Nessuna modifica al test o al componente Card; nessuna seconda esecuzione della suite completa. Copertura JS: righe 99,45%, rami 96,40%, funzioni 96,47%.
- cargo fmt --check e git diff --check: passati.
- Launcher PowerShell: parsing AST senza errori e verifica dei due argomenti FFmpeg/ping, passati; nessuna esecuzione del launcher o accesso ai dispositivi.

I test hardware ignorati non sostituiscono una verifica manuale su COM6/COM3. Da controllare: avvio Light dalle impostazioni esistenti, collegamento esclusivo/porta occupata, standby e fine sessione Windows, ping e RTSS, Connect a due passi e Preferences senza MangoHud.

## Note operative

Durante la suite npm una redirezione relativa errata ha creato il solo log temporaneo F:\dev\.task-full-npm.log. Nessun sorgente esterno e stato modificato; il log e stato spostato nel worktree al termine e poi eliminato. La suite completa non viene rilanciata.
