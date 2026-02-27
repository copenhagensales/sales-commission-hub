
# Fix: Tilfoej DELETE RLS-policy til economic_imports

## Problem
Tabellen `economic_imports` har RLS aktiveret med policies for SELECT, INSERT og UPDATE, men mangler en DELETE-policy. Naar en bruger forsøger at slette, blokerer RLS operationen stille (ingen fejl, ingen sletning). Toast'en "Import slettet" vises fordi databasen ikke kaster en fejl - den sletter bare 0 raekker.

## Fix
Tilfoej en DELETE-policy der matcher de eksisterende policies:

```sql
CREATE POLICY "Owners can delete imports"
  ON public.economic_imports
  FOR DELETE
  USING (is_owner(auth.uid()));
```

## Ingen kodeaendringer
Koden i `EconomicUpload.tsx` er korrekt. Problemet er udelukkende en manglende database-policy.
