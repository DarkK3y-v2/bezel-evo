# Audio spectrum ? riepilogo

## Risultato e ambito

Implementazione nel solo worktree `F:\dev\bezel-spectrum`, branch `fid/audio-spectrum`. Piano scritto e committato prima del codice. VERSION, CHANGELOG.md, scripts/windows/ e packaging/ invariati; nessuna installazione o copia di eseguibili, nessuna scrittura ai dispositivi fisici.

D-AS-1..9 mantenute. Widget autonomo Spettro audio, con collegamento esplicito a un Player per ElementId oppure automatico solo quando nel tema esiste un unico Player. La selezione della sessione usa playback::session, la stessa funzione del Player: nessun filtro parallelo e nessun ripiego sull'audio di tutto il PC.

## Architettura e sicurezza

- Core: Spectrum, Motion, AudioState, SpectrumFrame e porte AudioCaptureFactory/AudioCapture senza API Windows. Snapshot audio indipendente dal campionamento dei sensori; risultati separati per identita interna della scena anche con nomi sovrapposti. Il nuovo contenuto JSON spectrum e opzionale, con default e limiti; schema 1 e vecchi temi invariati.
- Adattatore bezel-sensors: controllo RtlGetVersion (build >=20348), attivazione AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK con INCLUDE_TARGET_PROCESS_TREE, PCM16 stereo 48 kHz in RAM. AUTOCONVERTPCM demanda a Windows la conversione del mix, anche multicanale. La cattura per processo segue l'app attraverso gli endpoint audio; nessuna selezione globale dell'uscita.
- Associazione AUMID: nomi eseguibili classici esatti senza estensione, AUMID Store esatto interrogato sui processi, risalita ai processi radice per escludere i figli duplicati. Piu radici possibili vengono rifiutate. Il processo aperto viene verificato nuovamente prima dell'attivazione; uscita/riavvio rilasciano la cattura e attivano un tentativo successivo. Browser: si include il processo e i figli, quindi altre schede dello stesso browser possono contribuire; avviso localizzato nell'inspector.
- Light: worker dedicato, una cattura/FFT per identificativo sorgente, condivisa fra scene e widget; envelope distinti per widget. Otto sorgenti e 256 consumatori al massimo; richieste, pacchetti e buffer limitati. Ultimo risultato, nessuna coda di immagini.
- Nessun microfono, file audio, campione o dato audio nei log/IPC. Il callback COM mantiene i parametri di attivazione anche dopo un timeout. Nessun nuovo percorso di scrittura seriale: si usa il presenter esistente.
- Consenso audioCapture locale in settings.json, disattivato per default nei vecchi settings, comando Tauri con permesso esplicito, switch nelle Preferenze con informativa. Il tema non puo concederlo. Opzioni non valide non modificano il consenso.
- Il factory reale e iniettato solo in Light. Nel recupero del motore dentro Studio, gia previsto da D-31, lo spettro dal vivo resta sorgente non disponibile; non si avvia cattura audio dentro Studio. La demo sintetica resta disponibile.

