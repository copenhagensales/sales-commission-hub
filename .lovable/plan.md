

# Fix: Korrekt diff-sammenligning for TDC Erhverv

## Problem
Diff-logikken misforstår TDC's Excel-struktur. Den uploaded data ser sådan ud:

```text
TT: 12000          → Omsætning (revenue)
CPO Total: 6000    → Provision (commission)  
TT trin: 100       → Procentindikator (irrelevant for diff)
TT mandat: 10233   → Mandatbeløb (irrelevant for diff)
Produkt: Total     → Totalrække (ikke produktnavn)
```

Men `computeDiff` behandler "TT", "TT trin", "TT mandat" som produktnavne og prøver at matche dem mod sale_items. Derudover har ingen import en `config_id` (alle er `null`), så med den nye kode returneres ingen diff overhovedet.

## Løsning

### 1. Opret default TDC Erhverv config
Via migration, indsæt en default config for TDC Erhverv:
- `revenue_column` = `"TT"` (sammenlign med sum af `mapped_revenue`)
- `commission_column` = `"CPO Total"` (sammenlign med sum af `mapped_commission`)
- `product_columns` = `[]` (tom — TDC's totalrækker har "Produkt: Total", ikke reelle produktnavne)
- `product_match_mode` = `"strip_percent_suffix"`

### 2. Fix `UploadCancellationsTab.tsx` — auto-load config
Problemet er at `config_id` ikke gemmes korrekt ved upload. Sikre at når en config vælges/auto-loades, gemmes dens `id` i `cancellation_imports`.

### 3. Fix `computeDiff` — filter irrelevante kolonner
Tilføj filtrering så kolonner med værdien "Total" ignoreres (TDC's Excel har "Pris: Total", "Antal: Total" osv. som er summeringsrækker, ikke faktisk data).

### 4. Revenue/commission sammenligning i hele kroner
TDC's system-data er i øre (f.eks. mapped_revenue = 11700 = 117 kr), mens Excel-data er i kr. Sørg for korrekt enhedskonvertering i diff.

| Fil | Ændring |
|-----|---------|
| Migration | Indsæt default TDC Erhverv config med korrekte kolonne-mappings |
| `UploadCancellationsTab.tsx` | Sikre config_id gemmes korrekt ved import |
| `ApprovalQueueTab.tsx` | Filter "Total"-værdier + korrekt enhedskonvertering |

