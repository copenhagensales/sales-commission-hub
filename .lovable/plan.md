

# Layout-ændringer i "Uploadet data" for TDC Erhverv

## Ændringer i `src/components/cancellations/ApprovalQueueTab.tsx`

### 1. CPO Total og TT trin side om side (linje ~1299-1302)
Erstat `space-y-0.5` med `flex gap-3` så de to felter vises horisontalt:
```tsx
<div className="text-muted-foreground border-t pt-1 mt-1 flex gap-3">
  {structured.cpoTotal && <span>CPO Total: {structured.cpoTotal} kr</span>}
  {structured.ttTrin !== "" && <span>TT trin: {structured.ttTrin}</span>}
</div>
```

### 2. Vis altid ×antal på produkter (linje ~1293)
Ændr fra `p.quantity > 1 ? ` ×${p.quantity}` : ""` til altid at vise antal:
```tsx
{p.name} ×{p.quantity}
```

