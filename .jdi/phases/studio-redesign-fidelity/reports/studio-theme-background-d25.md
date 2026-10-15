# Inspector Tema: sfondo unico e chooser (D-25)

Lavoro eseguito soltanto in `F:\dev\bezel-fid-bg`, branch `fid/bg`, con il modello puro `7ceb3bb` e il completamento UI `31a6e4d` (sostituisce il WIP locale `4c1effb`). Nessuna modifica a PLAN.md, SUMMARY.md, Card, controllo dei raggi, Rust o formato del tema. Nessun eseguibile sostituito.

## Comportamento completato

- Una scheda dello sfondo in uso: anteprima disponibile dal bridge, tipo, nome, spiegazione e stato con punto. Sotto, soltanto le opzioni del tipo attivo.
- Chooser dentro l'inspector: tre fonti espandibili, una aperta; indicazione della fonte in uso; radio nativi; confronto tra vecchio e nuovo; conferma contestuale. Le liste lunghe scorrono mantenendo visibili sorgenti, Indietro, invio e conferma.
- I file del computer restano bozze fino alla conferma: Annulla/Indietro/Esc non importano media, non modificano lo sfondo e non aggiungono Undo. La conferma importa il file e modifica lo sfondo con un solo comando `setTheme`; GIF e poster vengono riconosciuti dall'importatore esistente.
- Ripristino del video mancante solo con copia locale: si riutilizzano i dialoghi dell'Archivio, preselezionando soltanto quel file. Dopo il ripristino la scheda riutilizza la nuova risposta del bridge dell'Archivio.
- Fonte video disabilitata con motivo senza schermo o senza `playsVideos()`. Uno scollegamento durante la scelta invalida la conferma; risposte obsolete delle liste e del file picker vengono scartate. Un elenco parziale non prova che un file sia mancante.
- Video dello schermo: loop, diagramma, colore fuori dalle finestre quando presenti, conteggio effettivo delle shape `videoWindow`, selezione e collegamento all'Archivio.
- Orientamento con due pulsanti `aria-pressed`, mantenendo la rotazione di 180 gradi; aggiornamento rapido 0.5/1/2/5 s, con il valore salvato aggiuntivo quando diverso.

## Riuso D-14

`propertySection`, `segmented`, `chipButton`, `colorField`, `switchRow`, `listCard`, `panelHead`, `pill`, `count`, `iconButton`, `icon`, `svgEl`, badge e status-dot esistenti. Stato video e scelte derivano da `editor/background.js`; ripristino e invio usano l'Archivio e i suoi dialoghi. Selettori e helper e2e comuni sono in `tests/e2e/helpers.mjs`. Testi nuovi soltanto nell'area inspector, con parità en/pt-BR/it; le chiavi legacy non più usate sono rimosse. Nessun nuovo colore o controllo dei raggi.

## Verifiche

| Verifica | Esito |
| --- | --- |
| `npm run test:unit` | 491/491; linee 99,45%; `editor/background.js` e `inspector-tabs.js` 100% |
| `node scripts/e2e-slot.mjs background-chooser background-kind video-background device-video scenarios-shell --output=coverage/bg-last-tests` | 108/108 nei quattro progetti |
| Disconnessione/riconnessione in serie (`--workers=1 --repeat-each=3 --grep disconnecting --output=coverage/bg-serial`) | 12/12 |
| `node scripts/e2e-slot.mjs --full --output=coverage/bg-final-commit` | unit 491/491 + e2e 655/656 in 12,7 min; exit 1 per il solo errore Chromium descritto sotto |
| Orientamento in serie (`--workers=1 --repeat-each=3 --grep "switch between vertical and horizontal" --output=coverage/bg-orientation-serial`) | 12/12; verifica dell'errore di risorse Chromium rilevato nella suite completa |
| `node scripts/fidelity/shoot.mjs --area inspector` | completato in it, dark e light; 56 voci nel manifest, con dettaglio inspector per ogni stato app |
| `git diff --check` | pulito |

La suite completa ha un solo fallimento: `scenarios-shell`, light-en, “switch between vertical and horizontal”. Tutte le asserzioni funzionali e axe sono passate; il controllo finale della console ha rilevato `Failed to load resource: net::ERR_NO_BUFFER_SPACE`. La prova invariata, rieseguita con un solo worker e tre ripetizioni per ciascuno dei quattro progetti, è passata 12/12. L'errore non è stato ignorato o filtrato; la suite completa non viene dichiarata interamente verde. Traccia originale: `apps/bezel-studio/coverage/bg-final-commit/scenarios-shell-switch-between-vertical-and-horizontal-light-en/trace.zip`.

