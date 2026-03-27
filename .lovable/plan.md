

## Tilføj grøn kurv-indikator (som dato)

### Problem
Dato-sammenligningen viser altid en grøn/rød indikator. Men omsætning, provision og produkter viser kun noget når der **er** en forskel — aldrig en grøn "match".

### Løsning
Udvid `computeDiff` i `ApprovalQueueTab.tsx` så revenue, commission og produkter også pusher en entry med `isDifferent: false` når værdierne matcher. Det giver samme grønne "✓ Omsætning" / "✓ Provision" visning som dato allerede har.

### Ændringer i `src/components/cancellations/ApprovalQueueTab.tsx`

**Revenue (linje 138-151):** Tilføj `else`-gren der pusher match-entry når `Math.abs(uploadedVal - systemRevenue) <= 1`:
```typescript
if (!isNaN(uploadedVal)) {
  const isDiff = Math.abs(uploadedVal - systemRevenue) > 1;
  diffs.push({
    label: `Omsætning (${mapping.revenue_column})`,
    systemValue: `${systemRevenue.toFixed(0)} kr`,
    uploadedValue: `${uploadedVal.toFixed(0)} kr`,
    isDifferent: isDiff,
  });
}
```

**Commission (linje 153-165):** Samme mønster — altid push, sæt `isDifferent` baseret på sammenligning.

**Produkter (linje 168-195):** For kvantitets-match, push også når `uploadedQty === systemQty`. For produkt-navn match, push med `isDifferent: false` når produktet genkendes.

### UI
Ingen ændringer nødvendige — renderingen håndterer allerede `isDifferent: false` med grøn baggrund og ✓-ikon (bruges allerede af dato).

