# Spettro audio — scatti residui (2026-10-17) — RISOLTO

## Stato
- Branch `windows-improvements`, nulla pubblicato su GitHub dopo v0.1.26. Ultima release locale: 0.1.29 (installata),
  poi correzioni non ancora impacchettate: `dfc586c` (spettri su tutte le facce delle Card + finestra 40 ms
  e risveglio a fine finestra). In `dist/` ci sono 0.1.27, 0.1.28, 0.1.29 (build locali, non pubblicate).
- Sul PC dell'utente gira la build di sviluppo `target\release` (con `dfc586c`), non la 0.1.29 installata.
  Al riavvio di Windows parte la 0.1.29 installata, che non ha le ultime correzioni.

## Risolto stanotte
- Crash di Light (doppio free del PROPVARIANT, `b94fd08`).
- Spotify dallo Store: "Sorgente non disponibile" (`58714e4`).
- "Cattura audio disabilitata" su faccia di Card e blocchi da 100–200 ms a ogni lettura sensori (`dfc586c`).
- Cattura audio attiva di default (D-AS-10, `6d754e8`).

## Ancora aperto
- L'utente vede ancora qualche scatto. Misura (BEZEL_DEBUG=1, Present screen=2): ~22 fps, mediana 43 ms,
  circa 10 buchi da 80–90 ms e 1–3 oltre 100 ms ogni 40 s. Una parte cade all'inizio della lettura sensori
  (~150 ms prima del Sample), gli altri sparsi.
- Escluso con misure: motore bloccato, lock, thread audio fermo, cattura senza campioni, richieste che cambiano.
  Provate le priorità dei thread (render/audio/presenter alte, sensori bassa): nessun miglioramento, tolte.
- Prossimi passi proposti: (1) capire per ogni buco residuo se il frame è identico o se lo schermo è occupato
  (sonde 907/911/912 su scene.id 2, soglia 30 ms); (2) cambio di approccio: il worker audio invia i frame
  a passo fisso e il renderer interpola le barre tra un risultato e l'altro, così un frame perso non si vede;
  (3) ridisegnare solo l'area dello spettro tra una lettura sensori e l'altra.
- Poi: suite completa, pacchetto 0.1.30, push e release (su richiesta dell'utente).

## Risolto (2026-10-17, pomeriggio)
- Sonde temporanee nel motore (motivo di ogni attesa > 30 ms tra due frame) e nel worker audio. Esito su 122 s:
  Present sull'8.8" ~5 ms, render ~7,5 ms, worker audio regolare. I Present lenti (120–260 ms al secondo) erano
  tutti dello schermo 1. I 147 buchi da 60–120 ms avevano tutti la stessa causa: un ridisegno non dovuto allo spettro
  (timer, preparazione della lettura sensori, 100–200 ms prima del Sample) dentro la finestra di 40 ms usava le barre
  vecchie, produceva un frame identico (non inviato) e faceva ripartire la finestra: il risultato audio successivo
  slittava di un frame intero.
- Correzione in `bezel-runtime`: un frame identico non fa ripartire la finestra; un ridisegno che la finestra non può
  rimandare prende le barre più recenti. Seconda misura a regime: nessuna attesa oltre 80 ms, 5 da 61–69 ms in 30 s,
  mediana 44 ms. L'utente la vede "perfetta". Sonde tolte.
- L'interpolazione delle barre (punto 2) non serve per ora.
