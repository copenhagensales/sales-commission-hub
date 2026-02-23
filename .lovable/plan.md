

# Fix: "Du har ikke rettigheder til at registrere salg"

## Rodaarsag
Naar en saelger inserter i `sales`-tabellen, udloeser triggeren `trg_generate_sales_internal_reference` funktionen `generate_sales_internal_reference()`. Denne funktion proever at INSERT/UPDATE i tabellen `sales_reference_sequence` for at generere et unikt referencenummer (MG-YYYYMM-NNNNN).

**Problemet:** `sales_reference_sequence` har RLS aktiveret men **nul policies**. Funktionen koerer med brugerens rettigheder (ikke SECURITY DEFINER), saa alle non-admin brugere bliver blokeret.

## Loesning
Aendr funktionen `generate_sales_internal_reference()` til `SECURITY DEFINER`. Det er den korrekte loesning fordi:
- Funktionen bruges udelukkende internt via en trigger
- Den skriver kun til en teknisk sekvenstabell
- Brugere skal aldrig tilgaa `sales_reference_sequence` direkte

## Teknisk aendring (1 SQL migration)

```text
CREATE OR REPLACE FUNCTION generate_sales_internal_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ ... (same function body) $$;
```

Det er alt. Ingen kodeaendringer i frontend. Fejlen forsvinder med det samme for alle brugere.

