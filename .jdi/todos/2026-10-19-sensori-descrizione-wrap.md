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
- Conferma utente di salvataggio e chiusura ricevuta; nessun processo Bezel
  aperto prima della build. Script ufficiale .51 riuscito in 1m22s, CLI e
  metadati Studio verificati. Avvio diretto da target/release, PID 21408
  rispondente. Nessun setup o push; installata resta .45.
- SHA256 Studio: `A8B73B2A05FDA4FFDC602FACE6E8468B80F0AC7D039E855ACC82386CE762CAFA`.
- SHA256 CLI: `A9A9581808BB2712B1A8EE6826DEA2BBC7010605BC4E7D9425C875691697E3D9`.
- Commit CSS: `28e03e7`. Resta prova visiva utente sul pannello reale.
