# Phase 17: Seamless handoff — Context  (slug: seamless-handoff)

## Goal
Passaggio Studio → Light senza ridisegno visibile del tema: Studio consegna a Light l'ultimo fotogramma
inviato (per schermo), così il primo invio di Light è solo la differenza; passaggio più rapido; nessun
reset dello schermo.

## Problema (segnalazione dell'utente)
Quando Studio si chiude e Light prende lo schermo, tutto il tema viene ridisegnato in modo visibile
(nessun lampo nero, nessun logo del produttore).

## Analisi
- Alla chiusura verso Light (Windows, `close_window` → `prepare_light_on_close` → `window.destroy()`),
  Studio NON chiama `release()`: il processo termina e la porta si chiude. END_UPDATE_BITMAP (0x87)
  parte solo dal pulsante esplicito "Restituisci".
- Light si connette con `last: None` (HELLO → STOP_VIDEO → STOP_MEDIA → PRE_UPDATE_BITMAP): senza
  riferimento il primo `present()` è un fotogramma intero (3,7 MB sull'8.8"), che il pannello ridisegna.
- Spec rev C § 19: dopo che l'host chiude la porta l'ultimo fotogramma resta congelato, anche attraverso
  una nuova connessione con HELLO ("Video after the host"). Se il dispositivo ha perso il suo stato, lo
  dice con `needReSend:1` a QUERY_STATUS.

## Decisioni locked (di questa phase, prese dall'orchestratore)
- H-1: Studio, quando consegna lo schermo a Light, salva per ogni schermo vivo l'ultimo fotogramma
  confermato (RGBA nell'orientamento del tema), con chiave = indirizzo display + modello + firmware +
  orientamento + dimensione, in un file per utente accanto ai lock di handoff (`bezel-power::handoff`),
  scritto in modo atomico (tmp + fsync + rename). Il link viene tolto dal loop di refresh PRIMA di
  leggere il fotogramma, e non viene inviato nulla dopo.
- H-2: Light lo legge una volta (il file viene rimosso alla lettura) e lo usa come baseline del driver
  solo se identità, firmware, orientamento, dimensione corrispondono e l'età è ≤ 20 s; altrimenti
  fotogramma intero come oggi.
- H-3: porta in `bezel-core`: `ScreenLink::baseline()` / `ScreenLink::seed_baseline()` (no-op di
  default) + porta `HandoffStore`; use case `app::handoff`. Implementata per Turing rev C, l'unico
  driver con una verifica lato dispositivo (QUERY_STATUS).
- H-4: rete di sicurezza rev C: il primo `present()` dopo il seed invia SEMPRE un parziale (la differenza,
  o il keepalive di un pixel se identico) seguito da QUERY_STATUS; con `needReSend:1` il fotogramma
  intero parte subito nello stesso `present()`. Un invio fallito non lascia mai una baseline.
- H-5: nessun byte di protocollo nuovo; solo sequenze già documentate e usate.
- H-6: non toccare il Media Player (theme model, bezel-render, DTO bezel-themes, inspector).
