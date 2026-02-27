

# Tilfoej "Freelance" badge til Nye medarbejdere-tabellen

## Hvad
Viser et tydeligt farvet badge ved siden af medarbejdernavnet i "Nye medarbejdere"-fanen, hvis medarbejderen er markeret som freelance konsulent (`is_freelance_consultant = true`).

## Fil der aendres
**`src/components/salary/NewEmployeesTab.tsx`**

1. Tilfoej `is_freelance_consultant` til `NewEmployee` interfacet og til Supabase-queryen (`.select(...)`)
2. I `EmployeeTable` renderingen, tilfoej et badge efter navnet:
   ```
   {employee.is_freelance_consultant && (
     <Badge variant="secondary" className="...">Freelance</Badge>
   )}
   ```
   Badget faar en tydelig styling (fx orange/amber farve) saa det skiller sig ud fra "Inaktiv"-badget.

## Ingen database-aendringer
Feltet `is_freelance_consultant` eksisterer allerede i `employee_master_data`. Aendringen er rent UI.

