# Rotazione degli oggetti (2026-10-17)

> Aggiornamento 2026-10-19: implementata e integrata nella fase 20
> (`2e813e7`); vedere `../phases/object-rotation/SUMMARY.md`. Restano
> conferma visiva sul dispositivo e `/jdi-verify`. La richiesta e i punti da
> decidere qui sotto sono il testo storico, non attività ancora da implementare.

Richiesta dell'utente: nessun oggetto del tema può essere ruotato. Oggi `Element` non ha un campo di rotazione;
le "rotation" presenti nel codice sono l'orientamento dello schermo e i turni delle Card.

Da decidere con l'utente prima di scrivere codice (`/jdi-add-phase` + `/jdi-discuss`):
- quali oggetti: tutti, oppure esclusi alcuni (video di sfondo, Card e i loro membri, gruppi);
- solo angoli liberi o anche scatti (15°/90°); maniglia di rotazione nel canvas oltre al campo nell'inspector;
- il centro di rotazione (centro del riquadro) e cosa diventano selezione, allineamenti, aggancio e limiti dello schermo
  con un riquadro ruotato;
- il formato del tema: campo nuovo scritto solo se diverso da 0, per restare apribile nelle versioni precedenti
  (come D-AS-11).

Parti toccate: modello e DTO del tema, render (`bezel-render`: trasformazione per livello), canvas dello Studio
(selezione, maniglie, hit-test), inspector, anteprima demo, test e2e.
