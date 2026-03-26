

## Synliggør løntilføjelser i tabellen + slet-funktion

### Problem
Salary additions bliver gemt og lagt til kolonne-værdierne, men man kan ikke se hvilke celler der har tilføjelser, og man kan ikke slette dem.

### Løsning

#### 1. Udvid `useSellerSalariesCached` med additions-detaljer
- Tilføj et `salaryAdditions` felt til `SellerData` interfacet: `Record<string, { total: number; items: { id: string; amount: number; note: string | null }[] }>`
- Hent `id` og `note` i salary_additions query (udover employee_id, column_key, amount)
- Byg additions-data per medarbejder med individuelle poster så de kan vises og slettes

#### 2. Ny komponent: `SalaryAdditionCell.tsx`
- Wrapper-komponent til TableCell der viser beløbet som normalt
- Hvis medarbejderen har tilføjelser på den kolonne, vis en lille indikator (fx farvet dot eller tooltip-ikon)
- Ved klik/hover åbnes en Popover med liste over tilføjelser (beløb, note, slet-knap)
- Slet-knap kalder `supabase.from('salary_additions').delete().eq('id', ...)` og invaliderer query

#### 3. Opdater `SellerSalariesTab.tsx`
- Erstat de simple `<TableCell>` for hver kolonne med `<SalaryAdditionCell>`
- Send medarbejderens additions-data og kolonne-nøgle som props

### Berørte filer
- `src/hooks/useSellerSalariesCached.ts` — udvid query og SellerData interface
- `src/components/salary/SalaryAdditionCell.tsx` — ny komponent
- `src/components/salary/SellerSalariesTab.tsx` — brug SalaryAdditionCell

