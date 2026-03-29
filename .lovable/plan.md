

## Problem

I **Pass 1b** (linje 1122-1128) og **Pass 2** (linje 1374-1377) kræver koden, at salget indeholder et produkt der matcher `resolvedProduct` eksakt (`hasProduct` check). Hvis produktet er anderledes — hvilket er selve definitionen af en kurvrettelse — springes rækken over med `continue`.

## Løsning

Fjern `hasProduct`-kravet som gate/filter. Match i stedet salget på telefon/sælger/dato som hidtil, og gem **begge** produktnavne (`targetProductName` fra Excel, `realProductName` fra salget). Klassificeringen (annullering vs. korrekt match vs. kurvrettelse) sker allerede downstream baseret på om de to navne matcher.

## Ændringer i `src/components/cancellations/UploadCancellationsTab.tsx`

### Pass 1b (ca. linje 1117-1149)
- Fjern `if (!resolvedProduct) continue;` (linje 1123)
- Fjern `hasProduct` check + `if (!hasProduct) continue;` (linje 1125-1128)
- Brug `resolvedProduct` som `targetProductName` (uændret)
- Sæt `realProductName` til salgets første item's `adversus_product_title` (i stedet for kun det matchende items)
- Behold dedup-key som `saleId|phone` i stedet for `saleId|resolvedProduct`

### Pass 2 non-excluded (ca. linje 1362-1401)
- Fjern `hasProduct` check + `if (!hasProduct) continue;` (linje 1374-1377)
- Sæt `realProductName` til salgets første items produkt
- Behold sælger+dato matching uændret

### Ingen ændringer i:
- `productConditionMatcher.ts` (exact-match logik er korrekt)
- Klassificeringslogik downstream (bruger allerede `targetProductName` vs `realProductName`)
- ApprovalQueueTab (viser allerede diffs korrekt)

