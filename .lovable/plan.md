

# Fix: Vis leadResultFields data i SalesFeed

## Problem

Salget (external ID 1190085) har lead data gemt i `raw_payload.leadResultFields` (et objekt med key-value pairs), men `raw_payload.leadResultData` er et tomt array `[]`. SalesFeed tjekker KUN `leadResultData.length > 0` og ignorerer `leadResultFields` helt.

Database-vaerdier for dette salg:
- `leadResultData`: `[]` (tomt)
- `leadResultFields`: `{ "Sales ID": "36685603", "Tilskud": "0%", "Bindingsperiode": "36", ... }`

## Loesning

Udvid `renderLeadDataSection` i SalesFeed.tsx til ogsaa at konvertere `leadResultFields` (objekt-format) til visbare felter.

## Aendring

### Fil: `src/components/sales/SalesFeed.tsx` (linje ~536-544)

Tilfoej et ekstra check: hvis `leadResultData` er tomt men `leadResultFields` eksisterer som objekt, konverter det til array-format.

Foer:
```typescript
if (payload.leadResultData && payload.leadResultData.length > 0) {
  leadFields = payload.leadResultData;
} else if (payload.data && typeof payload.data === 'object') {
  leadFields = convertEnreachDataToFields(payload.data);
}
```

Efter:
```typescript
if (payload.leadResultData && payload.leadResultData.length > 0) {
  // Adversus array format
  leadFields = payload.leadResultData;
} else if (payload.leadResultFields && typeof payload.leadResultFields === 'object') {
  // Adversus object format (leadResultFields) - convert keys/values to display fields
  leadFields = Object.entries(payload.leadResultFields).map(([key, value]) => ({
    label: key,
    value: String(value ?? ""),
  }));
} else if (payload.data && typeof payload.data === 'object') {
  // Enreach/HeroBase format
  leadFields = convertEnreachDataToFields(payload.data);
}
```

### Hvad dette loeser

- Salg med data i `leadResultFields` (objekt-format) vises nu korrekt
- Salg med data i `leadResultData` (array-format) fungerer som foer
- Enreach-formatet (`data`) fungerer som foer
- Ingen database-aendringer noedvendige

### Sync-dialogen

Sync-knappen viser "Skipped: 1" fordi salget allerede har `enrichment_status: "complete"`. Healeren finder salget men der er intet at heale -- dataen er allerede tilstede i `leadResultFields`. Det er korrekt opfoersel. Problemet var kun i visningen.

