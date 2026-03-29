

## Plan: Vis produktnavn i Annulleringsdata

### Problem
Produktfeltet (f.eks. "Subscription Name") vises ikke i Annulleringsdata-sektionen, fordi `.slice(0, 6)` afskærer felter ud over de første 6.

### Løsning

**Fil:** `src/components/cancellations/LocateSaleDialog.tsx` (linje 262-263)

Fjern `.slice(0, 6)` begrænsningen og vis alle felter fra `rowData` (ekskl. `_product_rows`). Alternativt kan vi øge grænsen eller prioritere produkt-relaterede felter.

Simpleste tilgang: Vis alle felter i stedet for kun 6, da de allerede er i en flex-wrap container med badges:

```typescript
{Object.entries(row.rowData)
  .filter(([k]) => k !== "_product_rows")
  .map(([key, val]) => (
    <Badge key={key} variant="outline" className="text-xs font-normal">
      {key}: {val != null ? String(val) : "-"}
    </Badge>
  ))}
```

### Teknisk detalje
- Ændringen er minimal: fjern `.slice(0, 6)` fra linje 263
- Alle Excel-felter fra rækken vises nu, inkl. "Subscription Name" o.lign.
- Layout håndteres allerede af `flex-wrap`

### Fil
- `src/components/cancellations/LocateSaleDialog.tsx`

