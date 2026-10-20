# Anteprima contagocce e nuova prova software H264

## Richiesta

L'utente chiede un'anteprima durante il prelievo del colore e di testare H264.

## Contagocce

- Lente nativa 11x11 pixel, pixel centrale marcato, campione e HEX accanto al
  cursore. Anteprima posizionata nel monitor puntato, anche con origini negative
  e DPI diversi; non deve coprire il punto di selezione.
- Superficie congelata durante il prelievo: screenshot soltanto in memoria,
  eliminato alla chiusura. Evita contaminazione da anteprima, cursore e overlay.
  Colore scelto e anteprima provengono dallo stesso pixel della superficie.
- Clic conferma; Esc, clic destro, perdita attivazione e timeout annullano.
  API e opacità invariate. Nuovo codice nativo non aggiunge stringhe UI:
  l'unico testo nella lente è il valore HEX indipendente dalla lingua.
- Risorse GDI e contesto DPI del thread rilasciati/ripristinati a fine sessione.
  Pittura della lente in piccolo buffer separato per ridurre lo sfarfallio.
- Test `bezel-power`: 26 unitari e 11 integrazioni verdi; clippy all-targets
  con -D warnings verde. Pixel centrato, swatch e valore restituito coincidono;
  verificati bordi, coordinate negative, DPI e colore non disponibile.
- Anteprima sintetica del vero pittore GDI esportata da test e controllata:
  `target/eyedropper-preview.png`. Non contiene il desktop dell'utente.
- Nessun modulo UI JS modificato: non ripetute suite UI/e2e estranee.

## H264: cosa è stato provato

- Enumerazione hardware: COM3 Rev A, COM6 Rev C CT88 e COM4 MCU di risveglio.
  Nessun USB 1CBE compatibile con il percorso sperimentale collegato.
- Prova con renderer ed encoder FFmpeg reali, due sink simulati indipendenti:
  396 frame H264 in 8,0004 s, 49,50 frame/s host; render medio 5,74 ms,
  codifica/uscita 7,92 ms. Sink nativo con ritardo artificiale 65 ms:
  120 frame, 14,89 frame/s. Nessun fallback sul sink H264.
- Verificato MP4 di anteprima: H264, 1920x480, 396 frame, 50 fps dichiarati.
  Report e video in `dist/h264-test-0.1.46/`.
- Verdi test reali di decodifica singole immagini e fallback per singolo link;
  quattro test driver filtrati `stream`, inclusi tre del nuovo ingresso USB
  (attivazione esplicita, limite immagine, coda, timeout, ripristino).
- **Nessuna prova fisica H264 effettuata.** Non inviati comandi USB al CT88
  seriale. Riprodurre un video memorizzato nel CT88 non dimostra lo streaming
  della scena intera. Per quel test serve un dispositivo/firmware supportato.

## Consegna

Utente ha confermato salvataggio e chiusura Studio. Build diretta .46 completata
in 1m33s con `scripts/windows/build-evo.ps1 -Version 0.1.46`; CLI e metadati
Studio .46 verificati. Studio avviato da `target/release`, PID 1952 rispondente.
Nessun setup o push richiesto; la copia installata rimane .45.

- SHA256 Studio: `697B39176987B40C232FFEFF70977BD6B7B10B3C84F706F437A88C557DF27291`.
- SHA256 CLI: `D50BCE0DF780320E9BF0A4FB43997A9BCA72C1473FEC1FF5FFCB573E990EDB6E`.
- Commit implementazione: `787c352`.
- Resta prova interattiva utente del contagocce sui due monitor. La prova fisica
  dello stream H264 richiede un dispositivo USB 1CBE compatibile collegato.
