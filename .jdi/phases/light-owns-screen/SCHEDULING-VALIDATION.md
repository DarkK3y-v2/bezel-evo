# Verifica della correzione delle cadenze

Motore unico D-31 conservato. Campionamento separato, un worker seriale per schermo, un frame pendente sostituibile, canvas da snapshot indipendenti dal mutex del motore. Nessun cambio VERSION o eseguibile installato.

## Controlli automatici

- `cargo test -p bezel-runtime -p bezel -p bezel-power`: 191 test superati, inclusi regressioni CLI, pipe Windows reale, ACL e limiti. Il package CLI si chiama `bezel`.
- `cargo clippy -p bezel-runtime -p bezel -p bezel-power --all-targets -- -D warnings`: superato.
- `cargo fmt --check`: superato.
- `cargo test -p bezel-studio --lib`: 222 test superati.
- `npm run test:unit`: 528 test superati.
- `npx playwright test debug.spec.mjs --workers=4`: quattro progetti superati, inclusa verifica axe e apertura della cartella dei log.

Il dispositivo finto lento blocca un invio per oltre 1,1 secondi: il campionatore continua ogni 250 ms, il secondo schermo continua a ricevere frame, il canvas risponde anche mantenendo il mutex del motore occupato. Al rilascio del dispositivo arrivano solo il frame in volo e l'ultimo pendente. I grafici conservano le rispettive cadenze di 250 ms e un secondo. Un test sulla pipe reale verifica che Image non entri nel mutex del motore. Restano verdi le regressioni di continuit? storici, bozza/chiusura e video sul dispositivo.

La diagnostica verifica rotazione entro tre file da 2 MiB, rifiuto record eccessivi, debug acceso/spento, timestamp e assenza di percorsi personali anche da eventi media. Solo i campi tipizzati Light possono raggiungere light.log.

## Verifica hardware ancora da fare

Turing 8.8 Rev C su COM6 con earth.mp4 interno e grafici, insieme allo schermo 3.5. Aprire e chiudere Studio pi? volte; verificare storici continui, nessun ridisegno o riavvio video, regolarit? delle letture su entrambi. Ripetere con bozza non salvata e durante invii lenti sul 3.5.

Abilitare debug nelle preferenze o `BEZEL_DEBUG=1`: leggere `%LOCALAPPDATA%\io.github.slipalison.bezel\logs\light.log`, insieme a studio.log, tramite Apri cartella dei log. Con `BEZEL_PERF_LOG=1` confrontare sul terminale intervalli reali dei campioni e durata/tipo degli invii per schermo. Misurare CPU e memoria nelle stesse condizioni prima/dopo: i test automatici dimostrano l'isolamento dalle scritture lente, non quantificano il guadagno sull'hardware.
