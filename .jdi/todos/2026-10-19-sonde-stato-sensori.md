# Riepilogo sonde e filtri sensori

## Richiesta

Semplificare il popover: sonde invece dei dettagli di ciascun hardware, stato e
numerosità dei sensori. Aprire Sensori al clic con filtri per sonda e stato.

## Implementazione

- Modello condiviso `sensor-probes.js`: identità sonda, stato lettura, conteggi
  e corrispondenza ai filtri. Windows e sysinfo riuniti nella sonda Windows;
  i percorsi LibreHardwareMonitor diventano un'unica sonda. Origine sconosciuta
  distinta come sonda non assegnata.
- Popover con totale gestito, conteggi globali e una riga per sonda: operativa,
  parziale, nessuna lettura o da verificare. Nessuna lista di hardware, chiavi o
  valori individuali. Conteggio zero non segnalato con colore di allarme.
- Clic sonda apre tutti i suoi sensori; clic disponibile/non disponibile/da
  verificare apre quella combinazione. Apertura generica azzera filtri e ricerca.
- Due select Sonda e Stato si combinano con categoria e ricerca, con totale
  risultati. Disponibile include valori zero e testo; assenza di lettura resta
  da verificare, distinta da errore esplicito o campione globale fallito.
- Il filtro per stato continua a misurare l'ambito sonda/categoria/ricerca per
  rilevare recuperi e nuovi errori. Non avvia il campionamento dell'intero catalogo
  quando Sensori è chiuso. Vale anche per ping nell'ambito selezionato: guida
  aggiornata per rendere esplicito questo comportamento.
- Se i membri della lista non cambiano, aggiorna valori e attributi senza
  ricreare le righe. Conteggi e select stabili per non perdere focus o drag;
  `aria-live` dei risultati aggiornato solo quando cambia il numero.
- Riavvio resta limitato a Libre. Nessuna modifica ai reader o al codice Rust.
- Stringhe UI en/pt-BR/it a parità chiavi; riuso della griglia di campi condivisa.

## Verifiche

- 69 unitari UI mirati verdi: modello sonde, raggruppamenti libreria, salute
  Libre, i18n e controlli statici D-14. Test di recupero, valori zero/testo,
  sensori mai letti, errori globali e misurazione del corretto ambito.
- 28 e2e dell'area verdi, chiaro/scuro e inglese/portoghese, controlli axe:
  popover, filtri combinati, recupero automatico, restart, dismiss, drag e
  ambito dei sensori comunicato al backend.
- Quattro riesecuzioni del solo caso documentale dopo aggiunta screenshot,
  verdi. Anteprime in chiaro/scuro controllate visivamente.
- Screenshot demo aggiornato `docs/images/studio-sensor-probes.png`, senza
  dati personali. README e guida sensori descrivono il nuovo flusso.
- Non eseguite suite Rust o completa: nessun crate toccato, nessun push.

## Consegna

Codice pronto per la .47. Richiesta conferma di salvataggio/chiusura dello Studio
prima di compilare: la .46 in `target/release` è aperta. Nessun setup o push
richiesto. La copia installata resta .45; aggiornare qui l'esito della build.
