# Light proprietario degli schermi — soluzione B

## Obiettivo e confine

Light conserva ogni connessione fisica durante apertura e chiusura di Studio. Il passaggio dell'editor non chiama connect, release, STOP_VIDEO, STOP_MEDIA o PLAY_VIDEO sul dispositivo. Non si modificano i pacchetti: restano esclusivamente quelli dei driver documentati in docs/reverse-engineering/. Priorità: sicurezza, prestazioni, pratiche di implementazione.

## Rendering e dati

Scelta iniziale: Studio invia frame RGBA già renderizzati e comandi tipizzati attraverso le porte ScreenConnector/ScreenLink/ScreenStorage; Light conserva link, baseline, orientamento e riproduzione effettiva. Il renderer rimane quello condiviso bezel-render, senza un secondo algoritmo di disegno. Il runtime di editing resta in Studio: conserva transizioni D-18, modifiche non salvate, preview e decoder host già esistenti. Il runtime del tema salvato resta in Light e viene sospeso sullo schermo durante la sessione editor. Alla fine riprende il tema salvato, senza chiudere il link.

1920×480×4 = 3.686.400 byte per frame (circa 111 MB/s a 30 Hz). I pixel passano in binario, senza JSON/base64; una richiesta alla volta impone backpressure, senza coda di vecchi frame. Il limite dei pannelli è verificato prima di allocare. Il costo locale è maggiore rispetto all'invio del tema, ma evita una migrazione contemporanea del modello documenti, sensori, decoder e transizioni. Inviare tema/asset e patch sarebbe il passo successivo per ridurre CPU e banda: richiederebbe una sola autorità anche per clock, sensori, asset e animazioni, con versionamento delle revisioni e risposte per la preview. Non viene simulata una continuità dei clock fra due runtime distinti: la continuità garantita qui è del link e del video sul dispositivo.

Ogni schermo ha stato separato e un solo link. La selezione MCU/SoC deve convergere sulla stessa identità fisica. Una richiesta di riprodurre lo stesso video in loop è idempotente mentre quella riproduzione è ancora valida; cambio file, stop esplicito, upload, immagine, spegnimento, riavvio o errore invalidano lo stato. Un cambio tema che cambia video può quindi legittimamente cambiare il contenuto; il solo passaggio editor no.

## Canale e sicurezza

Named pipe Windows locale, nome derivato da installazione e SID dell'utente corrente. DACL protetta con un'unica ACE per quel SID; PIPE_REJECT_REMOTE_CLIENTS; nessun TCP e nessun percorso UNC. Handle non ereditabili e client con livello SecurityIdentification per impedire impersonazione privilegiata. Creazione first-instance contro sostituzione del server. SID ottenuto dal token del processo, non da variabili d'ambiente.

Protocollo BZLO versione 1: intestazione fissa con lunghezze controllate, metadati JSON limitati a 64 KiB e payload binario limitato; versione e dimensioni si verificano prima di allocare. Niente deserializzazione di oggetti arbitrari o byte di protocollo del dispositivo. Le operazioni persistenti mantengono la conferma richiesta dai casi d'uso: il client trasporta l'autorizzazione, il server la verifica e ricostruisce la prova del core solo per quella richiesta. Nessuna cancellazione implicita di file.

Una connessione editor persistente serializza le richieste e impone backpressure. La sessione dura quanto il canale: EOF o processo terminato la rilasciano, senza heartbeat o file di presenza. Ogni I/O bloccante ha una scadenza di 15 s e viene cancellato con CancelSynchronousIo. Un client morto o un messaggio malformato non termina Light e non chiude le porte. Upload limitato al profilo del dispositivo, progressi inoltrati e cancellazione cooperativa; nessuna coda illimitata di upload. Un client bloccato non può tenere il server occupato senza limite.

Riferimenti di sicurezza: https://learn.microsoft.com/en-us/windows/win32/ipc/named-pipe-security-and-access-rights e https://learn.microsoft.com/en-us/windows/win32/api/namedpipeapi/nf-namedpipeapi-createnamedpipew.

## Comandi

Attraversano Light: identificazione tramite handshake, live/present, luminosità, orientamento, release esplicito (pulsante Return), standby/opzioni e shutdown, riavvio schermo, storage info/list/size/upload/delete/play-image/play-video/stop. Progressi e cancellazione degli upload conservano Job e CancelToken. Discovery USB di sola lettura può restare nel client: non apre la seriale. Le conferme UI esistenti rimangono a monte dei comandi distruttivi.

## Avvio, uscita e recupero

Studio cerca il server prima di qualsiasi connect. Se manca avvia il bezel.exe accanto all'eseguibile, senza finestra, e attende un handshake compatibile. Se Light non parte o muore, Studio acquisisce il lock legacy prima di consentire il collegamento diretto. Nessun fallback su una semplice risposta di errore del dispositivo o su un comando già eseguito: non si ripetono scritture ambigue. Il fallback può comportare il vecchio riavvio del video, dichiaratamente degradato; non impedisce di salvare o continuare il lavoro.

