

## Vis Revenue/FTE (Oms/FTE) i DB per Klient tabellen

### Hvad
Feltet `revenuePerFTE` beregnes allerede korrekt i koden men vises aldrig i tabellen. Vi tilfojer det som en ny synlig kolonne, sa I kan se produktiviteten pr. medarbejder direkte i oversigten.

### Hvad det giver jer
- **Sammenlignelighed**: En klient med 500k omsaetning og 10 FTE er mindre effektiv end en med 300k og 3 FTE — det kan I nu se direkte.
- **Styringsindsigt**: Identificer hurtigt hvilke klienter der udnytter kapaciteten bedst.

### AEndringer

**Fil: `src/components/salary/ClientDBTab.tsx`**

1. **Tilf0j ny TableHead-kolonne** mellem DB% og den tomme kolonne (ca. linje 973):
   - Header: "Oms/FTE" med sorteringsmulighed
   - Bredde: `w-[100px]`, hojrestillet

2. **Tilf0j sorteringslogik** i `handleSort`-funktionen (ca. linje 775):
   - Ny case `"revenuePerFTE"` der sorterer pa `client.revenuePerFTE`

3. **Opdater colSpan** for loading/empty states fra 9 til 10

**Fil: `src/components/salary/ClientDBExpandableRow.tsx`** (eller tilsvarende raekke-komponent)

4. **Tilf0j ny TableCell** der viser `formatCurrency(client.revenuePerFTE)` i hver raekke

### Teknisk detalje
Ingen ny beregning nodvendig — `revenuePerFTE` er allerede beregnet pa linje 670 og 829. Vi eksponerer blot vaerdien i UI'et.

