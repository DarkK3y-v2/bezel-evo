# Profili con configurazione multischermo

## Richiesta

Un profilo rappresenta l'intera configurazione: ad esempio Gaming associa un
tema allo schermo 1 e un altro allo schermo 2. Una selezione o un trigger attiva
il profilo completo. I nomi dei temi selezionati devono essere leggibili e non
sostituiti dalla dicitura generica «Tema originale».

## Implementazione

- `Profile.themes` associa le chiavi stabili dei display ai percorsi dei temi.
  La scelta manuale/automatica, la priorità e il rientro sono unici per profilo.
- Il motore valuta una sola selezione per ciclo e carica il tema appropriato
  per ciascuna scena; cache distinta per coppia profilo/display, budget asset e
  controllo della compatibilità fisica conservati.
- Lettura compatibile con i profili .39 (`screen`/`theme`): conversione a una
  mappa con un abbinamento, senza perdere regole o selezione. Al salvataggio si
  scrive il nuovo formato. Nessuna riscrittura automatica aprendo il dialogo.
- La UI mostra i temi selezionati di entrambi gli schermi. Ogni profilo contiene
  i selettori affiancati, filtrati per modello; si inizializza dagli abbinamenti
  correnti e mantiene quelli memorizzati per display scollegati.
- Nomi ricavati dai documenti di Studio e dai manifest salvati per ogni schermo:
  `lastTheme` non viene riutilizzato indiscriminatamente per il secondo display.
- Le opzioni di rientro nel dialogo e nei due tray riportano i nomi effettivi.
  «Nessun tema selezionato» è usato solo quando il tema non è assegnato.
- Durante l'editing resta la sospensione del cambio su quel display e la
  conservazione della bozza e dei pixel del canvas, come nella .39.

## Verifiche e stato

- 12 e2e verdi nella specifica profili (due temi distinti, due profili indipendenti,
  selezione e fallback, persistenza, compatibilità dei picker, accessibilità).
- 106 unitari UI mirati verdi; 43 test del runtime verdi, con nuova regressione
  che applica Gaming a display di dimensioni diverse e ripristina entrambi.
- Migrazione del formato precedente verificata; ambiguità fra vecchi e nuovi
  campi rifiutata. Aggiunto controllo dei nomi dei documenti parcheggiati di Studio
  e dei temi salvati separatamente per i due display.
- Clippy dei tre crate toccati verde; test, integration e doctest dei soli tre
  crate verdi, compresi 223 unitari Studio. Nessuna suite workspace o push.
- Screenshot verificato: `dist/profiles-two-displays.png`.
- Consegna prevista: build diretta 0.1.40, nessun setup, installazione o push.
  Studio .39 resta aperto: richiesta di salvataggio e chiusura inviata a codice
  verificato; compilazione .40 ancora da avviare.
