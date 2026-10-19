# Grafica di attesa Bezel Evo

Richiesta: sfondo nero, logo, frase e animazione loading. Correzione esplicita
dell'utente: il marchio scritto deve essere **BEZEL EVO**.

Artefatti in `dist/bezel-start-screen/`, senza cambiare il prodotto .55:

- PNG orizzontale 1920×480 e nativo 480×1920.
- GIF di anteprima 960×240, 100 fotogrammi, 5 s, loop continuo.
- MP4 di anteprima orizzontale e nativo per l'8,8 orizzontale (rotazione 90°
  oraria, coerente con il convertitore Bezel). Video nativo circa 25 KB.
- Logo ricostruito dalle forme e dai colori dell'SVG originale Pixel, senza
  reinventare il marchio. BEZEL chiaro, EVO arancione, sfondo nero pieno.
- Frase «Il tuo mondo, a colpo d’occhio.»; stato «Prepariamo i tuoi schermi».
  Scia arancione in moto morbido sulla linea, senza percentuale fittizia.
- Generatore Python riproducibile e README nella cartella degli artefatti.

Verifiche: ispezione PNG e tre fasi del loop; primo/ultimo stato matematico
identici e stati intermedi differenti; GIF 100 frame/5000 ms/loop 0; ffprobe
H.264 Constrained Baseline, 480×1920, yuv420p, 30 fps, 5 s; decodifica completa
ffmpeg senza errori; angoli del PNG nero RGB 0. Nessuna modifica, upload, riavvio
o configurazione degli schermi. Nessuna nuova build o pubblicazione.
