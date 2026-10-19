# Visualizzazioni native e consegna 0.1.59

## Richiesta e autorizzazione

L'utente chiede di implementare le visualizzazioni mostrate (pixel, blocchi,
quadrante moderno, grafici speculari) e prendere in carico da Claude test,
generazione setup e caricamento della release. Pubblicazione autorizzata in
questo turno; installazione automatica non richiesta.

## Implementazione

- Proprietà opzionale visualization sugli elementi, assente nei vecchi temi:
  matrice per barre, pixel/quadrante per anelli, barre arrotondate/speculare
  per grafici. Geometrie limitate e validate dal formato temi.
- Matrice fino a 64 colonne per 32 righe, celle complete, raggio/spazio e ordine
  dalla direzione della barra. Pixel arco fino a 120 tasselli, gradienti arco.
- Quadrante con arco interno, tacche esterne e cursore opzionale sul valore.
- Grafico speculare con due binding e storici indipendenti. Campionamento
  condiviso; letture assenti interrompono solo la propria serie. Scala automatica
  comune zero/picco, scala fissa per sorgente. Nessun riflesso di dati inventato.
- UI Aspetto → Visualizzazione; sorgente inferiore in Dati con selettore
  ricercabile condiviso. Controlli incompatibili omessi. Valore/didascalia restano
  oggetti testo separati e raggruppabili. Traduzioni en/pt-BR/it a parità chiavi.
- Stesso percorso nativo per Studio/Light/display; anteprima browser dimostrativa
  aggiornata. Rendering fisico multimonitor non provato in questo intervento.
- Guida docs/user/visualizations.md; manifest di riferimento modificabile in
  docs/examples/native-visualizations/theme.json e immagine reale del renderer
  docs/images/native-visualizations.png, riproducibile con esempio Rust dedicato.

## Verifiche mirate prima della suite finale

- Core 187 unitari più integrazioni/doctest; renderer 90 (uno ignorato), temi 74
  più integrazioni. Verdi: celle attive/mancanti, limiti grafici, due storici,
  roundtrip opzionale e rifiuto geometrie fuori limite.
- Modello UI e quattro prove e2e dedicate verdi in inglese/portoghese,
  chiaro/scuro: preset, campi contestuali, copia, Undo e accessibilità.
- Tavola PNG nativa ispezionata, font e forme leggibili.
- Gate finale avviato una sola volta prima della pubblicazione: fmt, clippy
  workspace, llvm-cov workspace con soglia 80%, npm test completo.
  Risultati finali e artefatti annotati di seguito.

## Esito della verifica finale

- cargo fmt --all -- --check e clippy workspace all-targets -D warnings verdi.
- llvm-cov workspace: 1.296 test passati, zero falliti, 19 ignorati previsti;
  copertura righe 89,79%, oltre la soglia 80%. Nessuna suite Rust rieseguita.
- npm test: 570 unitari UI verdi, copertura righe 99,04%. Prima esecuzione
  Playwright completa: 828 casi, 812 verdi e 16 falliti (quattro casi ripetuti
  su quattro progetti). Non rilanciata la suite intera.
- Individuate due aspettative obsolete (sezione movimento sensori e Riavvia per
  singola sonda), aggiornati i test. Trovato un bug reale: il focusout nativo
  durante il click chiudeva il selettore prima di applicare la sorgente. Il
  controllo relatedTarget conserva la riga fino al click, senza cambiare Escape
  o la selezione da tastiera. Nuova regressione mouse su quattro progetti.
- Rilanciati soltanto sei spec interessati: 60 casi passati e quattro della
  barra di stato con fixture priva di Libre. Corretta la fixture in libre=partial
  e rieseguito solo quel caso: quattro progetti verdi. Tutti i casi iniziali
  falliti risultano quindi risolti, più quattro nuove regressioni mouse.
- Configurazioni e2e: chiaro/scuro, inglese e portoghese; testi italiani a parità
  chiavi verificata dagli unitari. Non dichiarare una prova e2e italiana.
- Commit c8fedd6 (selettore), 338de13 (aspettative UI), 5ecefb9 (visualizzazioni).

Lo script ufficiale package-evo.ps1 -Version 0.1.59 è in esecuzione. La verifica
fisica della resa sui due schermi e l'installazione restano distinte dai test
automatici; nessun setup è stato avviato sul PC dell'utente.

## Stato operativo

Base iniziale pulita, VERSION 0.1.58; il lavoro precedente di Claude era già
committato, con changelog/README della .59. Nuove modifiche integrate nella
stessa .59. Ultima pubblicata su GitHub .31; origin/main e windows-improvements
risultavano entrambi antenati del checkout (156 commit indietro al preflight).
File di lavoro/verifiche in target/logs/visualizations, output temporanei
in target/scratch/visualizations. Nessuna modifica ai temi/documenti utente.
