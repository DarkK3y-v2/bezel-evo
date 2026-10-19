# Movimento grafico collegato ai sensori

## Richiesta e risultato

Primo passo delle animazioni reattive: rotazione visiva proporzionale al dato,
con accelerazione/decelerazione, inerzia e arresto a zero. Applicabile a immagini
e icone personalizzate, forme e normali widget, anche dentro card e gruppi.
Contenitori e finestre video native esclusi; la rotazione statica manuale mantiene
le precedenti esclusioni. Non è un controllo delle ventole fisiche.

- `sensorMotion` opzionale nel formato tema: sensore, valore di riferimento,
  giri visivi/s massimi, inerzia in ms, verso. Validazione dei valori al caricamento;
  assente nei vecchi temi e omesso dalla serializzazione quando disattivato.
- Integrazione esponenziale basata sul tempo, non sul numero di frame; rapporto
  limitato a 0–1, massimo 10 giri visivi/s e inerzia 0–10000 ms. Letture mancanti,
  non finite, negative o zero portano a fermarsi. Snap sotto 0,001 giri/s per
  arresto finito e cessazione delle richieste di frame.
- Stato del renderer per scena/oggetto; immagini e forme non riusano cache
  statiche quando animate. Le facce animate non vengono congelate dalla cache.
- Richieste ogni 20 ms durante il movimento, backpressure per display estesa
  ai rotori. Nessun aumento del campionamento; il sensore entra nelle chiavi
  richieste dal tema e nell'ambito dell'inspector.
- Sezione Aspetto con sensore numerico, riferimento, velocità visiva, inerzia
  e verso. Anteprima isolata con canvas della diagonale per non tagliare i
  contenuti ruotati; demo coerente e stringhe en/pt-BR/it a parità chiavi.
- Riduzione movimento: orientamento statico originale, nessun tick del rotore.

## Verifiche

- Test dei sei crate modificati (core, renderer, themes, runtime, CLI e Studio),
  con due vecchie aspettative sul catalogo display riallineate al modello USB
  9.2 già presente. I due test falliti sono stati rieseguiti singolarmente.
- Nuovi test: stessa fase a 2, 10 e 50 fps, inerzia e arresto, inversione, zero e
  valori mancanti/non finiti, pixel reali, scene indipendenti, membro di card,
  formato/validazione, chiavi sensori e canvas completo dell'anteprima.
- 117 unitari UI mirati verdi. 20 e2e rotazione esistenti verdi e quattro nuovi
  e2e movimento verdi; fixture corretta per la forma, che ha solo Aspetto e
  quindi non espone una tab da cliccare. Quattro riesecuzioni dopo miglioramento
  della disposizione dei campi; screenshot chiaro/scuro controllati.
- Clippy all-targets dei sei crate con -D warnings verde. Nessuna suite completa
  workspace, push, prova fisica dei rotori o garanzia di 50 fps ottici.

## Consegna e aperti

- Commit: `5eb0b4b` core/renderer/formato/runtime, `2049fdc` UI e demo;
  ulteriore regressione del ritmo su display lenti verificata in Rust e JS.
- Conferma utente di salvataggio/chiusura ricevuta; nessun processo Bezel prima
  della build ufficiale .53, completata in 1m34s. CLI e metadati Studio verificati.
  Avvio diretto da target/release, PID 26536 rispondente. Installata resta .45;
  nessun setup, push o pubblicazione.
- SHA256 Studio: `D02DB858B00AA485718FF2E2E22B4D4183C4D71EC9BD63E71345A94300AEF024`.
- SHA256 CLI: `CC9E5018C0353E77D3FC577A8677D73FBB383ABFDE87684D17291381CF32953B`.
- Regolarizzazione del ritmo sui display lenti: commit `41d9078`.
- [ ] Prova utente con grafica ventola personalizzata e sensori RPM reali,
  inclusi arresto e ripartenza, lettura assente e due display di tipi diversi.
- [ ] Valutare altre proprietà reattive dopo la prova della rotazione.
