

# Plan: Brug kandidatens ansøgte rolle i booking flow SMS'er

## Problem
Når `process-booking-flow` sender SMS'er, henter den `role` fra `applications.role` — men det felt eksisterer sandsynligvis ikke eller er altid tomt. Fallback er hardcodet til `'Salgskonsulent'`, uanset om kandidaten har søgt som Fieldmarketing.

I `auto-segment-candidate` (dag 0 SMS) bruges korrekt `candidate.applied_position` som fallback, men `process-booking-flow` (dag 1, 7, 14 osv.) gør det ikke.

## Løsning
Opdater `process-booking-flow/index.ts` til også at hente `candidate.applied_position` og bruge det som fallback:

**Fil:** `supabase/functions/process-booking-flow/index.ts`

Linje 152-160 ændres fra:
```ts
const { data: app } = await supabase
  .from('applications')
  .select('role')
  .eq('candidate_id', enrollment.candidate_id)
  ...
const role = app?.role || 'Salgskonsulent';
```

Til:
```ts
const { data: app } = await supabase
  .from('applications')
  .select('role')
  .eq('candidate_id', enrollment.candidate_id)
  ...

const role = app?.role || candidate.applied_position || 'Salgskonsulent';
```

Det kræver at `applied_position` allerede er inkluderet i candidate-queryen. Jeg tjekker og tilføjer det om nødvendigt.

## Omfang
- 1 fil ændres: `supabase/functions/process-booking-flow/index.ts`
- Ingen database-ændringer
- Ingen UI-ændringer

