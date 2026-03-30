

## Begræns Excel-intern dublet-logik til kun Eesy TM og Eesy FM

### Problem
Excel-intern deduplikering (gruppering af rækker med samme telefonnummer og merge til én repræsentant) kører for **alle** kunder. Den skal kun gælde for **Eesy TM** og **Eesy FM**.

### Ændringer — `src/components/cancellations/UploadCancellationsTab.tsx`

**1. Import `CLIENT_IDS`**
- Tilføj import af `CLIENT_IDS` fra `@/utils/clientIds`

**2. Betingelse på Excel-intern dedup (linje ~868-892)**
- Wrap hele dedup-blokken i et tjek: kun kør hvis `selectedClientId` er Eesy TM eller Eesy FM
- For andre kunder: `excelDupIndices` forbliver tom, og `dedupedData = cleanedData` (ingen dedup)

**3. Betingelse på preview-layer merge (linje ~1940-1998)**
- Wrap phone-gruppering/merge-logikken: kun kør for Eesy TM/FM
- For andre kunder: `mergedMatchedSales = matchedSales`, `mergedAwayEntries = []`, og `matchedPhones` bygges uden merge

**4. Betingelse på duplicate-tab visning (linje ~2022-2033)**
- `duplicateEntries` vil naturligt blive tom for ikke-Eesy kunder da `mergedAwayEntries` er tom

### Logik
```typescript
const isEesyClient = selectedClientId === CLIENT_IDS["Eesy TM"] || selectedClientId === CLIENT_IDS["Eesy FM"];
```

Bruges som guard omkring begge dedup-steder. Resten af flowet (matching, unmatched, send-to-queue) fungerer uændret.

