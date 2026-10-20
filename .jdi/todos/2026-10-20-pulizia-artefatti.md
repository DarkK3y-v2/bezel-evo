# Pulizia dei residui locali

L'utente chiede di eliminare contenuti inutili, oltre a ridurre il peso.
Revisione del repository esistente, senza toccare dist, dati utente, cache di
compilazione o modifiche sorgenti concorrenti.

## Rimosso

- 221 file .log direttamente in target, ultima modifica precedente al
  19 ottobre 2026: 41.299.589 byte. Diagnostica storica di iterazioni precedenti;
  riepiloghi versionati conservati. Log recenti del 19/20 ottobre mantenuti.
- Quattro coppie exe/pdb diagnostiche: libre-restart-check, light-switch-smoke,
  request-light-quit, runtime-dir. Verificata presenza dei rispettivi sorgenti
  .rs, rimasti al loro posto, e assenza di processi attivi da questi percorsi.
- Directory vuote target/tmp e target/startup-heartbeat-test.

Rimozioni mirate di singoli file e directory vuote, senza operazioni ricorsive.
I precedenti engine-* risultavano già assenti prima di questa pulizia.

## Conservato o rimasto aperto

- target/release, debug e materiale di packaging: nessun nuovo cargo clean.
- target/research/libre-panel, fw-analysis-tools, archivio ufficiale TURZX e
  reperti firmware: indagine avvio interno 8,8 ancora aperta.
- Backup exe before-*, patch WIP, file di ripristino impostazioni/registro:
  non classificati automaticamente come inutili, non cancellati.
- dist in ogni sua parte, inclusi asset approvati e backup storici.
- Screenshot, anteprime e script diagnostici non riesaminati singolarmente.
- Cinque directory e2e-* con .last-run.json e uno screenshot di errore vecchio:
  tentativo di eliminazione esplicita respinto dal controllo automatico prima
  dell'esecuzione. Gruppo non rimosso; non aggirare il rifiuto con altri strumenti.

## Prevenzione

AGENTS.md ora richiede output nuovi in target/logs/<attivita> o
target/scratch/<attivita>, pulizia dei soli intermedi posseduti dall'attivita e
risultati utili sintetizzati in .jdi. Evidenze hardware irrisolte e backup hanno
durata distinta. Resta attiva la precedente correzione TempDir dei test runtime.

Nessuna modifica funzionale, build prodotto o suite test per la sola pulizia.
La policy ha consentito le rimozioni puntuali iniziali ma bloccato il gruppo
Playwright; il risultato riportato distingue quanto effettivamente eliminato.
