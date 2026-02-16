

## Fjern "Omsætning" fra hovedoversigten

### Hvad ændres

**`src/pages/Dashboard.tsx`**:
- Fjern "Total Omsætning"-kortet (KPI-card med `totalRevenue`)
- Fjern `totalRevenue`-variablen og `total_revenue` fra KPI-listen
- Opdater grid fra `grid-cols-4` til `grid-cols-3` så de resterende 3 kort (Provision, Salg, Timer) fylder pænt

### Hvad påvirkes IKKE
- TDC Erhverv og Eesy TM henter `total_revenue` i datalaget men viser det ikke i UI — ingen ændring nødvendig
- Relatel er allerede opdateret (omsætning + provision fjernet)

### Resultat
Hovedoversigten viser kun: **Total Provision**, **Total Salg** og **Total Timer**.

