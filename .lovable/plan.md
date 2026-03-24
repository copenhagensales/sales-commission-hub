

# Tilføj manuel sælger-mapping i "Fejl i match"

## Overblik
I "Fejl i match"-tabellen skal brugeren kunne vælge en medarbejder fra eesy (employee_master_data) og koble den til det sælgernavn ("Employee Name" eller lignende felt) der står i upload-rækken. Dette gemmes i `cancellation_seller_mappings`-tabellen, som allerede bruges af upload-matchingen.

## Ændringer i `MatchErrorsSubTab.tsx`

### 1. Hent aktive medarbejdere
- Tilføj query til `employee_master_data` (id, first_name, last_name, is_active=true).

### 2. Tilføj "Tildel sælger"-kolonne
- For hver række: vis en `Select`-dropdown med alle aktive medarbejdere.
- Hvis sælger-feltet allerede har en eksisterende mapping i `cancellation_seller_mappings`, vis den som forudvalgt.

### 3. Gem mapping ved valg
- Når brugeren vælger en medarbejder fra dropdown: upsert i `cancellation_seller_mappings` med `excel_seller_name` = værdien fra sælger-feltet i rækken, `employee_id` = valgt medarbejder, `client_id` = clientId.
- Vis toast ved succes.
- Invalidér relevante queries (`cancellation-seller-mappings`, `match-errors`).

### 4. Vis eksisterende mappings
- Hent eksisterende `cancellation_seller_mappings` for clientId.
- Hvis sælgernavnet i en række allerede har en mapping, vis medarbejdernavnet og marker dropdown'en som forudvalgt.

## Fil
`src/components/cancellations/MatchErrorsSubTab.tsx`

