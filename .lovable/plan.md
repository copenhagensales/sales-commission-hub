
# Fix: FM-sælgere kan ikke registrere salg (RLS-problem)

## Problem
Salgsregistreringen for Fieldmarketing fejler stille, fordi `sales`-tabellens INSERT RLS-policy kun tillader `is_manager_or_above()`. Normale FM-sælgere har ikke denne rolle, så deres inserts bliver blokeret uden fejlmeddelelse (Supabase returnerer tom data i stedet for en fejl ved RLS-blokering).

## Årsag
Da FM-salg blev centraliseret fra den gamle `fieldmarketing_sales`-tabel til `sales`-tabellen, blev RLS ikke opdateret til at dække FM-sælgeres INSERT-behov.

## Løsning
Tilføj en ny RLS INSERT-policy specifikt for FM-sælgere:

### 1. Database-migration
Opret en ny INSERT-policy på `sales`-tabellen der tillader autentificerede brugere at indsætte rækker hvor `source = 'fieldmarketing'`:

```sql
CREATE POLICY "FM sellers can insert fieldmarketing sales"
ON public.sales
FOR INSERT
WITH CHECK (
  source = 'fieldmarketing'
  AND auth.uid() IS NOT NULL
);
```

Dette sikrer at:
- Kun fieldmarketing-salg kan oprettes af ikke-managers
- Brugeren skal være logget ind
- Andre salgstyper (telesales, tryg, etc.) kræver stadig manager-rettigheder

### 2. Forbedret fejlhåndtering i SalesRegistration
Opdater `handleSubmit` i `src/pages/vagt-flow/SalesRegistration.tsx` til at vise en tydelig fejlbesked hvis INSERT fejler, så problemer er lettere at diagnosticere fremover.

## Tekniske detaljer
- **Fil**: Database migration (ny RLS policy)
- **Fil**: `src/pages/vagt-flow/SalesRegistration.tsx` (bedre error handling)
- Ingen ændringer i hooks eller andre komponenter nødvendige
- Eksisterende manager-policy forbliver uændret
