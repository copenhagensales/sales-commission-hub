

## Ny rabataftale for Danske Shoppingcentre: Månedlig omsætning

### Hvad ændres
Den eksisterende placerings-baserede rabat for "Danske Shoppingcentre" (11 stk = 10%, 20 stk = 15%) erstattes med en ny **månedlig omsætnings-baseret** rabat:

| Månedlig booking-total | Rabat |
|---|---|
| 100.000 kr | 10% |
| 150.000 kr | 15% |
| 250.000 kr | 20% |

Rabatten beregnes på den samlede bookingværdi for måneden på tværs af alle lokationer af typen "Danske Shoppingcentre".

### Ny rabattype: `monthly_revenue`
Systemet har i dag `placements` og `annual_revenue`. Vi tilføjer `monthly_revenue` som ny type — den bruger periodens samlede bookingbeløb (allerede beregnet som `totalAmountNonExcluded`) til at slå rabattrin op.

### Database-migration
1. Deaktiver de 2 eksisterende "Danske Shoppingcentre" placement-regler
2. Indsæt 3 nye regler med `discount_type = 'monthly_revenue'` og `min_revenue` = 100000 / 150000 / 250000

### Kodeændringer

**1. `src/components/billing/DiscountRulesTab.tsx`**
- Tilføj `monthly_revenue` som valgmulighed i rabattype-dropdown ("Månedsomsætning (kr)")
- Vis `min_revenue`-felt når `monthly_revenue` er valgt (ligesom `annual_revenue`)
- Vis korrekt badge-tekst "Månedsomsætning" i tabellen

**2. `src/components/billing/SupplierReportTab.tsx`**
- Håndter `monthly_revenue` i rabatberegningen: brug `totalAmountNonExcluded` (allerede beregnet) som lookup-værdi mod `min_revenue`-tærsklerne
- Vis rabattrappe-UI for `monthly_revenue` (genbruger `annual_revenue`-stilen men med label "Månedsomsætning" i stedet for "Kumulativ årsomsætning")

**3. `src/pages/vagt-flow/Billing.tsx`**
- Håndter `monthly_revenue` i netto-beregningen: brug type-gruppens samlede beløb som lookup mod `min_revenue`-reglerne

**4. `src/utils/supplierReportPdfGenerator.ts`**
- Tilføj `monthly_revenue` som gyldig `discountType` i PDF-generatoren, vis "Månedsomsætning" som label

### Filer der ændres
1. **Ny migration** — deaktiver gamle DSC-regler, indsæt nye
2. **DiscountRulesTab.tsx** — ny rabattype i UI
3. **SupplierReportTab.tsx** — beregning + visning af monthly_revenue
4. **Billing.tsx** — netto-beregning med monthly_revenue
5. **supplierReportPdfGenerator.ts** — PDF-label

