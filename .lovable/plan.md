

## Mål
Når kampagnepris-udtrækket uploades for TDC Erhverv, skal CPO-rettelsen i kolonne M fratrækkes den CPO der registreres på det tilsvarende OPP-nummer fra hovedfilen — men kun når M er negativ.

## Regel
- For hvert OPP fra kampagne-arket:
  - `M < 0` → ny CPO = oprindelig CPO **+ M** (M er negativ, så CPO reduceres med |M|, fx -600 → CPO bliver 600 lavere)
  - `M >= 0` → ingen ændring
- Gælder kun TDC Erhverv (samme guard som eksisterende kampagne-flow).

## Undersøgelse jeg skal lave før implementering
Jeg skal lokalisere præcis hvor CPO på en TDC-annullering kommer fra i `UploadCancellationsTab.tsx`:
- Total-rækkens CPO-felt (sandsynligt navn: `CPO`, `CPO total`, `Provision`, eller lign. — skal verificeres ved at læse `consolidateOppRows` + Total-rækkens kolonner)
- Hvor den endeligt persistereres / vises før godkendelse (PASS-flow + payload til `cancellation_*`-tabel)

## Ændringer (kun én fil)

**`src/components/cancellations/UploadCancellationsTab.tsx`**

1. **Udvid `campaignPriceMap`** fra `Map<string, boolean>` til `Map<string, { isCampaign: boolean; cpoAdjustment: number }>` (eller en parallel `Map<string, number>` med rå M-værdien).
   - Behold rule: kun negative M registreres som adjustment; positive/nul → 0.
   - Ved duplikerede OPP'er: tag den mest negative (laveste) M.

2. **I `consolidateOppRows` / `consolidateOppRowsLocal`** (TDC-grenen):
   - Find Total-rækkens CPO-felt (case-insensitive lookup, samme mønster som eksisterende kode).
   - Hvis OPP findes i map'et og `cpoAdjustment < 0`:
     - `nyCPO = oprindeligCPO + cpoAdjustment` (parse robust: håndter tom streng, komma som decimal, currency-tegn)
     - Skriv tilbage på Total-rækken som number (eller behold original formatering)
   - Bevar oprindelig værdi i et debug-felt `_original_cpo` til verificering i UI/logs.
   - Eksisterende `Kampagne pris: "Ja"/"Nej"` injection på sub-rows bibeholdes uændret.

3. **UI-statuslinje** under campaign-dropzone:
   - Udvid eksisterende "X OPP · Y m. kampagnepris" med "· Σ justering: -Z kr." så brugeren kan se total CPO-reduktion før Match.

## Edge cases
- OPP findes i kampagne-fil men ikke i hovedfil → ignoreres (intet at justere).
- OPP findes i hovedfil men ikke i kampagne-fil → ingen ændring (samme som i dag).
- Total-række mangler CPO-felt eller er ikke-numerisk → log warning, ingen ændring.
- Samme OPP flere gange i kampagne-fil med forskellige M → brug MIN (mest negativ).
- Hvis brugeren genuploader hovedfil efter kampagne-fil → re-kør consolidation med eksisterende map.

## Hvad jeg IKKE rører
- `evaluateConditions` / `findMatchingProductId` — uberørt; produkt-matching kører fortsat på `Kampagne pris: "Ja"/"Nej"` på sub-rows.
- Andre kunder end TDC Erhverv.
- `cancellation_product_mappings` og admin-UI.

## Verificering
- Upload eksempel-fil: OPP-1058032 (M = -600) → CPO på den tilsvarende Total-række skal være 600 lavere end før.
- OPP-1057494 (M = 0) → uændret.
- OPP-1059175 (M = +200) → uændret.
- Tjek `ApprovalQueueTab` viser den justerede CPO.

