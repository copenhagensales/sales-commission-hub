

## Plan: Lokationer netto efter rabat i Udgiftsrapport

### Hvad der ændres

Udgiftsrapportens auto-beregnede "Lokationer" viser i dag **brutto**. Den ændres til at vise **netto efter leverandørrabat**, identisk med Oversigt-fanens beregning.

### Ændringer i `src/components/billing/ExpenseReportTab.tsx`

1. **Tilføj 2 nye queries** — hent `supplier_discount_rules` (aktive) og `supplier_location_exceptions` (aktive)

2. **Udvid booking-queryen** — tilføj `location_id` og `location:location_id(daily_rate, type, name)` så vi kender lokationstype og -navn

3. **Ny `autoLocationTotal` beregning** — repliker rabatlogikken fra `Billing.tsx`:
   - Gruppér bookinger efter lokationstype
   - For hver type: find gældende rabatregler (placement / monthly_revenue / annual_revenue)
   - Beregn placements og typeGroupTotal (ekskl. excluded lokationer)
   - Anvend rabat per lokation med exception-håndtering (excluded, max_discount)
   - Resultat = netto i stedet for brutto

4. **Opdater note** — ændr "Auto-beregnet fra bookinger" til "Auto-beregnet (netto efter rabat)"

### Teknisk detalje

Rabatlogikken kopieres direkte fra `Billing.tsx` linje 215-305. Den:
- Grupperer lokationer efter `location.type`
- Finder rabatregler for typen fra `supplier_discount_rules`
- Håndterer 3 rabattyper: `placement`, `monthly_revenue`, `annual_revenue`
- Respekterer `supplier_location_exceptions` (excluded / max_discount)
- Beregner `totalAmount * (1 - discount/100)` per lokation

### Fil

| Fil | Ændring |
|-----|---------|
| `src/components/billing/ExpenseReportTab.tsx` | Tilføj discount queries, beregn netto i stedet for brutto |

