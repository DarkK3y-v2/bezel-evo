# Fase audio-spectrum — Contesto

Decisioni prese dall'utente (discussione con ChatGPT, 2026-10-16). Nessun codice scritto in discussione.

## Obiettivo
Widget "Spettro audio": barre specchiate dello spettro dell'audio riprodotto dall'app mostrata dal Player, disegnate da Light (unico runtime, D-31) su canvas e schermi.

## Decisioni bloccate
- D-AS-1 Widget autonomo "Spettro audio" con campo "Segui il Player"; collegamento automatico se nel tema c'è un solo Player.
- D-AS-2 Sorgente: SOLO l'app della sessione mostrata dal Player seguito; lo spettro usa la stessa sessione risolta dal Player, senza replicarne la selezione.
- D-AS-3 Nessun ripiego sull'audio dell'intero PC: se l'associazione sessione → processo fallisce, "Sorgente non disponibile".
- D-AS-4 Aspetto: barre specchiate su una linea centrale orizzontale; frequenze crescenti da sinistra a destra; stesso spettro sopra e sotto (energie dei canali combinate).
- D-AS-5 Silenzio: widget visibile con barre a zero; finito il decadimento di barre e picchi non si chiedono altri aggiornamenti finché l'audio non riprende.
- D-AS-6 Inspector Dati: Player seguito, numero di barre, gamma di frequenze.
- D-AS-7 Inspector Aspetto: colori e gradienti, colore per livello con le soglie esistenti (D-19, per singola banda su scala interna coerente), spessore, spazio, angoli con il componente condiviso (cornerRadii), linea centrale, cappucci di picco, movimento.
- D-AS-8 Movimento: preset Morbido / Bilanciato / Scattante + "Tieni il picco"; default Bilanciato con picchi attivi.
- D-AS-9 Requisito di sistema: cattura in loopback per processo (build 20348+, in pratica Windows 11); su versioni precedenti il widget mostra "Non supportato su questa versione di Windows".
- D-AS-10 (2026-10-17, decisione dell'utente, sostituisce il "consenso locale" spento di default): la cattura audio è ATTIVA di default, perché ascolta solo l'app seguita dal Player, in RAM. Resta un interruttore in Preferenze per spegnerla (utile con i browser, dove contribuiscono anche le altre schede); solo un `false` esplicito nelle impostazioni locali la spegne, il tema non può mai accenderla.
- D-AS-11 (2026-10-17, decisione dell'utente, prima del rilascio 0.1.30): oltre alle barre specchiate (D-AS-4, resta il default) lo spettro ha quattro modalità scelte in Aspetto → "Modalità": Barre dal basso, Blocchi LED (colore per livello calcolato sull'altezza di ogni blocco), Linea (curva morbida, spessore e riempimento sotto la curva) e Radiale (barre attorno a un anello interno, raggio in %; la banda più bassa in alto, poi in senso orario). L'inspector mostra solo i campi della modalità scelta. Nel file del tema i campi nuovi (`style`, `block`, `stroke`, `fill`, `inner`) si scrivono solo se diversi dal default, così uno spettro specchiato si apre anche nelle versioni precedenti. Supera il rinvio dello "spettro circolare".
- D-AS-12 (2026-10-18, richiesta dell'utente): moltiplicatore dell'ampiezza "Ampiezza (×)" nei Dati dello spettro, da 0,1× a 4×, default 1×: moltiplica l'altezza di barre e picchi (anche in demo), poi la limita a 1. Con Spotify le barre restano alte e non scendono mai a zero, così l'utente le abbassa. Nel file del tema il campo `gain` si scrive solo se diverso da 1.
- D-AS-13 (2026-10-18, decisione dell'utente, supera in parte D-AS-2/D-AS-3): ogni spettro sceglie cosa ascoltare: "App del Player" (default, come D-AS-2) oppure "Tutto il PC". Tutto il PC = loopback per processo in modalità ESCLUDI sul processo di Light stesso (che non suona nulla): tutto ciò che il PC suona sull'uscita in uso, che segue da sola il cambio di dispositivo; nessun Player richiesto. Resta vietato il ripiego automatico: "Sorgente non disponibile" per l'app del Player non passa mai a tutto il PC. Nessun microfono. Testi della privacy nelle Preferenze aggiornati. Nel tema `audio: "system"` si scrive solo se diverso da "player".

## Prima versione (contenuta)
- Cattura per processo, analisi e rendering solo in Light; Studio mostra le immagini di Light. Un'unica cattura/analisi condivisa per sorgente anche con più widget o schermi.
- Privacy: nessun microfono, nessun file o campione audio salvato o nei log; buffer solo in RAM; cattura attiva di default, spegnibile in Preferenze (D-AS-10).
- Valori iniziali da tarare: 32 bande logaritmiche, 60 Hz–16 kHz, FFT 4096 con finestra Hann.
- Massimo 20 fps verso lo schermo, degrado automatico per dispositivo, sempre l'ultimo risultato (nessuna coda di frame vecchi); aggiornamenti parziali solo dell'area dello spettro.
- Anteprima in Studio: Dal vivo / Demo (demo esplicita e riconoscibile).
- Trigger: si riusano quelli del Player; trigger sull'energia audio rimandati.
- Rimandati: stereo separato, spettro circolare, forma d'onda, bagliori/animazioni decorative.

## Da validare nella fase
- Associazione AUMID (sessione GSMTC) → processo: app classiche (nome eseguibile), app dello Store (pacchetto → processi), ambiguità, riavvio dell'app, cambio di sessione.
- Browser: dichiarare che altre schede possono contribuire (nessun isolamento della singola scheda).
- Stati distinti: silenzio, cattura disabilitata, Player mancante, sorgente non disponibile, non supportato.
- Fermare la cattura senza consumatori; gestire sospensione/risveglio e cambio del dispositivo audio.
- Misurare CPU, latenza percepita e costo delle aree aggiornate su 8.8" (COM6) e 3.5" (COM3); tarare smoothing, decadimento picchi, sensibilità e soglia del silenzio.

## Definition of Done
### Automatici
- Rust: analisi (bande log, finestra, decadimento, silenzio → nessun aggiornamento), associazione sessione → processo con enumeratore finto, stati d'errore, JSON del widget compatibile; `cargo test -p` e clippy sui crate toccati.
- UI: unit dei moduli puri, e2e dell'inspector (Dati/Aspetto, Segui il Player, preset) in chiaro e scuro con axe, demo riconoscibile.
- Suite completa una volta prima della pubblicazione (regola del progetto).
### Manuali (utente, sul Turing)
- Spotify (o altra app) in riproduzione: barre coerenti con la musica, nessun audio di altre app; pausa → barre a zero e poi nessun invio allo schermo (log BEZEL_PERF_LOG=1).
- CPU accettabile e nessun rallentamento dei sensori o dell'altro schermo.
