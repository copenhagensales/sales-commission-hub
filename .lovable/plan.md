

## Problem: Powerdag TV-board er sort/blank

### Årsag
Alle tre Powerdag-tabeller (`powerdag_events`, `powerdag_point_rules`, `powerdag_scores`) har RLS-policies der kun tillader **authenticated** brugere at læse data. TV-boards kører **uden authentication** (anon key), så alle queries returnerer tomme resultater → blank skærm.

### Løsning
Tilføj SELECT-policies for `anon`-rollen på alle tre tabeller, så TV-boards kan læse data uden login.

### Database-migration

```sql
-- Allow anonymous (TV board) read access to powerdag tables
CREATE POLICY "Anon can read powerdag_events"
  ON public.powerdag_events FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can read powerdag_point_rules"
  ON public.powerdag_point_rules FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can read powerdag_scores"
  ON public.powerdag_scores FOR SELECT TO anon USING (true);
```

### Filer der ændres
1. **Ny migration** — tilføj anon SELECT-policies på de 3 powerdag-tabeller

Ingen kodeændringer nødvendige — komponenterne og queries fungerer allerede korrekt, de mangler bare data-adgang.

