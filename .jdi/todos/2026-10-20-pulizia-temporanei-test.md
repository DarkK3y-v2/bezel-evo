# Pulizia automatica dei temporanei dei test

Richiesta utente dopo il controllo di target: 284 cartelle engine-PID-indice,
293 file, appena 21.131 byte complessivi. Origine individuata nella fixture dei
test di bezel-runtime, che creava una directory nuova senza distruggerla.

Modifica: fixture con tempfile::TempDir univoca nella directory temporanea del
sistema, guardia posseduta dalla fixture e distrutta dopo Engine e relativi
handle. Pulizia a fine test anche durante unwinding di un panic. Anche i file
dei due test profili sono ricondotti alla stessa durata di vita. Regressione
esplicita su file annidati, uscita normale ed errore simulato.

Regola aggiunta ad AGENTS.md: temporanei di test con durata di vita definita,
chiusura handle prima della rimozione; evitare cartelle per esecuzione abbandonate
e pulizie indiscriminate delle directory runtime reali. Crash/kill del processo
non garantiscono l'esecuzione dei distruttori.

Nessuna rimozione retroattiva delle vecchie cartelle: la precedente cancellazione
di debug/coverage era stata bloccata dal controllo automatico e non viene
aggirata. Nessuna modifica a dist, processi Studio o binari consegnati.
Le modifiche concorrenti già presenti in core/runtime non appartengono a questo
intervento e non devono essere incluse nel relativo commit.

## Verifiche

Clippy bezel-runtime --all-targets -D warnings passato. Primo tentativo test
bloccato dalle firme concorrenti, poi aggiornate dall'altro lavoro in corso.
Nuova esecuzione: 52 test passati incluso il controllo pulizia normale/panic,
un test profili fallito sotto carico e passato alla sola riesecuzione isolata
(one_gaming_profile_switches_two_different_displays_and_restores_both).
Render JDI --check passato. Non eseguita suite completa del workspace.

Controllo richiesto su F:/Dev/bezel-rotation: worktree storico fid/rotation,
nessuna modifica locale, nessun commit non integrato in HEAD. 19,62 GiB totali,
19,58 nel suo target. Eliminabile tramite git worktree remove dopo verifica di
assenza processi/uso; nessuna rimozione effettuata in questo turno.
