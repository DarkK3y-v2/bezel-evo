# Barre di scorrimento Studio

- Richiesta: sostituire la barra nativa vistosa nel popover sonde con una
  soluzione moderna e coerente. Regola condivisa in base.css per tutti i pannelli.
- Pista trasparente, nessuna freccia, cursore arrotondato visibile di 4 px
  dentro un'area trascinabile di 10 px; al passaggio del mouse diventa di 6 px.
  Colori dai token del tema chiaro/scuro, feedback durante il trascinamento.
  In modalità Windows a contrasto forzato restano i controlli nativi.
- 16 controlli statici UI e quattro e2e del popover verdi. Prova browser con
  lista lunga e scrollbar realmente visibili: trascinamento verificato nei due
  temi (scrollTop 119), screenshot controllati in target/scrollbar-preview.
  Nessun test aggiunto per questa modifica CSS; nessuna suite completa.
- Conferma salvataggio/chiusura ricevuta; nessun processo Bezel prima della build.
  `build-evo.ps1 -Version 0.1.49` riuscito in 1m31s; CLI e metadati Studio
  verificati. Studio avviato direttamente da target/release, PID 11632
  rispondente. Installata resta .45; nessun setup, push o pubblicazione.
- SHA256 Studio: `3DD7155362B0EE8441949E9D12D50FB02F76966B8C80BA3977CD3DA05D76DDEA`.
- SHA256 CLI: `8194E3C904F5AEB19A992B7E7172AEFF810B6FC6460492FADDB0B34BA7230400`.
- Commit stile condiviso: `c8f450c`. Resta prova visiva utente sullo Studio reale.
