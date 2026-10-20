# Filtro per tipo nei Livelli

## Comportamento

- Aggiunto selettore Tipo di oggetto sotto la ricerca dei Livelli, con
  Tutti i tipi e i tipi widget esistenti, inclusi Card e Gruppo.
- Testi statici, valori sensore, orologi, meteo, player e spettro audio
  rimangono distinti pur condividendo il tipo testo del formato interno.
- Ricerca e tipo devono corrispondere allo stesso oggetto. Restano visibili
  i contenitori dei figli trovati, preservando gli indici delle facce.
  Quando il contenitore stesso corrisponde, conserva tutto il sottoalbero,
  come già avveniva con la ricerca testuale.
- Il filtro apre temporaneamente i contenitori chiusi; azzerando i filtri
  si ripristina lo stato precedente. Nessuna modifica a tema o selezione.
- Select stabile durante il rendering, etichette riaggiornate al cambio lingua,
  tutte le stringhe en/pt-BR/it a parità chiavi. Guida editing aggiornata.

## Verifiche

- 71 unitari UI mirati verdi: ogni tipo reale, ricerca combinata, gerarchie,
  facce e immutabilità, libreria, i18n e controlli statici.
- 16 e2e area Livelli verdi nei quattro progetti: filtro, ricerca, assenza
  risultati, conteggi, gruppi chiusi/ripristino, drag semplice e card, axe.
- Anteprima demo chiaro/scuro controllata in target/layer-type-preview.
- Nessun crate Rust modificato, nessuna suite completa o pubblicazione.

## Consegna

- Commit funzionalità e guida: `e2e8bb9`.
- Studio e Light assenti prima della build ufficiale .52, riuscita in 1m24s.
  CLI e metadati Studio verificati. Avvio diretto da target/release, PID 25188
  rispondente. Nessun setup o push; installata resta .45.
- SHA256 Studio: `E3B4ECD5F5A37627C8A257511380C8B4BD2C359D519699C87E2520B97028FC89`.
- SHA256 CLI: `637EA0C43CD18DE65D0EF52BE58421CD498936DD8C9C179EACE1E315F1D4F187`.
- Resta prova visiva utente sul tema reale.
