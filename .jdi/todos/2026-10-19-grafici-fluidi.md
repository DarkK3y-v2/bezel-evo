# Grafici fluidi nel runtime nativo

## Aggiornamento di consegna

La build diretta .44 è stata seguita dal setup locale **.45**, creato e avviato
su richiesta dell'utente. Installazione verificata tramite registro Windows e
hash degli eseguibili installati. Vedi [setup .45](2026-10-19-setup-0.1.45.md).
I risultati fisici sotto riportati appartengono alla misura sulla .44; .45
impacchetta lo stesso comportamento senza ulteriori modifiche al codice.

## Richiesta e perimetro

Dopo il prototipo H264 e la prova sul CT88 seriale, integrare la fluidità dei
grafici nel prodotto mantenendo il supporto a display diversi. Nessun setup o
pubblicazione richiesti: build locale da avviare direttamente.

## Implementazione

- Storico sempre composto da campioni reali, alle cadenze già configurate.
  Registrazione del tempo del campione e del periodo della serie, conservati
  attraverso le modifiche del tema. Campioni senza tempo e miniature statici.
- Scorrimento geometrico di linea, area e barre fra i campioni. Il bordo destro
  interpola solo segmenti senza buchi. Ritardo visivo fino a un intervallo di
  campionamento: nessuna previsione o inserimento di letture inventate.
- Intervallo di disegno 20 ms per grafici visibili. Worker fisico già separato
  per display; durante un invio lento si saltano i disegni di solo movimento,
  conservando campioni e aggiornamenti della scena. Nessuna coda di fotogrammi.
- Cache delle facce escluse durante il movimento del grafico; rendering con
  movimento ridotto mostra l'ultimo grafico statico. Scorrimento limitato alla
  normale cadenza dopo sospensione, senza animare per tutta la durata della pausa.
- Corretto il budget di `Engine::tick`: sottrae il tempo impiegato dal tick
  dall'attesa restituita. Prima il rendering si aggiungeva a ogni attesa.
  La prima misura sui temi reali ha mostrato circa 33,4 invii/s sul display
  grande: ha motivato questa correzione prima della consegna definitiva.
- Nessuna modifica al formato dei temi o alle stringhe UI. H264 resta
  sperimentale e non attivato dal runtime.

## Verifiche

- Core: 178 unitari e tutte le integrazioni/doctest verdi. Nuovi casi: tempo,
  adozione, cadenze indipendenti, buchi, ripresa dopo una pausa.
- Renderer: 85 unitari verdi, un ignorato preesistente; integrazioni/doctest
  verdi con un ignorato. Nuovi casi geometrici di clipping e interpolazione,
  confronto pixel dei tre stili fra due istanti e movimento ridotto.
- Runtime: 47 unitari verdi. Intervallo 20 ms senza campioni aggiuntivi, budget
  esaurito da rendering lento senza ulteriore attesa, isolamento fisico dei due
  display, storico e ripresa editor. Due test dell'esempio probe già verdi.
- Clippy all-targets con -D warnings sui tre crate verdi; dopo la correzione
  del budget rieseguiti tutti i test e clippy del runtime, verdi.
- Nessuna suite UI necessaria: nessun modulo UI modificato. Nessun push e
  nessuna suite workspace richiesta durante lo sviluppo.

## Consegna

Build ufficiale locale 0.1.44 completata e avviata direttamente, senza setup.
Studio verificato chiuso prima di entrambe le compilazioni; Light rilasciato
mediante il suo file cooperativo di uscita e riavviato automaticamente, senza
terminazioni forzate. Prima build 2m10s; ricompilazione definitiva dopo il budget
1m28s con `build-evo.ps1 -Version 0.1.44`. CLI e metadati Studio .44 verificati.

- Light definitivo PID 38900, Studio avviato PID 35236 da `target/release`.
- Misura di dieci secondi sul tema utente Midnight dell'8.8: 329 completamenti,
  tutti parziali, 32.96 invii/s, media invio 5.75 ms. Lo schermo 3.5 ha dieci
  invii parziali e dieci invariati nello stesso intervallo: il suo tema non ha
  grafici e non deve disegnare a 50 fps. Non sono misure ottiche del pannello.
- Report: `dist/scene-stream-probe/production-0.1.44-report.json`.
- SHA256 Studio: `09749E8FFB4659C2201FF2094960DABC37E41EB1CBD234BCB9A472FFAEA926B9`.
- SHA256 CLI: `1A7307C8D23E89CBD3D58AA5030B362F9009228B9D869FBF4766A4AD1FC29C18`.
- Nessuna modifica ai temi o impostazioni dell'utente, nessun setup o push.

Il massimo richiesto è 50 fps; il tema reale contiene sette grafici e uno
spettro, e la velocità effettiva dipende dal rendering e dal dispositivo. Il
prototipo semplice non equivale alla prestazione di ogni tema. H264 resta
separato, da provare su USB 1CBE compatibile; nessun comando H264 al CT88.

Commit: `bfed33e` scorrimento e backpressure, `317892c` budget del tick.
