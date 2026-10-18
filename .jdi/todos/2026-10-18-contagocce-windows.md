# Contagocce Windows

L'utente segnala il color picker e precisa che non funziona il contagocce.
Il vecchio codice usava esclusivamente `window.EyeDropper` e ignorava tutti
gli errori. I sei scenari e2e precedenti erano verdi, ma il prelievo positivo
era simulato: non dimostravano l'avvio dello strumento in WebView2.

## Correzione

- Studio sceglie un comando IPC nativo dedicato `pick_screen_color`; il demo
  browser mantiene l'API del browser dove presente. Nessuna nuova finestra WebView.
- Adattatore Win32 isolato in `bezel-power::eyedropper`: finestra temporanea
  quasi trasparente sul desktop virtuale, cursore a croce, intercetta interamente
  il clic. Viene rimossa prima del prelievo del singolo pixel via GDI/DWM.
  Le coordinate globali supportano monitor anche a sinistra/sopra il primario.
- Esc, clic destro, perdita attivazione e timeout di un minuto annullano;
  nessuno screenshot scritto o trasferito, solo RGB. Una selezione per volta.
- Opacità conservata, risultato tardivo ignorato se il popover è stato chiuso,
  istruzioni ed errori visibili; parità i18n en/pt-BR/it.

## Verifiche

- 69 test UI mirati verdi (`bridge`, `pickers`, `color-math`, `i18n`).
- 32 e2e color picker verdi, inclusi provider nativo preferito a un'API browser
  fallibile, opacità, annullamento, errore e risultato dopo chiusura.
- Test bezel-power verdi: 24 unitari e 11 integrazione; conversione COLORREF
  BGR verificata incluso bianco distinto dal valore indisponibile.
- Studio: 222 test verdi, uno fragile nel confronto esatto f64 dei tempi di
  render dopo JSON fallito due volte per un ULP; rieseguito isolatamente verde.
  Nessuna modifica al test o al codice engine per questo problema preesistente.
  Prima esecuzione anche integrazioni e doctest verdi.
- Clippy all-targets -D warnings su bezel-power e bezel-studio verde.
- Log sotto `target/eyedropper-*`; git diff --check verde.

## Consegna

Changelog preparato per 0.1.43; VERSION ancora 0.1.42 finché non si esegue
lo script ufficiale. Compilazione release della libreria preparata senza
sostituire lo Studio aperto (PID 44036, target/release).
Occorre conferma utente di salvataggio/chiusura per compilare i due eseguibili
con `scripts/windows/build-evo.ps1 -Version 0.1.43` e avviare direttamente,
senza setup. Resta da provare interattivamente il prelievo sui due monitor.
