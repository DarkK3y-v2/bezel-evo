# Un solo runtime in Light — D-2026-10-16-light-owns-screen-31

## Decisione e autorita

Questo design sostituisce B (Studio inviava frame). Light e l'unica autorita per ThemeRuntime, tempo monotono, sensori, storici, transizioni D-18, decoder host, renderer e link fisici. Aprire, nascondere o chiudere Studio non distrugge una scena, non ne cambia l'origine temporale e non forza un invio al dispositivo. Il renderer dei font esistente viene utilizzato senza modificarne text/catalog o il caricamento in bezel-cli/theme.rs.

Il motore condiviso e un adapter indipendente da Tauri: usa ThemeRuntime e le porte del core. Light lo ospita normalmente; Studio costruisce esattamente lo stesso servizio solo nel fallback, sotto il lock legacy e con link diretti. Il vecchio modello Studio resta il contenitore del documento, degli asset, del salvataggio e dei dialoghi: sul percorso nuovo non esegue il loop, il rendering o il campionamento locale. Nessuna seconda implementazione del motore viene mantenuta per il fallback.

## Scene, bozze, salvataggio

Ogni schermo ha una scena stabile, identificata dalla sua chiave canonica, con un solo runtime e un'origine monotona immutabile. Esistono anche scene senza link per documenti non live. Il servizio continua ad aggiornare una scena live senza client collegati.

Studio mantiene documento, Undo/Redo e dialoghi. Invia bozze complete con revisione crescente e asset binari separati dal JSON; dopo la prima sincronizzazione invia solo quando cambiano tema o asset. Una revisione vecchia non puo sovrascriverne una nuova. Un aggiornamento identico e un no-op: non invalida cache, cadenza o baseline. Il tema salvato viene registrato separatamente dalla bozza; il messaggio di commit parte solo dopo il salvataggio riuscito in Studio. All'EOF o alla chiusura Studio Light ripristina il documento salvato sul runtime esistente tramite replace_theme/replace: gli storici delle serie rimaste e gli orologi non vengono ricreati. I decoder del medesimo background e resume_video restano vivi.

## Protocollo e sicurezza

Si mantiene il trasporto locale di B: SID dal token, DACL protetta, PIPE_REJECT_REMOTE_CLIENTS, autenticazione del server, handle non ereditabili, scadenze e cancellazione I/O. La nuova generazione del protocollo distingue richieste al motore dai comandi di controllo/storage. Un client nuovo non torna silenziosamente al vecchio invio di frame.

Operazioni del motore: sincronizza bozza/revisione, registra documento salvato, abilita/disabilita live, richiedi immagine dopo una sequenza, renderElement, measure_element, thumbnail, catalogo/letture dei sensori e opzioni. La richiesta identifica la scena, mai un puntatore o un pacchetto del dispositivo. Le risposte immagine hanno metadati piccoli e pixel binari. Documenti e asset hanno limiti aggregati verificati prima di suddivisione/allocazione; restano anche i limiti del framing di B prima dell'allocazione dei corpi. Dimensioni e numero dei pixel vengono controllati con aritmetica checked.

Studio non invia piu Present. I comandi espliciti di luminosita, storage con progressi/cancel, Return, opzioni persistenti e restart conservano le conferme e passano dal proprietario. Nessun byte nuovo viene introdotto nei driver.

## Canvas, inspector, miniature e backpressure

Il servizio conserva l'ultimo frame autoritativo della scena e una sequenza incrementata soltanto se cambiano i pixel. Il canvas chiede una sola immagine alla volta, con ultima sequenza vista e limite di dimensione derivato dall'area visibile. Se non cambia nulla riceve una risposta senza pixel e riutilizza l'immagine precedente. Se e piccolo riceve una copia ridotta del frame, non un secondo rendering del tema. Il frame live e il canvas derivano dalla stessa immagine. Con video sul dispositivo questa immagine e l'overlay RGBA che Light invia: non si inventa una cattura dei pixel del video interno al firmware.

Inspector e misura usano lo stesso servizio e un contesto isolato del renderer, con le letture del runtime e senza alterare transizioni, clock o immagine live. Le miniature usano scene temporanee del servizio con dati demo espliciti, senza rimpiazzare una scena live. Una thumbnail gia memorizzata puo essere letta localmente senza ridisegnarla.

Il trascinamento mantiene il coalescing dell'editor: una richiesta in volo, poi l'ultima modifica. La bozza viene applicata subito e il motore produce il frame alla prima occasione utile; niente attesa del refresh dei sensori per una modifica geometrica. L'I/O di uno schermo applica backpressure e non accumula frame arretrati. Ogni scena conserva storici e clock propri; la selezione di un altro schermo non sostituisce quella precedente.

## Avvio, crash, fallback e migrazione

Light parte su richiesta anche per un canvas non live. Carica le scene salvate una volta e il worker del motore resta vivo durante le sessioni Studio. EOF ripristina le bozze salvate senza ricaricare il processo o i runtime. Light on close disattivo continua a mantenere Studio nel tray; Return e Quit restano azioni esplicite.

Se il canale non si avvia o muore, Studio acquisisce il lock legacy e avvia lo stesso motore in processo. Il documento e Undo restano disponibili. Il fallback ricostruisce una scena dal documento corrente; non si promette di recuperare da un processo morto la memoria volatile dei grafici. Non si ripetono automaticamente scritture storage dall'esito ambiguo. I lock di B, il fix A nel solo percorso legacy e resume_video restano compatibili.

La migrazione elimina l'invio di frame da Studio e il suo loop live nel percorso autorevole. Il vecchio runtime locale non viene usato come ripiego distinto: il fallback passa dallo stesso servizio del server. L'avvio/chiusura dell'editor non chiama stop/start del worker Light.

## Verifiche e rischi

Regressioni con canale e dispositivo finti: serie dei grafici e origine temporale identiche attraverso attach/detach; nessun nuovo connect o frame intero per un tema invariato; earth.mp4 avviato una volta e mai fermato per l'editor; bozza e annullamento alla chiusura con storici mantenuti; revisioni obsolete rifiutate; immagini senza pixel se invariate e ridotte se richiesto; inspector e miniature senza effetti sul live; due scene indipendenti; crash client e server/fallback; limiti di messaggi, asset e immagini.

Controlli completi: cargo test --workspace, cargo clippy --workspace --all-targets -- -D warnings, cargo fmt --check, cargo llvm-cov >= 80%; npm ci se necessario, npm run test:unit e npm test su tutti i quattro progetti con axe. Nessuna modifica di VERSION o installazione di eseguibili.

Rischi da misurare: latenza del canale sincrono con molti schermi, primo trasferimento di asset grandi, decodifica host e resa durante drag. Verifica manuale finale: Turing 8.8 Rev C COM6, earth.mp4 sul dispositivo e grafici; aprire/chiudere Studio ripetutamente, osservare grafici continui e assenza di ridisegno; ripetere con bozza non salvata, due schermi e crash Light.
