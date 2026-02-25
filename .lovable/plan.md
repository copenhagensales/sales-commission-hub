

## FM-medarbejdere viser 0 kr — manglende agent-mapping

### Grundårsag

RPC'en `get_sales_aggregates_v2` resolver medarbejder-ID via kæden:

```text
sales.agent_email → agents.email → employee_agent_mapping → employee_master_data
```

De fleste FM-medarbejdere (16 ud af 20) har **ingen entry i `agents`-tabellen**. Deres `work_email` matcher `sales.agent_email`, men RPC'en joiner kun via `agents`-tabellen — ikke direkte mod `employee_master_data.work_email`.

Resultatet: RPC'en returnerer FM-salg med **email som group_key** (f.eks. `macu@copenhagensales.dk`) i stedet for **employee UUID**. Hooken `useSellerSalariesCached` slår op med `commissionMap[emp.id]` (UUID), finder intet match, og viser 0 kr.

**Bevis:** Martina Cubranovic har 376 salg og 154.560 kr provision i RPC'en, men group_key er `macu@copenhagensales.dk` — ikke hendes UUID `c72e428f-066d-46ce-83f5-4d43c9911fec`.

### Løsning

Tilføj en work_email-fallback i RPC'en, så FM-medarbejdere uden agent-mapping også resolves til deres employee UUID.

### Teknisk plan

**1. Database: Opdatér `get_sales_aggregates_v2` RPC**

Tilføj et ekstra LEFT JOIN direkte fra `sales.agent_email` til `employee_master_data.work_email` som fallback, når `employee_agent_mapping` ikke matcher:

```sql
-- Eksisterende joins:
LEFT JOIN agents a ON lower(a.email) = lower(s.agent_email)
LEFT JOIN employee_agent_mapping eam ON eam.agent_id = a.id
LEFT JOIN employee_master_data emd ON emd.id = eam.employee_id

-- Ny fallback join:
LEFT JOIN employee_master_data emd_fb 
  ON emd.id IS NULL 
  AND lower(emd_fb.work_email) = lower(s.agent_email)
```

Opdatér group_key til: `COALESCE(eam.employee_id::text, emd_fb.id::text, lower(s.agent_email))`
Opdatér group_name til: `COALESCE(a.name, emd_fb.first_name || ' ' || emd_fb.last_name, s.agent_email)`

**2. Frontend: Tilføj email→UUID fallback i `useSellerSalariesCached.ts`**

Som sikkerhedsnet (i tilfælde af at RPC-migrationen ikke er kørt endnu), tilføj en sekundær lookup i `commissionMap`-opbygningen:

```typescript
// Build work_email -> employee_id lookup for FM fallback
const emailToEmployeeId: Record<string, string> = {};
for (const emp of employees) {
  if (emp.work_email) {
    emailToEmployeeId[emp.work_email.toLowerCase()] = emp.id;
  }
}

// Build commission map with fallback
for (const [key, empData] of Object.entries(salesAggregates.byEmployee)) {
  // Key is either UUID or email (for unmapped FM employees)
  const employeeId = emailToEmployeeId[key.toLowerCase()] || key;
  commissionMap[employeeId] = (commissionMap[employeeId] || 0) + empData.commission;
}
```

Dette kræver at `work_email` hentes i employees-query'en (linje 65 — allerede inkluderet i select).

### Påvirkning

- FM-medarbejdere med salg vil vise korrekt provision i Sælgerlønninger.
- Ingen ændring i interface — `SellerData[]` er uændret.
- RPC-rettelsen gavner også alle andre views der bruger `useSalesAggregatesExtended` med `groupBy: ['employee']`.
- Eksisterende TM-medarbejdere med agent-mapping påvirkes ikke (de matcher stadig via UUID).

### Filer

1. **Database migration**: Opdatér `get_sales_aggregates_v2` RPC med work_email fallback join.
2. **`src/hooks/useSellerSalariesCached.ts`**: Tilføj email→UUID fallback i commissionMap (linje 176-181). Tilføj `work_email` til employees select hvis det ikke allerede er der.

