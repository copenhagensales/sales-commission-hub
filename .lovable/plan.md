

## Ombyg Produktmerge til step-baseret wizard

### Nuværende problem
Merge-funktionen kræver at man først vælger produkter via checkboxes i tabellen og derefter åbner en dialog. Det er uoverskueligt og der er ingen kundefiltrering i selve merge-flowet.

### Ny tilgang: Step-wizard i dialog
En **"Merge produkter"**-knap (altid synlig) åbner en dialog med 3 steps:

**Step 1 — Vælg kunde**
- Dropdown med alle kunder (fra `clientCampaigns` grupperet på `client_id`)
- Når kunde er valgt, hentes produkter for den kunde

**Step 2 — Vælg produkter**
- Liste af kundens produkter med checkboxes
- Vælg 2+ produkter + vælg target-produkt (radio button)

**Step 3 — Bekræft merge**
- Preview af hvad der flyttes (mappings, sales, regler)
- Opsummering + bekræftelsesknap (som nu)

### Ændringer

| Fil | Ændring |
|-----|---------|
| `ProductMergeDialog.tsx` | Omskrives til step-wizard: step 1 (kunde), step 2 (vælg produkter + target), step 3 (preview + bekræft). Henter selv produkter baseret på valgt kunde. |
| `MgTest.tsx` | Fjern `mergeSelectedProducts` state, checkboxes i produkttabellen, og den betingede merge-knap. Erstat med en permanent "Merge produkter"-knap der åbner dialogen. |

### UI-detaljer
- Step-indikator i toppen (1/2/3)
- "Næste"/"Tilbage"-knapper i bunden
- Step 3 beholder den eksisterende merge-logik og preview
- Dialogen henter selv produkter via Supabase baseret på valgt kunde

