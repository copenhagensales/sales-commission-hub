

## Plan: Lås P-pladser og Biludgifter som faste månedlige poster

### Problem
P-pladser og Biludgifter er faste beløb der gentager sig hver måned, men i dag skal de indtastes manuelt hver gang.

### Løsning
Markér "parkering" og "bil" som **recurring** kategorier. Når en ny måned åbnes uden eksisterende data for disse poster, kopieres automatisk beløb og note fra den seneste måned der har en værdi. UI'et viser et låseikon ved disse poster for at indikere de er faste.

### Ændringer i `src/components/billing/ExpenseReportTab.tsx`

1. **Tilføj `recurring: true`** på "parkering" og "bil" i `EXPENSE_CATEGORIES` (ligesom `auto: true` bruges for lokationer/hotel)

2. **Ny query**: Hent seneste `billing_manual_expenses` for recurring-kategorier hvor `year_month < selectedMonth` og `amount > 0`, sorteret desc, limit 1 per kategori

3. **Udvid `useEffect`**: For recurring-kategorier uden eksisterende data → brug forrige måneds værdier som default. Gem automatisk til databasen så de persisteres.

4. **UI**: Vis et `Lock`-ikon (fra lucide) ved recurring-poster i stedet for "(auto)". Felterne forbliver redigerbare så beløbet kan justeres.

### Filer

| Fil | Ændring |
|-----|---------|
| `src/components/billing/ExpenseReportTab.tsx` | Tilføj recurring-flag, copy-forward logik, låseikon |