Le asserzioni aggiornate seguono la nuova sequenza senza rimuovere le verifiche: il toast di importazione, per esempio, viene verificato dopo la conferma, mentre prima della conferma deve essere assente. I controlli axe in chiaro/scuro e i guard di traduzioni, token e CSS sono inclusi nelle suite.

Un tentativo di ripetizione parallela nella stessa worktree ha perso un file trace perché un altro runner ne stava pulendo la cartella. La ripetizione finale, con output separato, è passata 12/12. La suite completa è stata eseguita sul commit definitivo, dopo l'aggiornamento dell'asserzione FFmpeg alla conferma; il risultato riportato riguarda questa revisione.

`--full` è una nuova opzione di `scripts/e2e-slot.mjs`: esegue il vero `npm test` nel consueto slot, con porta propria e due worker. Le ripetizioni parallele nella stessa worktree hanno directory di output distinte per non cancellarsi gli artefatti.

## Confronto con i mockup

`shoot.mjs --area inspector` ora include anche BgCurrent/BgChooser/BgStates, nella loro directory di progetto, oltre agli artboard precedenti. Catture locali in `.jdi/phases/studio-redesign-fidelity/gap/{dark,light}/{mock,app/inspector}`; gli artefatti non sono versionati.

Differenze residue deliberate:

- Nomi, numero di file, durate, dimensioni e conteggio delle finestre arrivano dal bridge demo: non sono earth.mp4/nebulosa.mp4 o i tre file inventati dei mockup. La lista reale del fixture ha 18 video e scorre.
- Quando il bridge non fornisce miniatura/poster compare l'icona esistente. Il fixture `addImage` del demo e i video vendor senza copia locale non forniscono miniature; non ne sono state fabbricate.
- Il collegamento Schermo > Archivio rimane un pulsante testuale esplicito sotto le opzioni, invece della sola icona accanto a Cambia sfondo. Colore/opacità e Adattamento mantengono le etichette dei controlli condivisi. In BgStates questi controlli sono dentro le schede; nell'app sono sotto la scheda, secondo il goal esplicito. Spaziature e altezze seguono le primitive comuni, quindi il risultato non è una copia pixel per pixel.
- Si usa la palette a token del prodotto: Dal computer usa l'accento comune, anziché il viola/giallo dedicato dei mockup. I mockup forniti hanno colori scuri statici; il tema chiaro applica la stessa struttura con i token light e contrasto verificato da axe.
- La descrizione video mantiene il comportamento reale: dove non esiste una copertina l'editor mostra un segnaposto. Nessun movimento o metadato simulato viene aggiunto alla UI per imitare un'immagine di riferimento.

## File modificati rispetto alla base prima dei due commit

- `apps/bezel-studio/scripts/e2e-slot.mjs`
- `apps/bezel-studio/scripts/fidelity/recipes/inspector.mjs`
- `apps/bezel-studio/scripts/fidelity/shoot.mjs`
- `apps/bezel-studio/src/app.js`
- `apps/bezel-studio/src/demo-data.js`
- `apps/bezel-studio/src/editor/background.js`
- `apps/bezel-studio/src/i18n/areas/inspector.js`
- `apps/bezel-studio/src/i18n/en.js`
- `apps/bezel-studio/src/i18n/it.js`
- `apps/bezel-studio/src/i18n/pt-BR.js`
- `apps/bezel-studio/src/inspector-tabs.js`
- `apps/bezel-studio/src/styles/base.css`
- `apps/bezel-studio/src/styles/inspector.css`
- `apps/bezel-studio/src/ui/inspector-background.js`
- `apps/bezel-studio/src/ui/inspector.js`
- `apps/bezel-studio/src/ui/manager.js`
- `apps/bezel-studio/src/ui/storage.js`
- `apps/bezel-studio/tests/e2e/background-chooser.spec.mjs`
- `apps/bezel-studio/tests/e2e/background-kind.spec.mjs`
- `apps/bezel-studio/tests/e2e/device-video.spec.mjs`
- `apps/bezel-studio/tests/e2e/helpers.mjs`
- `apps/bezel-studio/tests/e2e/scenarios-shell.spec.mjs`
- `apps/bezel-studio/tests/e2e/video-background.spec.mjs`
- `apps/bezel-studio/tests/ui/background-model.test.mjs`
- `apps/bezel-studio/tests/ui/inspector-tabs.test.mjs`

- `reports/studio-theme-background-d25.md` (questo rapporto)
