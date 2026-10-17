# Spettro audio e sfumatura lineare — richieste dell'utente (2026-10-18)

## 1. Sorgente dello spettro: il Player oppure l'audio del PC
L'utente vuole scegliere, per ogni spettro, se ascoltare l'app seguita dal Player (com'è oggi) oppure
**tutto l'audio che si sente sul PC**.
- Supera D-AS-2/D-AS-3 ("nessun ripiego sull'audio dell'intero PC"): serve una nuova decisione esplicita
  (D-AS-12). L'audio del PC diventa una sorgente scelta dall'utente, non un ripiego automatico.
- Tecnica probabile: loopback WASAPI del dispositivo di uscita predefinito (non per processo), disponibile anche
  prima di Windows 11 build 20348. Da chiarire: dispositivo predefinito che cambia (cuffie/casse), privacy
  (testo nelle Preferenze), Player non più obbligatorio per quella sorgente.

## 2. Moltiplicatore dell'ampiezza
Con Spotify le barre non scendono mai a zero e restano alte: serve un **moltiplicatore/guadagno** configurabile
nell'inspector (es. 0,25×–4×), per scalare l'altezza delle barre.
- Da decidere: moltiplicatore lineare sui livelli oppure spostamento della soglia in dB (oggi la scala è
  −72..0 dB); valore di default 1×; vale anche per la demo.

## 3. Sfumatura lineare: punto centrale configurabile
La trasparenza lineare (`Fade` in `crates/bezel-core/src/domain/gradient.rs`, `shape-fade.js` nello Studio)
oggi va dall'inizio alla fine in modo uniforme lungo la direzione; la radiale ha già un centro.
Serve un **punto centrale** configurabile per la lineare: la posizione (0–100%) lungo la direzione in cui
l'opacità è a metà tra inizio e fine, come il punto medio di un gradiente.
- Campo nuovo nel modello e nel DTO scritto solo se diverso dal default (50%), per restare apribile dalle
  versioni precedenti (come D-AS-11). Render Rust, render JS demo, inspector, i18n en/pt-BR/it.
