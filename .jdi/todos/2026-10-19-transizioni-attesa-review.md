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

## Precisazione da Libre Panel, richiesta dall'utente

Verificato il main pubblico il 19 ottobre 2026, leggendo codice e documentazione:

- [Start screen](https://github.com/syntensa/libre-panel/blob/main/docs/CONFIGURATION.md#the-panels-start-screen)
  offre realmente logo e clip residenti nel dispositivo, visibili prima dell'app.
- [panel_files.py](https://github.com/syntensa/libre-panel/blob/main/src/libre_panel/devices/panel_files.py)
  scrive `usr/data/boot.jpg` e `usr/data/standby.h264`, con limite 1 MiB e verifica
  dimensione. Comandi 40/98 per scrittura/controllo, 110/125 per clip e avvio;
  42 rimuove l'override del logo e lascia riapparire quello di fabbrica.
- Il codice abilita questa funzione ai modelli `usb-turing`, cioè TURZX USB
  V1.x (VID 1CBE). Il progetto documenta prova reale sul 9,2; gli altri USB
  condividono il firmware, ma non sono tutti provati.
- La nuova enumerazione Bezel conferma il display dell'utente come rev C
  seriale: COM6 0525:a4a7 e MCU COM4 1a86:ca88 CT88INCH. Non è il modello
  8,8 USB V1.x a cui si riferisce quella funzione. Sul rev C Bezel offre già
  media autonomi all'avvio con le modalità album/primo video documentate;
  la sostituzione di uno specifico logo richiede riscontro sul suo protocollo.
- La precedente risposta era incompleta: il firmware può caricare un file
  personalizzato residente dove il modello lo supporta. La funzione può essere
  aggiunta a Bezel per capacità del modello, distinta dall'attesa disegnata dal PC.
- Nessun programma esterno eseguito e nessuna scrittura al dispositivo. La CLI
  `devices` fa solo enumerazione. Nessuna nuova compilazione.

Approfondimento specifico del display seriale: [avvio 8,8 Rev C](2026-10-19-avvio-88-revc.md). Attesa autonoma album/video confermata nelle prove esistenti; logo firmware ancora non confermato.