Riferimenti API primari: [campione Microsoft](https://learn.microsoft.com/en-us/samples/microsoft/windows-classic-samples/applicationloopbackaudio-sample/), [parametri process loopback](https://learn.microsoft.com/en-us/windows/win32/api/audioclientactivationparams/ns-audioclientactivationparams-audioclient_process_loopback_params). Il campione e stato consultato per attivazione/formato; non sono stati introdotti i suoi percorsi di registrazione WAV o salvataggio.

## Analisi, disegno e ciclo di vita

FFT radix-2 4096, finestra Hann precalcolata, potenze dei canali combinate senza cancellazione di fase. Default 32 bande logaritmiche 60?16000 Hz; intervalli configurabili 8?64 bande, 20?24000 Hz. Scala interna normalizzata -72..0 dB, presentata alle soglie condivise come 0..100.

Preset Morbido / Bilanciato / Scattante; attacco e caduta indipendenti dal frame rate, hold 350 ms e successivo decadimento dei picchi. Default Bilanciato, picchi attivi. Sotto 1/512 le barre e i picchi arrivano a zero esatto. Nessuna nuova pubblicazione quando il risultato non cambia; in pausa, dopo il decadimento, il worker attende un cambio di richiesta senza polling periodico. Silenzio con sessione ancora Playing: pacchetti vuoti/zero eliminano l'energia senza FFT inutile.

Barre specchiate, linea centrale opzionale, picchi, spessore/spazio, Paint solidi/gradienti, soglie ColorByValue per ogni banda e cornerRadii condiviso nell'inspector. Disegno confinato al layer del widget. Etichette distinte per cattura disabilitata, Player mancante, sorgente non disponibile, sistema non supportato e Demo; il silenzio mantiene il widget con barre a zero.

Aggiornamenti audio non piu frequenti di 50 ms. Se il presenter fisico e occupato si rimanda il rendering audio e si prende poi il risultato piu recente: degrado per dispositivo senza accodare frame vecchi. Dopo zero non si ripresentano frame identici; si garantisce comunque il primo invio dopo apertura/riapertura della connessione. Altri widget animati possono continuare a generare frame. Gli adattatori esistenti scelgono partial/dirty rectangles e possono richiedere un full per ripristinare la baseline.

Catture rilasciate su pausa del Player, revoca del consenso, consumatori rimossi, schermi non attivi senza anteprima recente, sospensione o distruzione del worker. Le richieste canvas registrano un consumatore per due secondi. Dopo risveglio/errore si riapre la sorgente; nessuna coda di audio da recuperare.

## Studio

Palette e gruppi Widgets aggiornati. Dati: Segui il Player, numero bande, frequenza minima/massima, Dal vivo / Demo esplicita. Aspetto: colore/gradiente, soglie esistenti con scala documentata, spessore, spazio, linea, picchi, movimento e angoli. Controlli nativi, primitive e token esistenti; en/pt-BR/it con chiavi canoniche riusate. Undo/Redo e formato JSON continuano a usare i comandi del documento esistenti. Lo spettro non propone Fit del contenuto testuale.

## Verifiche automatiche

- Test mirati cargo test -p sui sette crate modificati (bezel-core, bezel-themes, bezel-render, bezel-runtime, bezel-sensors, bezel CLI, bezel-studio): passati. Modifiche successive rientestate nei pacchetti interessati.
- Clippy mirato --all-targets --locked -- -D warnings sugli stessi sette crate: passato.
- JS mirato: 147 test passati (spectrum, bridge, demo-backend, library-model, value-color, fit-content, editor-store, i18n).
- Nuovo e2e audio-spectrum tramite slot: 8 passati, quattro combinazioni chiaro/scuro e en/pt-BR, con axe; copre collegamento automatico/esplicito, Player mancante, demo animata e riconoscibile, bande, preset, Undo, gradienti, soglie e consenso locale.
- E2E delle aree esistenti Library/Player/Preferences: 94 passati e due errori negli artefatti Playwright dovuti a due esecuzioni contemporanee nello stesso worktree. I due casi isolati, rieseguiti sequenzialmente senza modifiche, sono passati. Le suite complete sono state avviate soltanto dopo la fine delle esecuzioni mirate.
- Suite completa Rust, una sola volta: 1211 passati, 15 ignorati, zero fallimenti.
- Dopo la suite completa: corretto l'isolamento fra scene a e a/b con identita interne e sincronizzato il cambio sorgente con lo stesso refresh/snapshot del Player, anche in presenza di punti indipendenti dei grafici. Nuove regressioni; tutti i test bezel-core e i 30 test bezel-runtime, piu Clippy di entrambi, passati. Nessuna seconda suite completa.
- Clippy completo, una sola volta: passato con --workspace --all-targets --locked -- -D warnings.
- Suite completa npm tramite slot, una sola volta: 541 unitari passati; e2e 707 passati e un errore Chromium ERR_NO_BUFFER_SPACE durante page.goto, prima delle azioni del test editing-017 / corner controls (light-en). Il solo caso, rieseguito tramite slot senza modifiche, e passato (2,7 secondi). Nessuna seconda suite completa. Copertura JS: righe 99,46%, rami 96,46%, funzioni 96,50%.
- cargo fmt --check, git diff --check, verifica dei trailer e dei file riservati: passati.

Test significativi: sinusoide nelle bande log previste, canali in opposizione di fase, decadimento esatto/stabilita a zero per tutti i preset, associazione classico/Store/browser/ambiguita/riavvio con processi finti, limite Windows, JSON/default/rifiuto intervalli errati, cattura unica e rilascio con factory finto, errore Unsupported senza fallback, pixel specchiati/soglie/confinamento, nessun invio identico sui tick dei sensori, primo frame garantito dopo connessione, consenso assente nei vecchi settings e nessuna concessione tramite opzioni rifiutate, isolamento fra scene e cambio sorgente nello stesso refresh del Player.

## Prova manuale richiesta

Non e stata catturata musica reale durante i test automatici. Restano da misurare CPU e latenza sul PC e la resa su hardware.

1. Aggiornare/installare con il flusso dell'installer dopo l'integrazione del branch; qui non e stata cambiata VERSION. Abilitare la cattura nelle Preferenze. Aggiungere un Player Spotify e uno Spettro audio; con un Player il collegamento e automatico, con piu Player scegliere esplicitamente quello seguito. Selezionare Dal vivo, non Demo.
2. Avviare Spotify: verificare barre/picchi e frequenze crescenti sul Turing 8.8 pollici COM6 e sul 3.5 pollici COM3, insieme e separatamente. Riprodurre audio in un'altra app: non deve contribuire. Browser seguito: verificare il limite dichiarato sulle altre schede; piu istanze/radici ambigue devono risultare indisponibili.
3. Mettere in pausa: attendere decadimento di barre e picchi fino a zero. Con BEZEL_PERF_LOG=1 esaminare light.log: dopo zero nessun nuovo invio dovuto allo spettro. Per isolare la misura usare un tema senza orologi, grafici, Player con tempo in movimento o altri widget animati; questi possono legittimamente continuare a cambiare pixel. Riprendere e verificare riattivazione.
4. Controllare nei log le dimensioni/tipo dei trasferimenti parziali e le durate; su seriale lenta devono calare i frame visualizzati senza ritardo cumulativo. Un full resta possibile per la baseline iniziale o una risincronizzazione del dispositivo.
5. Misurare CPU di bezel.exe/Light e memoria prima, durante la musica, in pausa e con due schermi/widget sulla stessa sorgente. Annotare preset, numero di barre e dimensioni del widget; verificare che sensori e secondo schermo restino reattivi. Nessuna percentuale CPU e stata dichiarata senza questa misura.
6. Revocare consenso; cancellare il Player; provare associazione ambigua, uscita/riavvio di Spotify, cambio endpoint/cuffie Bluetooth, audio esclusivo/protetto, sospensione/risveglio PC e schermi spenti. Su build <20348 attendersi Non supportato, senza cattura globale di ripiego.

## Commit

- ab75815 ? piano italiano prima del codice.
- 9e8272f ? contratti core, modello limitato e JSON compatibile.
- d21e927 ? cattura per processo Windows e associazione verificata.
- 0c20bc0 ? renderer specchiato, soglie e test pixel.
- 3a0816d ? worker condiviso Light, consenso locale e scheduling.
- ec772d9 ? Studio, inspector, demo, i18n e test UI.
- 89b8209 ? isolamento per identita della scena, con regressione.
- a4a1643 ? cambio sorgente nel medesimo refresh del Player, con regressione.
- Il commit di questo report chiude la fase automatica; le misure hardware sopra restano manuali.

Tutti i commit usano scope audio-spectrum e trailer Co-Authored-By: ChatGPT <noreply@openai.com>. Nessun push eseguito.
