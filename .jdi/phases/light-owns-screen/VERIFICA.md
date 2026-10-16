# Verifica della soluzione B — Light proprietario

## Decisioni consegnate

Light conserva i link fisici; Studio usa un proxy delle porte del core tramite una named pipe locale con SID/DACL espliciti e rifiuto dei client remoti. L'avvio è su richiesta, anche senza un tema salvato. In caso di indisponibilità di Light il fallback diretto prende prima i lock legacy, che restano vivi fino all'ultimo link prestato.

Studio alimenta Light con frame RGBA binari e comandi. Il codice di rendering resta bezel-render; il runtime salvato viene sospeso soltanto sugli schermi effettivamente controllati dall'editor. Identificazione, luminosità e query storage da sole non sospendono il tema salvato. I link restano aperti anche quando il worker viene ricaricato dopo la chiusura dell'editor.

resume_video distingue la ripresa di un background dal Play esplicito: un video già selezionato non riparte durante l'handoff, mentre Play continua a riavviarlo su richiesta. Return e Quit esplicito conservano release; lo shutdown automatico è applicato da Light ai link già aperti. Il fallback mantiene il fix A; una baseline legacy non può riseminare un link già utilizzato.

## Commit

- c8399d9 — design italiano prima del codice.
- d294ed2 — porte e proprietà persistente dei link.
- acc8ce3 — protocollo limitato, proxy e pipe autenticata.
- 9e3278c — integrazione Studio/Light, avvio e fallback, shutdown e README.
- f732e69 — query senza sospendere il tema salvato; esclusione delle aperture durante il restart.
- 3210eda — protezione delle baseline persistenti dal vecchio handoff.

Tutti usano Conventional Commits con scope light-owns-screen. VERSION, dist e i documenti delle altre fasi non sono stati modificati. Non sono stati sostituiti eseguibili e non sono stati chiusi processi Studio esistenti.

## Test automatici

| Controllo | Risultato |
| --- | --- |
| cargo test --workspace --locked -- --test-threads=2 | 1.170 superati, 15 ignorati (hardware) |
| cargo clippy --workspace --all-targets --locked -- -D warnings | Superato |
| cargo fmt --all --check | Superato |
| cargo llvm-cov --workspace --locked --fail-under-lines 80 --summary-only -- --test-threads=2 | Superato: 91,38% linee |
| npm ci | Superato |
| npm run test:unit | 505 superati; 99,42% linee |
| npm test -- --workers=4, BEZEL_E2E_PORT=19438 | 668 superati, quattro progetti, axe incluso |

Le regressioni nuove usano canale e dispositivi finti, oltre alla pipe Windows reale: handoff ripetuto con un solo connect e un solo avvio del video, nessuno stop/release implicito; frame RGBA 1920×480 sul canale reale; indipendenza di due schermi; progressi/cancel storage; conferme e frame non validi; messaggi e versioni rifiutati prima dell'allocazione; crash server/client; cancellazione di I/O bloccato; fallback diretto e durata dei lock; shutdown senza connessione aggiuntiva; protezione della baseline A.

La prova ACL usa il controllo d'accesso reale di Windows con un token ristretto a un SID estraneo. Non equivale a una prova interattiva con credenziali di un secondo account Windows, che resta aggiuntiva.

Una prima esecuzione UI con parallelismo predefinito ha riportato tre fallimenti su zoom/drag: 665 superati, tre falliti. I 13 test dei due file coinvolti sono passati su una porta dedicata; la successiva suite completa con quattro worker è interamente verde. Un tentativo di riesecuzione ha trovato la porta 1430 occupata: non è stato terminato il processo che la usava. Anche un'esecuzione Rust parallela ai browser ha fatto fallire il test temporale della preview GIF con 0 ms; la verifica completa usa due thread di test. Non sono stati modificati frontend o asserzioni per nascondere questi fallimenti.

## Verifica hardware ancora necessaria

Nessuna porta fisica è stata aperta per questa attività. Usare una coppia CLI/Studio compilata dalla stessa worktree; prima di una futura sostituzione dell'installazione salvare e chiudere eventuali documenti Studio aperti. Questa attività non distribuisce un eseguibile sotto VERSION invariato.

Sul Turing 8.8 Rev C, COM6, con internal/video/earth.mp4:

1. Avviare Light con il tema salvato e lo stderr/tracing visibile. Registrare l'iniziale HELLO, STOP_VIDEO/STOP_MEDIA e PLAY_VIDEO, che sono normali all'apertura iniziale.
2. Aprire Studio dal tray, lasciare il tema invariato e chiuderlo verso Light almeno dieci volte. Verificare continuità del punto del video e dell'overlay: nessuna nuova apertura/handshake e nessun nuovo STOP/PLAY dovuti al solo passaggio.
3. Controllare le metriche dei frame dopo ogni passaggio: baseline mantenuta e trasferimenti differenziali quando il contenuto lo consente. Un cambio effettivo di tema/orientamento/contenuto può richiedere un frame intero.
4. Modificare e salvare il tema durante il live. Alla chiusura Light deve caricare il tema salvato mantenendo lo stesso video, senza riprodurre per un istante il vecchio tema.
5. Provare due schermi: editing su uno, query/luminosità sull'altro, storage con progressi/cancel, poi Return su un solo schermo. Il secondo deve continuare.
6. Provare Light on close attivo/disattivo, Quit esplicito, standby/shutdown e sospensione/ripresa. Lo shutdown non deve essere annullato da release o da un frame tardivo.
7. Con modifiche non salvate in Studio, terminare soltanto Light. Verificare che l'editor resti utilizzabile e che il live recuperi tramite un nuovo owner o il fallback protetto; in questo recupero il video può legittimamente ripartire.
8. Verificare con un secondo account Windows che la pipe del primo utente non sia accessibile.

## Limiti espliciti

La continuità verificata automaticamente è quella di connessione e video sul dispositivo. I due runtime non trasferiscono clock dei video decodificati sull'host, cronologia dei grafici o transizioni. La prima versione serializza le richieste sul canale; latenza e throughput con più schermi fisici vanno misurati. Il design descrive il compromesso rispetto all'invio di temi/patch e al rendering interamente in Light.
