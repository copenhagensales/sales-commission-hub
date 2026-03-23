

# Godkendelseskø: Sammenlign uploadet data med systemdata og vis kun forskelle

## Problem
Godkendelseskøen viser alle matchede salg uden kontekst. Brugeren ønsker at se **forskelle** mellem den uploadede fil (produkter, omsætning osv.) og systemets registrerede data (`sale_items`). Kun salg med afvigelser skal vises. Logikken varierer fra kunde til kunde (TDC Erhverv bruger OPP + produktnavne med %-suffiks, andre kunder kan have andre formater).

## Ændringer

### 1. Database: Tilføj `uploaded_data` til `cancellation_queue`
- Ny kolonne: `uploaded_data JSONB` — gemmer den originale Excel-række for hvert matchet salg, så vi kan sammenligne med systemdata.

### 2. `UploadCancellationsTab.tsx` — Gem uploaded data pr. match
- Når salg matches via OPP/telefon/virksomhed, find den tilsvarende uploadede række og gem den i `uploaded_data` feltet ved insert i `cancellation_queue`.
- Match uploaded rækker til salg via OPP-nummer (for TDC Erhverv) eller telefon/virksomhed.
- Hele den originale Excel-række gemmes som JSONB, så godkendelseskøen kan sammenligne uanset filformat.

### 3. `ApprovalQueueTab.tsx` — Hent sale_items og sammenlign
- **Hent `sale_items`** for alle matchede salg (med `product_id → products.name`, `mapped_commission`, `mapped_revenue`, `quantity`).
- **Sammenlign** uploadede kolonner med systemdata:
  - Byg en generisk diff-funktion der inspicerer uploaded_data og identificerer kolonner der ligner produkt/omsætning/provision-værdier.
  - For TDC Erhverv: produktnavne i uploaded data (med 0%/50%/100% suffix) sammenlignes med `sale_items.adversus_product_title` eller `products.name`.
  - Omsætning/provision i filen sammenlignes med `mapped_revenue` / `mapped_commission` sum.
- **Filtrer**: Vis kun rækker hvor der er mindst én forskel.
- **UI**: Vis system-værdi vs. uploaded værdi side-by-side med farvekodning (rød = forskel, grøn = ens).
- Tilføj en toggle/checkbox "Vis alle / Kun forskelle" så brugeren kan skifte.

### 4. Kolonnemapping i upload-stedet
- Tilføj valgfri kolonne-selectors for "Produktkolonne", "Omsætningskolonne" og "Provisionskolonne" i mapping-stedet (ligesom telefon/OPP).
- Disse bruges til at vide præcis hvilke felter i den uploadede fil der skal sammenlignes med systemdata.

| Fil | Ændring |
|-----|---------|
| Migration | Tilføj `uploaded_data JSONB` kolonne til `cancellation_queue` |
| `UploadCancellationsTab.tsx` | Gem uploaded data + tilføj produkt/omsætning/provision kolonne-selectors |
| `ApprovalQueueTab.tsx` | Hent sale_items, sammenlign med uploaded_data, vis kun forskelle med diff-UI |

## UI i godkendelseskøen

```text
┌──────────────────────────────────────────────────────────────┐
│ Godkendelseskø                    [Kun forskelle ✓] Filter ▼ │
├──────────┬────────┬──────────────┬──────────────┬────────────┤
│ OPP      │ Sælger │ System       │ Uploaded     │ Handling   │
├──────────┼────────┼──────────────┼──────────────┼────────────┤
│ OPP-     │ Sune   │ Produkt A    │ Produkt A    │            │
│ 1079497  │ Novrman│ Oms: 500 kr  │ Oms: 300 kr  │ ✓  ✗      │
│          │        │ ↑ FORSKEL    │              │            │
└──────────┴────────┴──────────────┴──────────────┴────────────┘
```

Hver række viser systemets produkter/omsætning vs. den uploadede fils data, med tydelig markering af afvigelser.

