

# Fix: Placeringsryk vises ikke korrekt

## Problem
Edge-funktionen `league-calculate-standings` sætter `previous_overall_rank` til den nuværende `overall_rank` fra databasen, som den *lige selv* har skrevet. Resultatet er at `previous_overall_rank` altid er lig med `overall_rank` efter første kørsel, og der vises aldrig pil op/ned.

## Løsning
Tilføj en separat kolonne `previous_day_rank` (eller brug `previous_overall_rank` korrekt) ved at **kun opdatere previous-ranken én gang dagligt** i stedet for ved hver 15-minutters beregning.

### Ændring i `supabase/functions/league-calculate-standings/index.ts`
- Læs den eksisterende `previous_overall_rank` fra databasen (ikke `overall_rank`)
- Sammenlign den nye `overall_rank` med den eksisterende `previous_overall_rank`
- **Kun opdater `previous_overall_rank`** hvis det er en ny dag (sammenlign `last_calculated_at` dato med i dag)
- Hvis det er samme dag: behold den eksisterende `previous_overall_rank` uændret, så ryk i løbet af dagen er synlige

### Konkret logik
```
1. Hent eksisterende standings: employee_id, overall_rank, previous_overall_rank, last_calculated_at
2. For hver spiller:
   - Hvis last_calculated_at er fra i går (eller før): sæt previous_overall_rank = gammel overall_rank
   - Hvis last_calculated_at er fra i dag: behold previous_overall_rank uændret
3. Upsert med den korrekte previous_overall_rank
```

Dette sikrer at `previous_overall_rank` repræsenterer "rang ved dagens start", og pil op/ned viser ændringen i løbet af dagen.

### Fil-ændringer
1. **`supabase/functions/league-calculate-standings/index.ts`** — opdater step 9+10 til at hente `previous_overall_rank` og `last_calculated_at`, og kun rotere previous-rank ved dagsskifte

