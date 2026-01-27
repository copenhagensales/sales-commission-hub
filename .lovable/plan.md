
# Plan: Fix "Tildel opstartshold" Fejl

## Problemet
Når Oscar Belcher tildeler en kandidat til et hold, virker funktionen ikke korrekt af to grunde:

1. **Supabase fejl ignoreres** - Koden tjekker ikke om database-operationerne lykkes
2. **Team kan springes over** - Man kan bekræfte uden at vælge et team

## Løsning

### Del 1: Tilføj fejlhåndtering for Supabase kald
Ændrer `onConfirm` callback'en i `CandidateDetail.tsx` til at tjekke for fejl:

```typescript
// Fra:
await supabase.from("candidates").update(updateData).eq("id", id);

// Til:
const { error: updateError } = await supabase
  .from("candidates")
  .update(updateData)
  .eq("id", id);

if (updateError) throw updateError;
```

### Del 2: Kræv team-valg
Opdaterer knap-logikken i `AssignCohortDialog.tsx`:

```typescript
// Fra:
disabled={isSubmitting || (!selectedCohortId && !availableFrom)}

// Til:
disabled={isSubmitting || !selectedTeamId || (!selectedCohortId && !availableFrom)}
```

## Teknisk sektion

### Fil 1: `src/pages/recruitment/CandidateDetail.tsx`
Ændringer i linje 945-979:
- Tilføj `{ error }` destrukturering til candidates update
- Tilføj `{ error }` destrukturering til cohort_members insert
- Kast fejl hvis nogen af dem fejler

### Fil 2: `src/components/recruitment/AssignCohortDialog.tsx`
Ændring i linje 256:
- Tilføj `!selectedTeamId` til disabled-betingelsen
- Eventuelt tilføj hjælpetekst hvis team ikke er valgt

## Forventet resultat
- Fejl fra databasen vises til brugeren
- Man kan ikke bekræfte uden at vælge et team
- Kandidatens `team_id` opdateres korrekt i databasen
