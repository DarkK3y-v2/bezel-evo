# Diagnosi fallback iniziale e frame del Turing 3.5

## Evidenze

Il log hardware mostra SessionOpened alle 11:03:47.752 UTC, poi fallback diretto. L'handshake ha dunque completato autenticazione e apertura della sessione: il guasto avviene dopo. Il vecchio logger non conservava la richiesta n? il suo errore.

Una lettura locale del catalogo SystemSensors sulla stessa macchina restituisce 588 sensori e 106.764 byte di JSON per il solo catalogo, senza registrare etichette o valori. Il vecchio RuntimeOp::Sensors inseriva tutto nei metadati, limitati a 65.536 byte: wire::dispatch restituiva runtime reply too large; il punto interrogativo in serve_runtime terminava il server; Studio interpretava l'errore come indisponibilit? di Light e prendeva il collegamento diretto. Il problema ? riprodotto con catalogo finto grande e pipe Windows reale. Il vecchio log da solo non identifica il nome dell'ultima richiesta; il percorso causale ? verificato nel codice e nel test.

Il Rev A usava gi? dirty_rects e conservava last nel driver. Non implementava last_transfer: il worker registrava full come valore sostitutivo per qualsiasi frame, inclusi quelli immutati. Il conteggio 56/56 non dimostra quindi altrettanti trasferimenti integrali. Non sono stati cambiati i pacchetti seriali n? l'algoritmo dei rettangoli.

## Correzioni

- Risposte JSON grandi nel payload binario, massimo 4 MiB; envelope entro 64 KiB. Il limite viene verificato prima del parsing nel client.
- Errori applicativi e risposte eccessive non terminano la pipe. Le richieste troppo grandi rifiutate localmente non guastano la sessione.
- Un errore I/O rilascia subito il vecchio handle. Prima del takeover viene verificato se l'owner autenticato risponde ancora; se risponde si ripristinano i documenti senza creare un motore locale e senza ripetere l'operazione incerta.
- Log ChannelFailure con fase, causa classificata e codice Windows; RuntimeRequest/RuntimeReply con solo comando e dimensioni; Fallback con motivo e dettagli classificati. Il marker locale, letto con limite di 512 byte e campi nuovamente filtrati, porta lo stesso motivo dal client al Light che osserva il lock diretto. Studio registra Fallback anche senza debug, attraverso il writer con rotazione gi? condiviso.
- Rev A restituisce byte effettivi e tipo full/partial/unchanged. FullFrame registra connessione, orientamento, screen_off, release, scrittura precedente fallita o intero canvas modificato. Il Rev C distingue assenza di baseline, diff pi? grande del frame e richiesta del dispositivo. Un driver privo di statistiche ? unknown.

## Verifiche

`cargo test -p bezel-runtime -p bezel-power -p bezel-devices -p bezel-core -p bezel -p bezel-studio`: 942 test superati. Dopo l'ultima modifica al writer, ripetuti i test lib di power e Studio: 247 superati. Clippy sugli stessi sei package, tutti i target, con -D warnings e cargo fmt --check superati. Nessun modulo UI JavaScript modificato.

Regressioni aggiunte: catalogo oltre 64 KiB su pipe reale, risposta rifiutata/eccessiva seguita da altre richieste riuscite nella stessa sessione, bounds locali senza disconnessione, owner raggiungibile senza fallback, ripristino bozza su nuova sessione, statistiche Rev A e relative invalidazioni, worker con driver Rev A reale e wire finto (full, unchanged, partial), privacy e motivo di fallback anche a debug spento.

Non ? stata eseguita una nuova prova con scritture sui dispositivi. Ripetere con COM6 (Turing 8.8 Rev C, earth.mp4 interno) e COM3 (Turing 3.5 Rev A), BEZEL_DEBUG=1 e BEZEL_PERF_LOG=1. Aprire Studio dalla tray e chiuderlo pi? volte: nessun Fallback con Light disponibile, grafici e video continui. Nel log attendersi RuntimeRequest Sensors seguito da RuntimeReply con payload JSON oltre 64 KiB; per COM3 leggere le metriche reali e i motivi dei frame full, anzich? il vecchio valore sostitutivo. Verificare anche crash effettivo di Light e fallback motivato. VERSION ed eseguibili installati invariati.
