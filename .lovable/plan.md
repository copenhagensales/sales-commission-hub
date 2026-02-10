

# Fix: FM salgsregistrering fejler pga. SELECT RLS ved RETURNING-klausul

## Problem
FM-salgsregistrering fejler med "new row violates row-level security policy for table sales", selvom INSERT-policyen er korrekt opsat.

## Rodarsag
Mutationen bruger `.insert(data).select()`, som genererer `INSERT ... RETURNING *` i SQL. PostgreSQL kraver, at brugeren ogsa har SELECT-adgang til de returnerede raekker. FM-medarbejdere har ingen SELECT-adgang til `sales`-tabellen, fordi:

1. **"Managers can view sales"** - kraver `is_manager_or_above()` (falsk for FM)
2. **"Employees can view own sales"** - kraver `employee_agent_mapping` (de fleste FM-ansatte har ikke dette)

Resultatet: INSERT passerer FM-policyen, men RETURNING-klausulen blokeres af SELECT RLS, og hele operationen rulles tilbage.

## Losning (2 dele)

### 1. Fjern `.select()` fra FM-mutationen
I `src/hooks/useFieldmarketingSales.ts`, aendr:

```typescript
// FRA:
const { data, error } = await supabase
  .from("sales")
  .insert(enrichedSales)
  .select();

// TIL:
const { error } = await supabase
  .from("sales")
  .insert(enrichedSales);
```

Den returnerede data bruges ikke, sa `.select()` er unodvendig. Uden `.select()` genereres kun `INSERT` (uden `RETURNING *`), og kun INSERT-policyen evalueres.

Returvaerdien `data` bruges ikke i `onSuccess`, sa dette er en sikker aendring.

### 2. Tilf_j SELECT-policy for FM-medarbejdere (valgfri men anbefalet)
For at FM-medarbejdere ogsa kan SE deres egne salg (f.eks. i oversigter), opret en SELECT-policy:

```sql
CREATE POLICY "FM sellers can view own fieldmarketing sales"
ON public.sales
FOR SELECT
TO authenticated
USING (
  source = 'fieldmarketing'
  AND agent_email = (
    SELECT work_email FROM employee_master_data
    WHERE auth_user_id = auth.uid()
    LIMIT 1
  )
);
```

Dette sikrer, at FM-ansatte kan se deres egne FM-salg, men ikke andre salgstyper.

### 3. Ret ogsa `external_reference`-fejlen i integration engine
Filen `supabase/functions/integration-engine/core/sales.ts` refererer til kolonnen `sales.external_reference`, som ikke eksisterer. Denne query fejler ogsa i dag. Fjern `external_reference` fra SELECT-query i linje ~381.

## Teknisk oversigt

| Fil | Aendring |
|-----|---------|
| `src/hooks/useFieldmarketingSales.ts` | Fjern `.select()` fra insert-kaldet |
| Database migration | Ny SELECT-policy for FM-ansattes egne salg |
| `supabase/functions/integration-engine/core/sales.ts` | Fjern reference til `external_reference`-kolonne |

## Verifikation
- FM-medarbejder kan registrere salg uden RLS-fejl
- Salget dukker op i databasen
- Integration engine fejler ikke laengere pa `external_reference`

