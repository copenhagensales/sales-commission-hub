Konklusion: Ja, det skal lukkes i databasen – ikke kun i UI. `cancellation_queue` er rød zone, fordi den påvirker løn/fradrag, så ændringen skal laves som en kontrolleret migration + lille upload-guard.

Plan:

1. Ryd eksisterende ASE-dubletter sikkert
   - Markér de 22 ekstra ASE-rækker som `rejected` i stedet for at slette dem.
   - Behold originalen pr. medlemsnummer/salg: den række der har mest komplet økonomidata (`deduction_date`, `Provision`, `CPO`) og ældst `created_at`.
   - De afviste dubletter får `reviewed_at = now()` og en audit-note i datafeltet, så vi kan se at de blev systemafvist pga. dublet-oprydning.
   - Resultat: 22 medlemsnumre forbliver med én godkendt annullering hver.

2. Stop nye dubletter i databasen
   - Tilføj en unik database-regel på aktive annulleringer:
     - samme `sale_id`
     - samme `upload_type`
     - samme `target_product_name` normaliseret
     - kun for status `pending`/`approved`
   - Det betyder: samme annullering kan ikke oprettes igen, selv hvis samme fil uploades igen.
   - `rejected` rækker tæller ikke som aktive, så historik og fejlafvisninger blokerer ikke fremtidige korrekte uploads.

3. Håndtér ASE-særligt match på medlemsnummer
   - Da ASE-dubletterne kan komme ind med andet produktnavn (`Salg`, `Lønsikring`, blank), tilføjes en ekstra guard for ASE: samme medlemsnummer + samme salg må ikke eksistere aktivt mere end én gang.
   - Det lægges i en database-trigger, fordi medlemsnummer ligger i `uploaded_data` JSON og skal normaliseres.
   - Ved dubletforsøg returneres en klar fejl i stedet for at oprette en ny kø-række.

4. Gør uploadflowet pænere for brugeren
   - I `UploadCancellationsTab` skiftes insert til konfliktsikker indsættelse/fejlhåndtering.
   - Hvis en upload indeholder dubletter, skal brugeren få en besked ala: “X dubletter blev sprunget over – de findes allerede i annulleringer.”
   - Ikke flere skjulte dobbelte rækker i “Godkendte”.

5. QA efter ændringen
   - Kontrollér at ASE går fra 44 godkendte dubletposter til 22 aktive godkendte poster.
   - Kontrollér at samme ASE-fil ikke kan oprette dubletter igen.
   - Kontrollér at Eesy/TDC produkt-niveau annulleringer stadig virker, hvor flere produkter på samme salg kan annulleres separat.

Teknisk note:
- Jeg vil ikke slette eksisterende rækker, fordi annulleringer påvirker løn og historik. `rejected` er den sikre oprydning.
- Ændringen kræver database-migration og berører `cancellation_queue`, som er rød zone. Når du godkender planen, implementerer jeg den.