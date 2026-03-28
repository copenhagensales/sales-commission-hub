

## Plan: Udgiftsrapport-fane i Fakturering

### Hvad der bygges

En ny fane "Udgiftsrapport" i `/vagt-flow/billing` med faste udgiftsposter der kan indtastes manuelt, gemt i databasen per måned, med totalsum i bunden.

### Ændringer

**1. Ny tabel: `billing_manual_expenses`**

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | uuid PK | |
| year_month | text NOT NULL | F.eks. "2026-03" |
| category | text NOT NULL | F.eks. "brobizz", "benzin" |
| amount | numeric DEFAULT 0 | Beløb i kr. |
| note | text | Evt. bemærkning |
| updated_by | uuid | Bruger der sidst ændrede |
| updated_at | timestamptz | |

Unique constraint på `(year_month, category)` så der kun er én række per kategori per måned.

**2. Ny komponent: `src/components/billing/ExpenseReportTab.tsx`**

- Månedsvælger (samme stil som andre faner)
- Tabel med faste kategorier: Brobizz, Benzin (Cirkel K), P-pladser, Bil udgifter, DSB, Lokationer, CorpayI, Pads (eesy betaler 50%), Team arrangement, Banken, Bøder
- Hver række har et input-felt til beløb og et til noter
- Ændringer gemmes med upsert (debounced eller med "Gem"-knap)
- iPads-rækken viser en note om 50% eesy-betaling
- Total-række i bunden summerer alle beløb

**3. Opdater `Billing.tsx`**

- Import + tilføj fane "Udgiftsrapport"

### Filer

| Fil | Handling |
|-----|---------|
| SQL migration | Ny `billing_manual_expenses` tabel med RLS |
| `src/components/billing/ExpenseReportTab.tsx` | **Ny** |
| `src/pages/vagt-flow/Billing.tsx` | Tilføj fane |

