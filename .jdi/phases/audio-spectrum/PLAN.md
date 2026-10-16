# Piano audio-spectrum

Decisioni vincolanti: D-AS-1..9 in CONTEXT.md; Light unico runtime (D-31). Nessuna modifica a VERSION, CHANGELOG.md, scripts/windows/ o packaging/. Nessuna scrittura diretta ai dispositivi introdotta dal widget.

## 1. Contratti, modello e formato compatibile
File: crates/bezel-core/src/domain/{mod,spectrum,theme,sensor}.rs, ports/mod.rs, app/runtime.rs; crates/bezel-themes/src/dto.rs e test nativi.
Definire widget autonomo, riferimento al Player tramite ElementId opzionale (automatico solo con un Player), parametri limitati, preset, stato e snapshot di bande. Porta di cattura indipendente da Windows. Risolvere la sessione con playback::session, la stessa funzione del Player, senza selezione parallela. JSON opzionale con default, vecchi temi invariati.
Accettazione: round trip JSON; rifiuto valori non finiti/fuori limite; riferimenti mancanti espliciti; test della risoluzione condivisa e degli stati.

## 2. Analisi deterministica e servizio Light
File: crates/bezel-runtime/src/{spectrum,lib,tests}.rs; eventuale modulo analisi separato e Cargo.toml.
FFT 4096 Hann, energie dei canali combinate, bande logaritmiche (default 32, 60 Hz?16 kHz), normalizzazione dB, preset Morbido/Bilanciato/Scattante e picchi con decadimento. Thread dedicato con ultimo snapshot, buffer limitati e nessuna coda; una cattura per sorgente condivisa fra scene/widget. Fermare risorse senza consumatori, in sospensione e quando gli schermi sono disattivi; riaprire dopo errori/cambio sorgente/risveglio.
Accettazione: sinusoidi nelle bande previste, livelli finiti, decadimento fino a zero esatto e nessun aggiornamento successivo; catture condivise e rilasciate; sensori e presentazione non bloccati.

## 3. Adattatore Windows e consenso locale
File: crates/bezel-sensors/src/{lib,audio}.rs, windows/activity.rs, Cargo.toml; composizione Light in crates/bezel-cli/src e recupero runtime Studio in apps/bezel-studio/src-tauri/src; opzioni runtime e impostazioni Studio.
Controllo build reale >=20348. Attivazione AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK per processo e figli, formato PCM limitato, nessun microfono o ripiego globale. Associazione GSMTC AUMID a processi classici, pacchetto Store e browser tramite enumeratore verificabile; ambiguita e errori diventano sorgente non disponibile. Consenso locale disattivato per default, mai abilitato importando un tema. Browser: avviso sulle altre schede.
Accettazione: enumeratore finto (classico/Store/browser/ambiguo/riavvio); stato unsupported sui sistemi precedenti; nessun campione, titolo o identificativo audio nei log/file; rilascio COM e buffer anche sugli errori.

## 4. Rendering e scheduling
File: crates/bezel-render/src/{lib,renderer,spectrum}.rs; integrazione snapshot e pianificazione core/runtime, demo sensori.
Barre specchiate, linea centrale e picchi, colori/gradienti e soglie per banda riusando Paint/thresholds, angoli condivisi. Stati distinti: silenzio, cattura disabilitata, Player mancante, sorgente non disponibile, sistema non supportato; demo esplicita. Stato audio separato dal polling dei sensori.
Accettazione: test pixel/geometria/soglie; massimo 20 fps; presentazione esistente con ultimo frame e degrado automatico, nessun nuovo percorso di scrittura seriale. A decadimento terminato nessun nuovo frame audio; modifiche pixel confinate al widget salvo altri elementi animati.

## 5. Studio: widget, inspector e anteprima
File: apps/bezel-studio/src/editor/widgets.js, ui/inspector.js (eventuale modulo spectrum), ui/fields.js solo se necessario, inspector-tabs.js, moduli modello/validazione/anteprima, bridge/demo-backend, i18n en/pt-BR/it e relative aree; impostazioni/consenso.
Dati: Segui il Player, numero di barre e gamma. Aspetto: colore/gradiente/soglie, spessore, spazio, cornerRadii, linea centrale, picchi, preset. Dal vivo / Demo riconoscibile; controlli nativi, token e tastiera, un solo insieme di primitive.
Accettazione: default Bilanciato e picchi attivi, collegamento automatico con un Player e scelta esplicita fra piu Player; Undo/Redo, salvataggio/riapertura e stati localizzati; consenso locale chiaro con nessun salvataggio audio.

## 6. Verifica e consegna
Test mirati: cargo test -p e clippy --all-targets -- -D warnings dei crate modificati; unit JS dei moduli toccati; e2e inspector/demo/consenso con node scripts/e2e-slot.mjs (chiaro/scuro, axe). Eseguire una sola volta alla fine cargo test --workspace, clippy --workspace e npm test tramite slot; eventuali casi instabili solo isolati. Non installare eseguibili e non avviare scritture hardware durante i test.
Commit piccoli Conventional Commits con scope audio-spectrum, messaggi inglesi e Co-Authored-By: ChatGPT <noreply@openai.com>. Report italiano con esiti reali e limiti, mappa delle decisioni e prove manuali: Spotify su COM6/COM3, isolamento da altre app, pausa fino a zero e nessun frame audio successivo con BEZEL_PERF_LOG=1/light.log, CPU, sorgenti mancanti e sospensione/risveglio.
