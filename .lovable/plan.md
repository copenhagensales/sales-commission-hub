

## Mål
Tilføj understøttelse af et **andet** Excel-ark (kampagnepris-udtræk) ved upload på TDC Erhverv, så systemet automatisk kan beregne om hvert OPP-nummer er solgt med kampagnepris. Resultatet bruges som **"Kampagne pris" condition** ved produkt-matching — på linje med hvordan vi i dag aflæser produktrækkerne fra hovedfilen.

## Reglen (fra brugeren)
For hvert OPP-nummer i kampagne-udtrækket:
- **Kolonne D** = OPP-nummer
- **Kolonne M** = CPO-rettelse
  - Negativt beløb (< 0) → solgt **med kampagnepris** → `Kampagne pris = "Ja"` (eller `true`)
  - 0 eller positivt beløb → **ikke** kampagnepris → `Kampagne pris = "Nej"` (eller `false`)

Hvis et OPP findes i hovedfilen men ikke i kampagne-arket → behandles som "ikke kampagnepris".

## UI-flow på Upload-fanen (TDC Erhverv)
Når kunden er TDC Erhverv vises der nu **to drop-zones** (eller én drop-zone der accepterer to filer i én operation):

1. **Hovedfil** (eksisterende) — annulleringslisten med OPP/produktrækker
2. **Kampagnepris-udtræk** (NYT) — separat .xlsx med kolonne D + M

Begge filer kræves før "Match"-knappen aktiveres. Lille statusindikator viser hvor mange OPP-numre der blev fundet i kampagne-udtrækket og hvor mange der er kampagnepris.

## Datamodel & flow
1. Parser kampagne-arket med eksisterende `parseExcelFile` — læser kolonne D (OPP) og M (CPO-rettelse) uanset header-navne (positionsbaseret, da brugeren refererer til kolonne-bogstaver).
2. Bygger en `Map<oppNumber, boolean>` (`true` = kampagnepris).
3. Ved consolidation af hovedfilens OPP-rækker (`consolidateOppRowsLocal` / `consolidateOppRows` i `UploadCancellationsTab.tsx`) berigedes hver `_product_rows` sub-row med et nyt felt `Kampagne pris: "Ja" | "Nej"` baseret på map-opslag.
4. Eksisterende `findMatchingProductId` / `evaluateConditions` virker uændret — de aflæser allerede `Kampagne pris`-kolonnen i sub-rækken (jf. `SellerMappingTab.tsx` linje 175 + 179).

## Filer der ændres

| Fil | Ændring |
|-----|---------|
| `src/components/cancellations/UploadCancellationsTab.tsx` | Ny state `campaignPriceFile` + `campaignPriceMap`. Ny dropzone (vises kun for TDC). Parse-funktion `parseCampaignPriceExcel` (læser kolonne D & M positionelt). I begge `consolidateOppRows`-instanser (linje ~1456 og ~1989): inject `Kampagne pris` på hver sub-row før condition-matching. |
| `src/components/cancellations/ApprovalQueueTab.tsx` | (Valgfrit) Vis "Kampagne pris: Ja/Nej" i den strukturerede TDC-render så admin kan se hvad der blev udledt. Allerede understøttet — kommer gratis. |

## Edge cases
- Kampagne-udtrækket har potentielt header-rækker → vi springer rækker over hvor kolonne D ikke ligner et OPP (numerisk/alfanumerisk kontrol)
- Tomme M-celler → behandles som 0 → ikke kampagnepris
- Samme OPP forekommer flere gange → tag MIN(M)-værdi (hvis nogen er negativ → kampagnepris)
- Kampagne-fil uploadet uden hovedfil → fejlmeddelelse
- Ikke-TDC kunder → kampagne-dropzone vises ikke

## Eksempel-output for en row
Før (kun hovedfil):
```
{ Produkt: "5G Internet", "TT trin": "3", _product_rows: [...] }
```
Efter (med kampagne-fil):
```
{ Produkt: "5G Internet", "TT trin": "3", _product_rows: [
    { Produkt: "5G Internet", "TT trin": "3", "Kampagne pris": "Ja" }
]}
```
→ matcher nu produkt-mapping reglen "Kampagne pris = Ja"

