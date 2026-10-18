# Temi cinetici aggiuntivi e formattazione maiuscole/minuscole

## Richieste conservate

L'utente approva i sei temi moderni rifatti e chiede di lasciarli, aggiungendo
una serie più elaborata, anche animata. Esclude fotografie e scenografie
realistiche. Successivamente richiede maiuscolo, minuscolo, sola prima lettera
e iniziali di ogni parola per la formattazione dei testi; poi chiede di riprendere.

## Temi aggiuntivi

Sei originali nuovi, senza sostituire Pulse, Resonance e Clarity:

- Synapse / Kinetic: architettura di segnali menta/ciano, orbite e particelle,
  quadrante GPU segmentato, CPU/RAM/termiche, player e campo audio nella Wide.
- Prism / Kinetic: composizione tipografica crema/arancio/lilla, nodo geometrico
  in deformazione continua, dati e cronologie nella Wide; orologio con quadrante
  CPU inserito nel nodo nella Round.
- Morph / Sound: grafica magenta/ciano, scultura audio dal vivo a più strati,
  geometria generativa e metadati; versione Round con spettro radiale.

Ogni serie ha Wide 1920×480 e Round 480×480. Decorazione animata in GIF locali
trasparenti: 40 fotogrammi 384×384, ciclo effettivo di circa 4,8 secondi,
antialias e palette dedicata; memoria di decodifica contenuta. Widget nativi
per i valori effettivi. Lo scheduler GIF esistente salta fotogrammi senza
accodarsi. Il livello Motion si può nascondere per fermare la decorazione.

Generatore `scripts/create-kinetic-themes.py`; nessun dato demo nei temi.
Le proposte fotografiche inizialmente generate sono state scartate dopo il
chiarimento dell'utente; nessuna è stata copiata nel progetto o nelle librerie.

Rendering dei dodici temi e verifica delle timeline GIF: 40 fotogrammi,
ciclo ≥4 secondi, pixel diversi fra istanti, sorgenti valide e geometrie entro
canvas. Esportati 240 fotogrammi del renderer con audio/letture dimostrativi,
confezionati in GIF e galleria `dist/kinetic-theme-previews/index.html` tramite
`scripts/create-kinetic-previews.py`. Anteprime dei sei layout controllate.

Commit `5c100b5`. Tutti i file delle sei nuove cartelle copiati nelle risorse
di `target/release/themes`, confrontati con SHA256. I sei moderni preservati.

## Formattazione testo

- `TextCase` nel dominio con Originale, Maiuscolo, Minuscolo, Iniziale, Parole.
  Segmentazione Unicode delle parole; accenti, segni combinanti, apostrofi,
  trattini, punteggiatura e spazi preservati. La sola iniziale riguarda la prima
  lettera alfabetica dell'intero testo, il resto viene convertito in minuscolo.
- `TextStyle.casing` applicato al testo visualizzato nello shaper comune;
  sorgenti statiche e dinamiche restano intatte. Misura e disegno condividono
  esattamente la stessa trasformazione, anche per Adatta al contenuto.
- DTO opzionale retrocompatibile: default assente/normal, serializzazione omessa
  per Originale; valori ignoti rifiutati. Importatori mantengono il vecchio aspetto.
- Controllo comune in Aspetto → Carattere; anche testi dei player, valori e meteo.
  Vecchia proprietà degli orologi conservata per file esistenti; l'editor della
  data usa la nuova proprietà quando viene modificata, con preview coerente.
- Demo, campione del font picker e misura approssimata applicano gli stessi
  criteri. Modifiche annullabili, salvate nel tema; i18n en/pt-BR/it allineata.
- Commit `a6bccff` dominio/renderer/DTO, `188172c` UI, `4ac7c0a` guida.

## Verifica finale

- Test/integration/doctest dei quattro crate modificati verdi: 175 unitari core,
  83 renderer con un timing ignorato, 223 Studio, 71 themes, più integration.
  Clippy all-targets -D warnings dei medesimi crate verde.
- 67 unitari UI mirati verdi. 8 e2e testo verdi, compreso confronto pixel/misura
  rispetto al testo già trasformato e controllo sorgente invariata, più 4 e2e
  orologio verdi. Il primo nuovo e2e usava textarea anziché il campo effettivo:
  selettore corretto e rieseguita soltanto la specifica interessata.
- Regres­sioni Unicode, compatibilità del DTO, pixel e misura del renderer
  nativo; verificata anche la presenza di una cornice naturale non nulla.
- Log: `target/text-case-area-tests.log`, `target/text-case-clippy.log`,
  `target/text-case-ui-final.log`, `target/text-case-e2e-final.log`,
  `target/text-case-measure-final.log`, `target/kinetic-preview-tests.log`.
- Nessuna suite workspace o pubblicazione, nessun setup.

## Consegna da completare

Gli originali dei dodici temi sono già provabili con Temi → Aggiorna l'elenco
nello Studio .41 aperto; la formattazione nuova richiede l'eseguibile .42.
Ultimo PID Studio 32708 da target/release. Richiesta aggiornata di salvataggio e
chiusura inviata dopo le verifiche, senza terminare il processo. VERSION resta
.41 e il changelog .42 è pronto. Alla conferma: `build-evo.ps1 -Version 0.1.42`,
verifica versione/hash/percorso, avvio diretto, commit VERSION/CHANGELOG e stato.
