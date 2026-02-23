

# Opdel MyGoals i to faner: "Mål" og "Løn"

## Oversigt

Siden `/my-goals` opdeles med tabs i to faner:
1. **Mål** -- beholder alt eksisterende indhold (SalesGoalTracker)
2. **Løn** -- dagsoversigt over lønperioden med vagter og solgte produkter (ingen omsætning-kolonne)

## Ny komponent: PayrollDayByDay

Viser hver dag i lønperioden med:
- Dato og ugedag
- Vagtinfo (start, slut, pause) fra `shift`-tabellen
- Solgte produkter med kolonner: **Produkt**, **Antal**, **Provision** (INGEN omsætning)
- Dagstotal for provision

## Tekniske detaljer

### Fil: `src/pages/MyGoals.tsx` (ændres)

- Importer `Tabs, TabsList, TabsTrigger, TabsContent`
- Importer ny `PayrollDayByDay` komponent
- Wrap eksisterende `SalesGoalTracker` i `TabsContent value="maal"`
- Tilføj `TabsContent value="lon"` med `PayrollDayByDay`

### Ny fil: `src/components/my-profile/PayrollDayByDay.tsx`

**Props:**
- `employeeId: string`
- `payrollPeriod: { start: Date; end: Date }`

**Data-fetching (3 queries):**

1. **Agent emails** via `employee_agent_mapping` + `agents` for at finde medarbejderens agent-emails
2. **Salg** via `sales` (filtreret på agent_email + periode) med `sale_items` og `products` (navn, commission)
3. **Vagter** via `shift` (filtreret på employee_id + periode) med start_time, end_time, break_minutes

**Datastruktur:**
```text
Record<string, {
  date: string              // yyyy-MM-dd
  shift: { start_time, end_time, break_minutes } | null
  sales: Array<{ product_name, quantity, commission }>
  totalCommission: number
}>
```

**UI:**
- Itererer over hverdage i lønperioden
- Hver dag vises som et Card med dato-header
- Vagtinfo vises som badge/tekst
- Produkter vises i en simpel tabel: Produkt | Antal | Provision
- Dage uden aktivitet vises nedtonet
- Bunden viser periodesammenfatning med total provision

### Kolonner i dagsoversigten
- Produkt (fra `products.name` via `sale_items.product_id`)
- Antal (`sale_items.quantity`)
- Provision (`sale_items.mapped_commission`)
- **Ingen omsætning/revenue-kolonne**

