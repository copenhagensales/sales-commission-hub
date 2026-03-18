

## Problem

Kandidater kan ikke slettes fordi RLS-politikkerne på `candidates`-tabellen mangler en eksplicit **DELETE**-policy.

**Nuværende policies:**
- `SELECT` — rekruttering, teamledere, some-rolle
- `ALL` — kun `is_owner` eller `is_rekruttering`

`ALL`-policyen burde dække DELETE, men den har kun en `qual` (USING) og ingen `with_check`. Lad mig verificere om `ALL` faktisk virker for delete, eller om der er et andet problem — men baseret på fejlen og skærmbilledet er det sandsynligt at `ALL`-policyen ikke gælder for den bruger der forsøger at slette (de er hverken ejer eller rekruttering-rolle).

**Løsning:** Tilføj en DELETE-policy der også tillader teamledere at slette kandidater, da det er teamledere der bruger "Kommende Opstarter"-siden.

### Plan

1. **Tilføj DELETE RLS-policy** på `candidates`-tabellen:
   ```sql
   CREATE POLICY "Teamledere can delete candidates"
   ON public.candidates
   FOR DELETE
   TO authenticated
   USING (is_teamleder_or_above(auth.uid()));
   ```

   Dette giver teamledere og ejere mulighed for at slette kandidater, i tillæg til den eksisterende `ALL`-policy for rekruttering/ejere.

Ingen kodeændringer nødvendige — kun en database-migration.