Chiudendo Studio con Light on close attivo termina la lease editor e Light continua il tema salvato. Le modifiche non salvate restano soggette ai dialoghi esistenti. Con la preferenza disattivata Studio può restare nel tray come oggi. Return resta una richiesta esplicita di modalità autonoma e non viene confuso con il drop di un proxy. Quit esplicito termina entrambi i runtime secondo il comportamento esistente.

## Migrazione

Il lock di istanza Light e quello fisico screen-control restano l'autorità contro accessi concorrenti. Il lock studio-session identifica solo il percorso legacy: il normale client pipe non lo prende. Un Light precedente che non espone la versione 1 usa il takeover legacy. Il fix A e FileHandoffStore rimangono per fallback e vecchi processi; sul percorso B la baseline vive nel link originale e non viene letta né riseminata da un file.

## Passi e verifiche

1. Porta del canale nel core, gestione proprietario e test con finti link/canale.
2. Adapter pipe con ACL/SID, framing limitato e test Windows reali della pipe (senza hardware).
3. Collegamento Light/Studio, avvio on demand e fallback protetto dai lock.
4. Regressioni native, controlli completi Rust e quattro progetti Playwright con axe.

Test richiesti: un solo connect durante Studio→Light→Studio; nessuno stop/replay dello stesso video; errore del dispositivo e crash server/client; rifiuto SID estraneo e connessione remota; rifiuto header/versione/lunghezze e frame non congruenti; storage con progressi e cancel; indipendenza di due schermi; compatibilità dei lock e del fix A. Verificare cargo test --workspace, clippy --workspace --all-targets -D warnings, fmt --check, llvm-cov almeno 80%, npm run test:unit e npm test.

Hardware da verificare separatamente: Turing 8.8 Rev C COM6, internal/video/earth.mp4, transizioni ripetute in entrambi i versi, editing e salvataggio durante playback, due schermi, Return, shutdown, crash Light e ripartenza. Nessuna build viene installata e VERSION resta invariato per questa attività.

## Dettagli dell'implementazione

- Porte aggiunte nel core: ScreenChannel, resume_video e delega dello shutdown. Nessun tipo Win32 o formato IPC nel dominio.
- Adapter in bezel-power: owner (link persistenti), owner_protocol (messaggi e proxy), owner_pipe (SID, ACL, pipe e scadenze), owner_client (avvio e fallback). I driver fisici e i loro pacchetti non sono cambiati.
- L'editor prende controllo solo degli schermi che usa: gli altri runtime salvati continuano. Alla disconnessione il vecchio worker viene fermato prima di ricaricare impostazioni e temi salvati; la connessione fisica resta nella cache dell'owner.
- L'invocazione interna bezel.exe --light-owner avvia il tray anche senza un primo tema salvato. La modalit? --fake usa adapter finti anche nel server; non espone il connettore fisico.
- La connessione normale non prende studio-session. Nel fallback il lock legacy rimane vivo fino all'ultimo link prestato, anche se lo stato Tauri viene distrutto prima di un job. Una scrittura fallita non viene ripetuta automaticamente sul percorso diretto.
- Luminosit?, orientamento, storage e metriche dei trasferimenti passano attraverso il proxy. Upload binario unico limitato a 120.000.000 byte e ulteriormente al profilo del modello prima di scrivere; progressi e cancel si riferiscono all'invio al dispositivo. I metadati sono limitati a 65.536 byte prima dell'allocazione.
- Lo shutdown automatico viene delegato all'owner; Light applica le scelte del catalogo sui link gi? aperti. Quit esplicito esegue release; chiusura dell'editor e ricaricamento del tema non lo eseguono. Lo spegnimento Windows e il recupero dopo sospensione possono legittimamente chiudere o ricreare un link.

### Limiti da misurare

La prima versione usa un solo canale sincrono: uno schermo lento pu? ritardare gli altri. Non sono stati misurati throughput e latenza su pi? pannelli fisici. Il trasferimento di tema/patch con rendering interamente in Light rimane una possibile evoluzione, non una seconda implementazione parziale del renderer.

La continuit? del video **sul dispositivo** deriva dal link persistente e da resume_video. I clock dei decoder host, delle animazioni e delle transizioni appartengono ai due runtime e non vengono trasferiti fra processi. La ripresa del tema salvato pu? quindi cambiare lo stato temporale di questi contenuti. Anche un cambio effettivo del background, Return, Play esplicito, errore di trasporto o sospensione pu? cambiare legittimamente ci? che il pannello mostra.

Il test ACL esegue il controllo Windows con un token ristretto che richiede un SID estraneo: non usa credenziali di un secondo account. Una prova con due account Windows reali resta una verifica manuale aggiuntiva.
