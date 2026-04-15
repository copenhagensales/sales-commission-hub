

# TDC Erhverv Produkt-betingelser for Kurv-rettelser

## Formål
Opsæt produkt-conditions så Excel-produktrækker fra `_product_rows` (med `Produkt` og `TT trin`) kan mappes til interne produkter. Alt kan rettes manuelt via Mapping-tabben efterfølgende.

## Ændringer

### 1. Dynamisk ALLOWED_COLUMNS i SellerMappingTab.tsx (linje 171)
Gør kolonnerne kundeafhængige:
- **TDC Erhverv**: `["Produkt", "TT trin"]`
- **Alle andre**: `["Operator", "Subscription Name", "Sales Department"]` (uændret)

For TDC, hent `columnValues` fra `_product_rows` i `uploaded_data` (nested JSON), ikke top-level felter.

### 2. Opdater matching-logik i 3 filer
Når `_product_rows` findes i uploaded data (TDC Erhverv), iterér over hver sub-række og kør `findMatchingProductId` mod den i stedet for top-level rækken:

- **UploadCancellationsTab.tsx** (linje ~1296 og ~1522)
- **ApprovalQueueTab.tsx** (linje ~761)

### 3. Indsæt initielle produkt-betingelser i databasen
Baseret på faktisk Excel-data. Alle 40 TDC-produkter:

**Med tilskud (2 betingelser: Produkt + TT trin):**

| Excel Produkt | TT trin | → Internt produkt |
|---|---|---|
| MOBIL PROFESSIONEL 100GB | 0/50/100 | Professionel mobil (100GB) 0/50/100% |
| MOBIL PREMIUM 1TB | 0/50/100 | Premium mobil (1TB) 0/50/100% |
| MOBIL STANDARD 40GB | 0/50/100 | Standard mobil (40GB) 0/50/100% |
| MOBIL BASIS 40GB | 0/50/100 | Mobil Basis (40GB BTL) 0/50/100% |
| MOBIL BASIS 15GB | 0/50/100 | Basis mobil (15GB) 0/50/100% |
| MOBIL BASIS 5GB | 0/50/100 | Mobil Basis (5GB BTL) 0/50/100% |
| MOBIL DK 3GB | 0/50/100 | Mobil DK (3GB) 0/50/100% |
| MOBIL MINUT | 0/50/100 | Mobil minut 0/50/100% |
| ERHVERV 5G FRI<50/10 | 0 | 5G - 50/10 |
| ERHVERV 5G FRI<100/20 | 0 | 5G - 100/20 - TDC Erhverv |
| ERHVERV 5G FRI<200/40 | 0 | 5G - 200/40 |
| ERHVERV 5G FRI<500/100 | 0 | 5G - 500/100 |

**Uden tilskud (kun Produkt):**

| Excel Produkt | → Internt produkt |
|---|---|
| STANDARD OMSTILLING | Omstilling |
| PROFESSIONEL OMSTILLING | Omstilling PROFESSIONEL |
| INTERNETFILTER | Internetfilter |
| READY SUPPORT AFTALE | Ready Support |

Det giver ~80 condition-rækker (2 per produkt-variant). MBB-produkter og NUMMERRESERVATION har ingen Excel-data der kan mappes entydigt endnu — kan tilføjes manuelt via UI'et.

### Filer der ændres
1. **`src/components/cancellations/SellerMappingTab.tsx`** — Dynamiske kolonner + nested data extraction for TDC
2. **`src/components/cancellations/UploadCancellationsTab.tsx`** — `_product_rows` sub-række evaluation
3. **`src/components/cancellations/ApprovalQueueTab.tsx`** — Samme tilpasning
4. **Database** — ~80 INSERT i `cancellation_product_conditions`

