
Årsagen er synlig i koden: salget havner ikke i kurvrettelse, fordi klassificeringen sammenligner `targetProductName` med `realProductName`, men `realProductName` bliver flere steder sat forkert til det mappede upload-produkt i stedet for det faktiske system-produkt.

Hvad der konkret går galt:
- I `src/components/cancellations/UploadCancellationsTab.tsx` bruges denne logik ved oprettelse af kø-items:
  - `cancellation` hvis type-detection eller “Annulled Sales” matcher
  - ellers `correct_match` hvis `targetName === realName` eller produktet er `phone_excluded`
  - ellers `basket_difference`
- Problemet er, at `realProductName` flere steder bygges sådan:
  - linje ca. `1031`: `matchingItem?.adversus_product_title || mapping.productName`
  - linje ca. `1155`: `matchedItemForProduct?.adversus_product_title || resolvedProduct || "Ukendt produkt"`
  - linje ca. `1367`: `matchedItem?.adversus_product_title || resolvedProductTitle!`
  - linje ca. `1419`: `matchedItem?.adversus_product_title || resolvedProductTitle!`
- Når der ikke findes et egentligt produktmatch, falder `realProductName` altså tilbage til samme værdi som `targetProductName`. Så bliver sammenligningen falsk positiv, og rækken ender som `correct_match` i stedet for `basket_difference`.

Det passer med dit eksempel:
- Upload-produktet er mappet til ét produkt
- System-salget viser et andet produkt
- Men fordi fallback genbruger mapping-værdien, ser systemet det som “match”

Der er også et separat 5G-problem i køen:
- I `src/components/cancellations/ApprovalQueueTab.tsx` beregnes diff-visningen i `computeDiff(...)` kun ud fra upload-kolonner vs. `saleItems`
- Den funktion tager ikke hensyn til `phone_excluded_products`
- Derfor kan 5G-rækker stadig få rød produkt-fejl i UI, selv når 5G-match-logikken faktisk er korrekt

Plan for rettelse:
1. Ret `realProductName` i `UploadCancellationsTab.tsx`
   - Fjern fallback til mapped/upload-produkt
   - Brug altid et faktisk produkt fra salgets `sale_items` som fallback
   - Hvis der ikke findes et eksakt item-match, skal fallback være salgets primære/første produkt, ikke det resolvede produkt fra uploaden
   - Gøres i alle fire steder nævnt ovenfor

2. Behold 5G speciallogik i klassificeringen
   - `phone_excluded_products` skal stadig gå til `correct_match`, når rækken ikke er en annullering
   - Men kun fordi 5G-reglen overstyrer produktsammenligning med vilje, ikke fordi `realProductName` er forkert

3. Ret visningen i `ApprovalQueueTab.tsx`
   - Udvid diff-modellen med fx `isExpected`
   - Når række er `phone_excluded`, skal produkt-diff ikke vises som rød fejl
   - For `basket_difference` skal produkt-diff vises som forventet forskel, ikke som “fejl i match”

4. Justér type-labels i køen
   - `correct_match` skal vises som “Korrekt match”
   - `basket_difference` som “Kurv diff.”
   - `cancellation` som “Annullering”
   - Lige nu vises alt ikke-cancellation som “Kurv diff.” i tabellen, hvilket gør fejlsøgning sværere

Forventet resultat efter fix:
- Rækker uden produktmatch ender faktisk i `Kurv-rettelser`
- 5G Internet bliver ikke længere markeret som falsk produktfejl
- “Korrekte match” bruges kun ved ægte produktmatch eller ved bevidst 5G-overstyring
