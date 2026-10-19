# Sonde GPU e riavvio per servizio

## Richiesta

Raggruppare le voci GPU nella sonda effettiva e spostare il riavvio dal fondo
del popover alla riga di ciascun servizio che lo supporta.

## Intervento

- Le sorgenti degli alias primari hanno forma `gpu.0.usage (NVML)`; quelle
  delle metriche non supportate hanno soltanto `gpu.0.voltage`. La prima
  parola non identifica quindi il lettore. Il parser estrae il provider e,
  per le metriche mancanti, usa il catalogo della stessa GPU indicizzata.
  Non prende il provider di un'altra scheda; senza sorgente certa usa
  il gruppo senza sonda assegnata.
- Riepilogo, conteggi, select Sonda, righe e filtri condividono la risoluzione.
- Azione Riavvia sulla riga LibreHardwareMonitor, con nome accessibile,
  stato di avanzamento e blocco dei doppi click. Rimossi pulsanti globali
  del footer e della barra di stato. Il messaggio della libreria Sensori
  usa la stessa azione tramite callback, senza pulsanti DOM nascosti.
- Solo il lettore Libre gestito espone attualmente un riavvio. Non si
  propongono riavvii di Windows, NVML o driver video.
- Stringhe en/pt-BR/it a parità chiavi; guida e screenshot aggiornati.

## Verifiche

- 70 unitari UI mirati verdi: alias reali, metriche non supportate, due
  GPU con lettori diversi, conteggi e ambito di campionamento, i18n e D-14.
- 28 e2e area sensori verdi nei quattro progetti chiaro/scuro, en/pt-BR:
  riavvio locale, progress, filtri, recupero, navigazione, drag e axe.
- Screenshot demo chiaro/scuro controllati. Nessun crate Rust modificato,
  nessuna suite completa o pubblicazione.

## Consegna

Conferma utente di salvataggio/chiusura ricevuta; nessun processo Bezel aperto
prima della build. Script ufficiale `build-evo.ps1 -Version 0.1.48` riuscito
in 1m30s. CLI e metadati Studio .48 verificati. Studio avviato direttamente
da `target/release`, PID 19708 rispondente. Installata resta .45; nessun
setup, push o pubblicazione.

- SHA256 Studio: `40DA9B327C91EE8B6D1C648A529747BD751048E0D3947F543614B6AAC42232C8`.
- SHA256 CLI: `17F0B1FEC55C47ADC4BDB6C11B3328C775A00F54895BCA96CC4A6E5D69D9757B`.
- Commit implementazione `849ba72`; guida/screenshot `d6ad735`.
- Resta prova visiva utente con GPU e sonde reali.
