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
- Pronto per .49; Studio .48 e Light ancora aperti in target/release.
  Attesa conferma salvataggio e chiusura per build diretta, senza setup.
