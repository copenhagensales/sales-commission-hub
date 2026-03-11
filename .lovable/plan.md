

# Teamleder-kontrakt: Ekstra felter og merge tags

## Overblik
Når der sendes en teamleder-kontrakt, skal der vises tre ekstra inputfelter som brugeren udfylder manuelt. Værdierne gøres tilgængelige som merge tags i skabelonen.

## Ændringer

### 1. Database: Tilføj "team_leader" til contract_type enum
Ny migration der tilføjer `'team_leader'` til `contract_type` enum, så skabeloner kan oprettes med denne type.

### 2. SendContractDialog.tsx — Ekstra felter
- Tilføj tre nye state-variable: `teamlederOpgave`, `teamlederDbProcent`, `teamlederMinimumslon`
- Vis felterne **kun** når `selectedContractType === "team_leader"`:
  - **Opgave** (tekst-input): Hvilken opgave/klient teamlederen er tilknyttet
  - **DB-procent** (tal-input): Procent af dækningsbidrag
  - **Minimumsløn** (tal-input): Aftalt minimumsløn i DKK
- Placer felterne mellem titel/noter og data-oversigten
- Tilføj `ContractType` til at inkludere `"team_leader"`

### 3. Merge tags
Tilføj disse til `replacements`-objektet i `mergeContent()`:
- `{{opgave}}` / `{{teamleder_opgave}}` → opgave-tekst
- `{{db_procent}}` / `{{teamleder_db_procent}}` → DB-procent
- `{{minimumsløn}}` / `{{teamleder_minimumslon}}` / `{{minimum_salary}}` → minimumsløn (formateret med DKK)

### 4. Data-oversigt
Tilføj en "Teamleder-vilkår" sektion i data-oversigten (den der viser hvad der flettes ind) — kun synlig ved team_leader type.

### Merge tag reference (til brug i skabeloner)
```text
{{opgave}}              → Den valgte opgave
{{db_procent}}          → f.eks. "15"
{{minimumsløn}}         → f.eks. "25.000 DKK"
```

