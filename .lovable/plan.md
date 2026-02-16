

## Fix: FM-medarbejdere kan ikke se teamets salg (RLS-problem)

### Problem
RLS-politikken "FM sellers can view own fieldmarketing sales" begrænser FM-sælgere til kun at se salg hvor `agent_email` matcher deres egen email. Det betyder at Julie kun ser sine egne 146 salg, og ikke teamets salg fra den 15.-16. februar.

### Løsning
Opdater RLS-politikken så FM-sælgere kan se **alle** fieldmarketing-salg (source = 'fieldmarketing'), ikke kun deres egne.

### Tekniske ændringer

**Database-migration (SQL):**

1. Drop den eksisterende restriktive policy:
```sql
DROP POLICY "FM sellers can view own fieldmarketing sales" ON sales;
```

2. Opret ny policy der giver FM-sælgere adgang til alle FM-salg:
```sql
CREATE POLICY "FM sellers can view all fieldmarketing sales"
ON sales FOR SELECT
USING (
  source = 'fieldmarketing'
  AND EXISTS (
    SELECT 1 FROM employee_master_data
    WHERE auth_user_id = auth.uid()
    AND is_active = true
  )
);
```

Denne policy tillader enhver aktiv medarbejder med en auth-konto at se alle fieldmarketing-salg. Den generelle "Employees can view own sales" og "Managers can view sales" policy håndterer fortsat adgang til andre salgstyper (telesalg osv.).

### Ingen kodeændringer
Dashboardet henter allerede data korrekt -- problemet er udelukkende at databasen blokerer rækkerne via RLS. Når politikken er opdateret, vil alle FM-sælgere automatisk kunne se hele teamets salg, lønperiode-tabellen og dagens sælgere.

