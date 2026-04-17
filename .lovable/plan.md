
Brugeren vil have en separat Code of Conduct test til Fieldmarketing-teamet med spørgsmål målrettet deres arbejdssituation (gadesalg, fysisk kundekontakt) i stedet for telefonisk salg.

## Plan

### 1. Database
- Tilføj `quiz_variant` kolonne til `code_of_conduct_completions`, `code_of_conduct_reminders` og `code_of_conduct_attempts` (text, default `'salgskonsulent'`, værdier: `'salgskonsulent' | 'fieldmarketing'`)
- Opdater RPC `has_valid_code_of_conduct_completion` så den tager en valgfri `_variant` parameter og filtrerer på den
- Heal eksisterende rækker (alle markeres som `'salgskonsulent'`)

### 2. Spørgsmålssæt
- Opret nyt konstant-array `FIELDMARKETING_COC_QUESTIONS` i `useCodeOfConduct.ts` med FM-relevante spørgsmål:
  - Fysisk kundekontakt på gaden (samtykke, identifikation)
  - GDPR ved indsamling af data udenfor butik (papir, tablet, foto-ID)
  - Opbevaring og overdragelse af kundedata efter shift
  - Adfærd i offentlig rum (dresscode, alkohol, professionalisme)
  - Håndtering af afvisning og klager fra forbipasserende
  - Lokationsregler (tilladelse fra centerleder, ikke blokere indgange)
  - Børn/sårbare grupper
  - Kontant/betalingshåndtering hvis relevant
  - Dokumentation og rapportering tilbage til kontoret
- Behold eksisterende `CODE_OF_CONDUCT_QUESTIONS` som `SALGSKONSULENT_COC_QUESTIONS` (eller alias)

### 3. Variant-routing i hooks
- Udvid `useCodeOfConductCompletion`, `useCurrentAttempt`, `useSubmit`, `useLock` med `variant` parameter (auto-detekteres via `useIsFieldmarketingEmployee`)
- FM-medarbejdere → bruger `'fieldmarketing'`-variant overalt
- Alle andre → `'salgskonsulent'` (uændret)

### 4. UI
- `src/pages/CodeOfConduct.tsx`: 
  - Auto-vælg variant baseret på `useIsFieldmarketingEmployee`
  - Vis variant-titel ("Fieldmarketing" vs "Salgskonsulenter") og brug korrekt spørgsmålssæt
- `src/pages/CodeOfConductAdmin.tsx`:
  - Tilføj tabs/toggle: "Salgskonsulenter" vs "Fieldmarketing"
  - Hver fane viser completion-status, send-påmindelse-knap og statistik for sin egen variant
  - Send-påmindelse opretter reminders kun for medarbejdere med matchende job_title

### 5. Spørgsmål-administration (hvis quiz_templates bruges)
- Tjek om `quiz_templates` skal have variant-felt; hvis ja, tilføj `variant` til primary key så hver variant har sin egen redigerbare skabelon

## Tekniske ændringer
- **Migration**: Kolonner + RPC-opdatering + heal-script
- **`src/hooks/useCodeOfConduct.ts`**: Nyt FM-spørgsmålssæt + variant-parameter på alle hooks
- **`src/hooks/useCodeOfConductReminder.ts`**: Variant-aware reminder-fetch
- **`src/pages/CodeOfConduct.tsx`**: Auto-detekt variant
- **`src/pages/CodeOfConductAdmin.tsx`**: Tabs for de to varianter
- **Edge function (hvis relevant)**: Variant-parameter i send-påmindelse

## Forventet effekt
- FM-medarbejdere ser FM-spørgsmål; salgskonsulenter ser de eksisterende
- Adskilt completion-historik pr. variant (FM kan bestå sin egen test uden at påvirke den anden)
- Admin kan administrere begge tests separat
