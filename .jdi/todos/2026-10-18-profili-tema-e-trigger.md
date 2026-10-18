# Profili tema dal tray e cambio automatico

## Richiesta e ordine dei lavori

L'utente conferma prima l'ampliamento dei sensori Sistema (audio, informazioni
del sistema, alimentazione dove disponibile). Successivamente vuole poter
cambiare un intero tema tramite una voce nel tray e associare il cambio ad
applicazioni o eventi: musica in riproduzione e gaming sono i primi esempi.

## Proposta di comportamento

- Profili nominati (es. Predefinito, Musica, Gaming), ciascuno associato a un tema salvato.
- Menu Profili nel tray con profilo attivo e modalità Automatica.
- Selezione manuale persistente fino alla riattivazione di Automatica.
- Regole iniziali: applicazione in primo piano, riproduzione multimediale
  eventualmente limitata a un'app. Valutare processo in esecuzione separatamente
  dal primo piano: un launcher aperto non deve implicare automaticamente gaming.
- Priorità esplicite fra regole concorrenti e breve ritardo di rientro per evitare
  continui cambi quando la musica viene messa in pausa o si cambia finestra.
- Profilo predefinito quando nessuna regola è attiva.
- Le regole cambiano il tema sul display senza sostituire il documento in modifica
  nello Studio. Il funzionamento deve proseguire con il solo Light attivo.

## Evidenza dal codice

Il nuovo motore riusa la semantica dei trigger delle facce delle card
(`crates/bezel-core/src/domain/playback.rs`) per il cambio dell'intero tema.
`crates/bezel-runtime/src/profiles.rs` gestisce priorità, rientro, selezione
manuale e persistenza locale condivisa (`profiles.json`, accanto a settings.json).
Entrambi i tray espongono selezione, Automatico, Tema originale e Gestisci profili.
La gestione principale è in Temi → Profili e automazioni, come concordato con
l'utente durante l'implementazione; l'accesso provvisorio da Preferenze è rimosso.

## Stato

Codice implementato. Utente ha confermato salvataggio e chiusura: build locale
0.1.39 in corso con build-evo.ps1, poi avvio diretto da target/release.
Nessun setup o push. Commit funzionali: `b61b4f9`, `7f6bfff`, `3b72b17`.
Correzione di rientro: `3a1799d`, rilettura del tema appena salvato dopo l'editing;
prima build .39 non avviata, ricompilazione finale con la stessa versione ancora
non consegnata. Regressione verificata anche con frame distinguibili fra profilo
e documento per provare che il canvas pubblicato conserva i pixel dell'editor.

- Sensori Sistema: volume reale, muto, nome uscita, versione Windows, processi,
  corrente, batteria, carica e autonomia; test di lettura sull'uscita audio reale
  riuscito su questo PC. Nessuna modifica al volume effettuata.
- Regole per primo piano, processo in esecuzione e riproduzione multimediale.
  Profili associati a un singolo display; più profili possono usare display diversi.
- Editing: nessun cambio mentre il canvas di quel display è richiesto; attesa
  di due secondi dall'ultima richiesta. Quando Studio è nascosto i profili riprendono.
  La selezione manuale resta salvata, anche mentre l'editing sospende l'output.
- Anteprime controllate: `dist/profiles-editor.png`, `dist/system-sensors.png`.
  Corrette in verifica visiva le dimensioni dei campi testo, lo scorrimento del
  dialogo con azioni persistenti e lo spazio per label/chiavi nella lista Sistema.
- 56 e2e mirati verdi (profili, libreria, debug); otto casi dei profili rieseguiti
  dopo gli aggiustamenti di layout, tutti verdi. 118 unitari UI distinti verificati
  tra esecuzioni mirate; adeguato il test del catalogo demo ai nuovi sensori testuali.
- Test Rust dei cinque crate toccati, inclusi integration e doctest, verdi.
  Un confronto float preesistente nel recupero del canvas ha fallito sotto carico
  nella prima esecuzione; rieseguito da solo, verde. Suite workspace non eseguita.
- Clippy dei cinque crate verde; verifica finale mirata del runtime verde dopo
  adeguamento del budget asset, supporto ai temi con orientamento diverso sullo
  stesso modello e ripristino del comportamento automatico delle card nei profili.
- 41 test del runtime verdi nell'ultima esecuzione; nuova regressione musica/game
  verifica anche precedenza, rientro ritardato e parità risolta con l'ordine salvato.

Limiti intenzionali: nessun cambio del documento aperto, nessun trigger orario
o webhook in questa prima versione. La prova fisica del cambio temi e dei menu
nativi rimane una verifica utente; i test del motore usano display simulati.
