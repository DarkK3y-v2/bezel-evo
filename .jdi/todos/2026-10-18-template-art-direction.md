# Rifacimento grafico dei sei template

## Feedback e risultato

L'utente respinge i temi appena creati come troppo poveri. Non richiede una
variante cromatica: viene rifatta la composizione dei sei originali, conservando
percorsi e nomi per mantenere gli abbinamenti ai profili.

- Pulse / Gaming: cockpit con griglia oliva, piastre a spigoli tagliati, scale
  graduate, quadrante GPU lime e termica arancione, card CPU carico/termiche,
  modulo memoria, array termico, cronologie a 90 secondi. Round con doppio anello,
  tacche e letture centrali, palette e tipografia coordinate.
- Resonance / Music: ambiente prugna/rame, copertina protagonista e disco vinile
  con solchi vettoriali e spettro radiale del sistema. Card standby/riproduzione
  con trigger media e dissolvenza di 800 ms, rientro dopo 3 secondi. Stato vuoto
  disegnato, copertina e dettagli reali quando parte la musica. Round con copertina
  circolare, spettro esterno, metadati e timeline.
- Clarity / Monitor: colonna orologio rame, letture CPU/GPU e cronologie in
  impaginazione editoriale crema, modulo memoria scuro con quadrante. Round con
  disco rame, scale, orologio e due indicatori CPU/GPU.
- Tutti i valori sono widget effettivi, con audio e media reali; nessuna lettura
  simulata salvata nei temi. Artwork statico in SVG locali, font Inter e JetBrains
  Mono inclusi. Nuovo modulo `scripts/modern_theme_designs.py`, generatore principale
  aggiornato. Non vengono scritte cache Python nel repository.

## Verifica

- `cargo test -p bezel-render coordinated_templates -- --nocapture` verde.
  Il test carica tutti i manifest e gli asset, verifica i sensori e i limiti
  geometrici, renderizza i sei temi con letture, cronologie, media e spettro,
  entrambe le facce. Nessun codice Rust/UI è stato modificato; nessuna suite
  workspace o clippy aggiuntiva necessaria per questa modifica ai contenuti.
- Anteprime controllate in `dist/modern-theme-redesign/` per i sei layout e
  le facce. Corretto anche l'ordine della card musicale: membri contigui,
  intestazioni globali dopo i membri, visibili in entrambe le facce.
- Log finale `target/modern-theme-redesign-final.log`; diff whitespace valido.
- Commit `71d6626`, guida `themes/README.md` aggiornata; changelog .42 preparato.

## Stato della consegna locale

I sei originali e gli SVG sono già copiati nelle rispettive cartelle di
`target/release/themes`, senza cancellare altri temi o toccare copie personali.
SHA256 di ogni file confrontato con la sorgente. Nello Studio .41 già aperto
(PID 47596 all'ultimo controllo) basta Temi → Aggiorna l'elenco e riaprire gli
originali inclusi. Il documento aperto rimane in memoria.

Per rispettare la versione distinta per l'aggiornamento, è stata richiesta
conferma di salvataggio e chiusura per compilare e avviare direttamente .42 con
`build-evo.ps1 -Version 0.1.42`. Non è stata ancora ricevuta. VERSION ed eseguibili
restano .41; nessun setup, installazione, push o terminazione forzata di Studio.
Alla conferma: build .42, verifica metadati/hash/percorso, avvio diretto, commit
VERSION/CHANGELOG e aggiornamento dello stato.
