# Razionalizzazione dell'inspector — 2026-10-18

Richiesta: mantenere l'aspetto dello Studio, migliorando leggibilità, dimensioni
dei campi, simboli esplicativi, raggruppamento e riuso dei controlli degli angoli.

## Intervento

- Numeri brevi: etichetta a sinistra e ingresso largo 112 px a destra. Testi,
  percorsi e selezioni restano estesi. Rotazione conserva decimali, normalizzazione,
  focus e Undo; le misure geometriche mostrano le unità.
- Icone condivise nel catalogo per rotazione, larghezza/altezza, dimensione testo,
  spaziatura, spessore, frequenza, ampiezza e conteggio. Restano sempre le etichette;
  icone e unità sono decorative per non duplicare i nomi accessibili.
- Colore in base al valore nello stesso gruppo del colore controllato; le
  sfumature mantengono vicini tutti i propri colori prima delle soglie.
- Gruppi con divisori: colore, traccia, segmenti, bordo, trasparenza, angoli.
  L'opacità sta con la trasparenza, o nel proprio gruppo Visibilità.
- Angoli: riutilizzato il controllo esistente `cornerRadii` in forme, barre,
  spettro e copertine, senza inventare raggi individuali dove il formato non li
  supporta. Raggio condiviso compatto, disegno e quattro angoli conservati.
- Immagini: adattamento, colore, ombra e trasparenza separati.
- Popover: il contenuto può crescere dopo l'apertura (palette); un ResizeObserver
  lo mantiene nella finestra, anche se il pulsante originale viene ridisegnato.
- Nuove etichette in en, pt-BR e it con parità delle chiavi.

## Verifica e consegna

78 test unitari UI mirati e 144 casi e2e distinti delle aree interessate verdi,
con accessibilità, tastiera, Undo, tema chiaro/scuro e lingue en/pt-BR. Parità
delle chiavi anche in italiano. I fallimenti iniziali sono stati corretti e
rieseguiti sulle sole specifiche interessate. Niente suite completa o pubblicazione.
Pacchetto locale: 0.1.35. Installazione personale conservata.
Anteprima: `dist/Bezel-Evo-0.1.35-inspector.png`.

## Passo successivo

Prova dell'utente sui pannelli reali: confermare densità, leggibilità e ordine
prima di estendere la razionalizzazione alla nuova pagina iniziale.
