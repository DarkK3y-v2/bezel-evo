# Selettore sensori condiviso e inerzia dei valori

## Risultato

- Stessa card chiusa e stesso selettore ricercabile per sorgente, colore dal
  valore e movimento. Ricerca per nome, chiave, categoria e sonda, gruppi per
  categoria, lettura e stato disponibili, tastiera e ripristino del focus.
- I contesti numerici escludono i sensori testuali. Gli alias GPU mantengono la
  sonda canonica; una lettura zero resta valida. Nessun polling aggiuntivo.
- Movimento: «Velocità piena a» con unità nativa, «Un giro ogni» in secondi,
  «Avvio e arresto» immediati/graduali/morbidi. Valori personalizzati conservati.
- Transizione valori: Nessuna/Fluida/Inerzia. Risposta smorzata con continuità
  di posizione e velocità quando cambia il bersaglio, arresto finito al tempo
  scelto, rispetto del movimento ridotto e delle letture mancanti.
- Formato retrocompatibile: `mode: smooth` e flag opzionale `inertia: true`.
  Le versioni precedenti ignorano il flag e usano Fluida; temi esistenti invariati.

## Verifiche mirate

- 141 unitari UI verdi, inclusi i18n/statici, ricerca e risposta analitica.
- 56 casi e2e dell'area coperti in chiaro/scuro e italiano/inglese: ricerca,
  tastiera, Undo, tre contesti, anteprima, colore e catalogo da 700 sensori.
  Contrasto dei metadati in hover corretto e ricontrollato con axe. I casi
  falliti per collisione della cartella test-results sono passati isolatamente
  con output distinti; nessuna riesecuzione della suite completa.
- Test bezel-core (179 unitari più integrazioni/doctest) e bezel-themes
  (73 unitari più integrazioni) verdi; clippy dei due crate all-targets verde.
- Ispezionate le immagini del selettore in chiaro e scuro. Resta la prova
  dell'utente sui temi reali e sui due display, distinta dai test browser.

## Consegna

Build diretta 0.1.54 consegnata, senza setup o pubblicazione. Installata .45.
Studio e Light erano chiusi prima della compilazione. Script ufficiale riuscito
in 2m41s, CLI e metadati Studio verificati. Studio avviato da target/release,
PID 33640 rispondente.

- SHA256 Studio: `615043040D17C5931F9A71A876D48A9DB377057F55067983D09DC23FAEE1B7E5`.
- SHA256 CLI: `68D24AD6DFC339CAE043CBE241120C3A17DDBD86F6581EA0967AFADC2D82CC0E`.
Fase 20 e prova H264 su USB compatibile restano aperte.
