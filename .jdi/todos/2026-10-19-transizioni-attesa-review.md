# Riesame transizioni profili e schermata di attesa

## Richiesta e chiarimento

Riverificare le transizioni tra profili, renderle più raffinate anche con
coperture moderne che non ruotino l'intera scena. L'utente ha chiarito che
«precaricamento» indica una schermata di attesa personalizzata, non la scelta
dei temi da tenere anticipatamente in RAM.

## Risultati verificati sulla .55

- 10 test filtrati profili del runtime verdi: cambio su due display diversi,
  ritorno a Default, tutela del documento non salvato, pausa editing e timing.
- 6 test cards del renderer verdi, inclusa composizione interi fotogrammi:
  Fade/Slide/Flip nelle quattro direzioni, inizio/fine e fotogramma intermedio.
- 4 e2e mirati del pannello Profili verdi, italiano/inglese e chiaro/scuro.
- Nessun cambio dei profili o dei temi personali, nessun invio di scene di
  prova ai dispositivi. Questi controlli non sono una verifica visiva hardware.

## Limiti attuali da affrontare

- Flip trasforma l'intera immagine: comportamento previsto, ma poco adatto al
  cambio di un'intera dashboard. Mancano effetti di copertura a scena ferma.
- Service::tick carica i file del nuovo profilo sincronicamente nel giro del
  motore. Animation.started usa il tempo all'inizio del giro, prima del
  caricamento e del primo render: un caricamento oneroso può accorciare la parte
  visibile dell'animazione e trattenere gli altri display. I test attuali usano
  file piccoli; non misurano questo ritardo con contenuti pesanti.
- Le scene condividono il tempo, ma i display mantengono la propria cadenza:
  non è sincronizzazione ottica. Un dispositivo lento salta fotogrammi.
- Il display in modifica sospende i profili; per una prova reale delle regole
  occorre nascondere Studio. Manca una prova esplicita della transizione nel
  pannello, senza alterare profili o documenti.
- I video riprodotti direttamente dal dispositivo attualmente cambiano senza
  transizione, perché il relativo fotogramma non è compositabile sul PC.

## Proposta concreta, non ancora implementata

1. Transizioni profili: Copertura direzionale (pannello pieno), Rivelazione
   (maschera su scena ferma), Tendina come alternativa. Curve morbide e colore
   del pannello personalizzabile; conservare Fade/Slide/Flip esistenti.
2. Copertura in tre fasi: chiusura, attesa della prima immagine pronta, apertura.
   Il tempo di caricamento non consuma quello dell'animazione. Preparazione
   asincrona con memoria limitata, gestione errore e cambio rapido di profilo.
3. Schermo → Avvio e attesa, impostazione per display: ultimo fotogramma
   predefinito oppure colore/logo/immagine con testo facoltativo, adattamento
   alla tela e anteprima nei rapporti reali dei due schermi. Mostrare stati veri,
   evitare percentuali inventate e un'attesa minima artificiale.
4. La stessa grafica può accompagnare ingresso iniziale, riconnessione e cambio
   profilo lungo. Ripristinare la scena precedente se il nuovo tema fallisce;
   lo schermo scollegato non deve tenere gli altri in attesa indefinitamente.
5. Una copertura a bordo singolo può ridurre l'area variabile rispetto alla
   rotazione di tutta la scena; verificare trasferimenti e resa sui due device
   prima di promettere un miglioramento delle prestazioni.

## Confine firmware / Bezel

Bezel può disegnare l'attesa solo dopo che il collegamento risponde. Non può
sostituire in modo universale il logo del firmware durante il boot hardware.
Sul rev C 8,8 esiste già Schermo → Archivio → All'avvio: la modalità immagine
mostra l'album sd/image, quella video il primo file di sd/video, non un file
arbitrario garantito. Il 3,5 rev A non ha questa memoria autonoma. Le possibilità
all'avvio vanno esposte per capacità del singolo display, senza assimilare
l'attesa gestita dal PC alle impostazioni persistenti del firmware.

## Stato

Solo analisi e verifiche: prodotto corrente .55 invariato, installata .45.
Nessuna nuova build, setup o pubblicazione. Implementazione e prova visiva
multimonitor restano aperte. Fase 20 e H264 fisico non sono stati verificati.
