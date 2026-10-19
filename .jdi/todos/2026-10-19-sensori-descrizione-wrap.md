# Descrizioni sorgenti Sensori senza overflow orizzontale

- Segnalazione utente: la descrizione di round trip nel gruppo Rete allarga
  il pannello e crea una scrollbar orizzontale.
- Le griglie della lista e dei gruppi ora usano una colonna minmax(0, 1fr),
  con min-width nullo per il gruppo. Intestazioni flessibili e descrizione
  su più righe, inclusi percorsi senza spazi tramite overflow-wrap:anywhere.
  Non si nasconde il testo o la scrollbar per mascherare il problema.
- 23 unitari UI mirati e 12 e2e area sensori verdi; nessun nuovo test
  permanente per la modifica CSS. Prova browser con descrizione lunga e
  percorso senza spazi, larghezze 240/272/480 px, chiaro/scuro: scrollWidth
  identico a clientWidth per libreria e testo. Screenshot controllato in
  target/sensor-source-wrap. Nessuna suite completa o crate Rust modificato.
- Pronto per .51; Studio .50 ancora aperto. Attesa salvataggio e chiusura
  prima della build diretta, senza setup. Installata resta .45.
