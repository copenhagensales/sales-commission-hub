

# Fix: generate_sales_internal_reference SECURITY DEFINER

## Problem

`generate_sales_internal_reference()` er den eneste trigger-funktion der skriver til en anden tabel (`sales_reference_sequence`) men koerer som SECURITY INVOKER. Tabellen har RLS aktiveret med nul policies, saa alle bruger-inserts paa `sales` fejler.

## Undersoegelses-resultat

Alle 13 trigger-funktioner er gennemgaaet:
- 8 bruger allerede SECURITY DEFINER (korrekt)
- 4 bruger SECURITY INVOKER men er sikre (aendrer kun NEW-raekken)
- 1 er problematisk: `generate_sales_internal_reference`

## Fix

En enkelt database-migration:

```text
CREATE OR REPLACE FUNCTION public.generate_sales_internal_reference()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = 'public'
AS $function$
  ... (samme logik som nu, kun SECURITY DEFINER tilføjet)
$function$;
```

Ingen andre filer eller funktioner skal aendres.

