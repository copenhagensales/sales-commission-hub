

## Excel-udtræk: Eesy TM salg per medarbejder

### Problem
Brugeren har brug for et Excel-udtræk over Eesy TM-salg i lønperioden 15/1 - 14/2, med antal salg og provision pr. medarbejder. Rapporter Ledelse-siden er tom i dag.

### Loesning
Tilfoej en Excel-eksport funktion paa ReportsManagement-siden med forudindstillet Eesy TM klient og lønperiode, der henter salgsdata grupperet pr. medarbejder og genererer en .xlsx fil.

### Teknisk plan

**Fil:** `src/pages/reports/ReportsManagement.tsx`

**Aendring 1** -- Tilfoej imports:
- `useState`, `useMemo` fra React
- `useQuery` fra tanstack
- `supabase` fra integrations
- `* as XLSX` fra xlsx
- `Button`, `Select`, `Card`, `Table` UI-komponenter
- `Download`, `FileSpreadsheet` ikoner fra lucide-react
- `format` fra date-fns
- `CLIENT_IDS` fra clientIds
- `fetchAllRows` fra supabasePagination

**Aendring 2** -- Tilfoej state og data-hentning:
- State for valgt klient (default: Eesy TM id) og periodestart/slut (default: 2026-01-15 / 2026-02-14)
- `useQuery` der henter salg med `sale_items` og `employee_agent_mapping` for den valgte klient og periode
- Aggreger data pr. medarbejder (navn, antal salg, provision)

**Aendring 3** -- Tilfoej Excel-eksport funktion:
```typescript
const handleExport = () => {
  const rows = aggregatedData.map(emp => ({
    "Medarbejder": emp.name,
    "Antal salg": emp.salesCount,
    "Provision (DKK)": Math.round(emp.commission),
  }));
  // Tilfoej totalraekke
  rows.push({
    "Medarbejder": "TOTAL",
    "Antal salg": totalSales,
    "Provision (DKK)": Math.round(totalCommission),
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Eesy TM Salg");
  XLSX.writeFile(wb, `eesy-tm-salg-${periodLabel}.xlsx`);
};
```

**Aendring 4** -- UI med tabel-preview og download-knap:
- Kort med titel "Salgsudtræk per medarbejder"
- Dropdown til klient-valg og dato-inputs til periode
- Tabel der viser medarbejder, antal salg, provision
- Download-knap der genererer Excel-filen

### Data-flow
1. Hent salg fra `sales` + `sale_items` filtreret paa `client_campaigns.client_id` og `sale_datetime`
2. Map `agent_email` til medarbejdernavn via `employee_agent_mapping` + `employee_master_data`
3. Aggreger pr. medarbejder: sum af quantity (counts_as_sale) og sum af mapped_commission
4. Generer XLSX med xlsx-biblioteket (allerede installeret)

### Filer der aendres

| Fil | Aendring |
|---|---|
| `src/pages/reports/ReportsManagement.tsx` | Fuldt nyt indhold med klientfilter, datatabel og Excel-eksport |

