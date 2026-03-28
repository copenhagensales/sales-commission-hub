

## Ny fane: Dubletter (samme DB-salg matchet af flere fil-rækker)

### Problem
Når matching kører, kan ét salg i databasen matche flere rækker i upload-filen. Disse dubletter er usynlige i dag — de tæller med i `matchedSales` og kan potentielt skabe dobbelt-annulleringer.

### Løsning

**Fil: `src/components/cancellations/UploadCancellationsTab.tsx`**

**1. Beregn dubletter efter matching (ved `filteredDataForPreview`-blokken, ~linje 1574)**

Gruppér `matchedSales` efter `saleId`. Alle entries hvor samme `saleId` forekommer > 1 gang er dubletter:

```typescript
const duplicateSaleIds = new Map<string, MatchedSale[]>();
matchedSales.forEach(sale => {
  const arr = duplicateSaleIds.get(sale.saleId) || [];
  arr.push(sale);
  duplicateSaleIds.set(sale.saleId, arr);
});
const duplicateEntries = [...duplicateSaleIds.values()].filter(arr => arr.length > 1);
const duplicateSales = duplicateEntries.flat();
const duplicateCount = duplicateSales.length;
```

**2. Tilføj `"duplicates"` til previewTab type (linje 1576)**

```typescript
const [previewTab, setPreviewTab] = useState<"matched" | "unmatched" | "seller_unmatched" | "duplicates">("matched");
```

**3. Tilføj dublet-badge i stats-sektion (linje 1806-1832)**

Ny badge efter unmatched-badge:
```typescript
{duplicateCount > 0 && (
  <Badge
    variant={previewTab === "duplicates" ? "destructive" : "outline"}
    className="text-sm px-3 py-1 cursor-pointer"
    onClick={() => setPreviewTab("duplicates")}
  >
    <Layers className="h-3 w-3 mr-1" />
    {duplicateCount} dubletter
  </Badge>
)}
```

**4. Tilføj dublet-tabel i preview-indhold (efter seller_unmatched-sektionen)**

Viser grupperet tabel med alle rækker der peger på samme salg. Grupperet efter `saleId` med visuel separator mellem grupper. Kolonner: Salgsdato, Sælger, Telefon, Produkt, Provision, Omsætning, Virksomhed, OPP.

**5. Matched-badge: vis rækker i stedet for salg**

Ændr matched-badge fra `matchedSales.length` til `matchedRowIndices.size` så tallene summerer korrekt med umatchede rækker. Tilføj supplement-tekst med antal salg-matches:
```
{matchedRowIndices.size} matchede rækker ({matchedSales.length} salg)
```

### Resultat
- Ny "Dubletter" badge+fane synlig kun når der er dubletter
- Bruger kan se præcis hvilke salg der er ramt af flere rækker
- Matched-badge bruger nu rækker som enhed → tallene summer korrekt

