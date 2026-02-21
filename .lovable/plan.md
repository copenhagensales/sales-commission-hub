
# Vis inaktive medarbejdere i "Nye medarbejdere"-listen

## Hvad skal aendres
Listen over nye medarbejdere filtrerer i dag kun aktive medarbejdere fra. Vi fjerner dette filter, saa baade aktive og inaktive medarbejdere vises.

For at goere det tydeligt hvem der er inaktiv, tilfojer vi en visuel indikator (badge) paa inaktive medarbejdere.

## Tekniske aendringer

**Fil: `src/components/salary/NewEmployeesTab.tsx`**

1. Tilfoej `is_active` til SELECT-query og NewEmployee-interface
2. Fjern `.eq("is_active", true)` filteret (linje 59)
3. Tilfoej en badge/markering ved inaktive medarbejdere i tabellen, saa de er lette at skelne fra aktive

Resultatet er at alle medarbejdere med startdato i den valgte periode vises -- baade aktive og inaktive -- med en tydelig markering af status.
