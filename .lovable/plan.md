
# Plan: Vis Lead Data fra Enreach/HeroBase i UI

## Problem
ASE-salg (og andre Enreach-integrationer) har **33+ felter** gemt i databasen, men UI'en viser "Lead data ikke modtaget" fordi den kun tjekker for Adversus-formatet (`leadResultData`).

### Data Forskelle
| Dialer | Datastruktur | Eksempel |
|--------|--------------|----------|
| **Adversus** | `raw_payload.leadResultData[]` | `[{label: "Tilskud", value: "100%"}, ...]` |
| **Enreach** | `raw_payload.data{}` | `{Forening: "Fagforening", Lønsikring: "Udvidet", ...}` |

## Løsning

Opdater `renderLeadDataSection` i `SalesFeed.tsx` til at håndtere begge formater.

### Ændringer i `src/components/sales/SalesFeed.tsx`

**1. Tilføj hjælpefunktion til at konvertere Enreach data:**
```typescript
// Konverter Enreach data object til array format
const convertEnreachDataToFields = (data: Record<string, unknown>): LeadResultField[] => {
  const excludeKeys = ['uniqueId', 'campaignId', 'status', 'closure', 'lastModifiedTime'];
  return Object.entries(data)
    .filter(([key]) => !excludeKeys.includes(key))
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => ({
      label: key,
      value: String(value)
    }));
};
```

**2. Opdater `renderLeadDataSection` (ca. linje 505-575):**
```typescript
const renderLeadDataSection = (sale: Sale) => {
  const payload = sale.raw_payload;
  if (!payload) return null;
  
  // Check for Adversus format first, then Enreach format
  let leadFields: LeadResultField[] = [];
  
  if (payload.leadResultData && payload.leadResultData.length > 0) {
    // Adversus format
    leadFields = payload.leadResultData;
  } else if (payload.data && typeof payload.data === 'object') {
    // Enreach/HeroBase format - convert to array
    leadFields = convertEnreachDataToFields(payload.data as Record<string, unknown>);
  }
  
  const hasLeadData = leadFields.length > 0;
  const isExpanded = expandedSaleIds.has(sale.id);
  const fieldCount = leadFields.length;
  
  const buttonLabel = hasLeadData 
    ? `${isExpanded ? "Skjul" : "Vis"} lead data (${fieldCount})`
    : `${isExpanded ? "Skjul" : "Vis"} salgsinfo`;
  
  return (
    <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(sale.id)}>
      {/* ... eksisterende trigger ... */}
      <CollapsibleContent>
        {hasLeadData ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 mt-3 pt-3 border-t text-sm">
            {leadFields.map((field, idx) => (
              <div key={idx} className="space-y-0.5 min-w-0">
                <p className="text-xs text-muted-foreground truncate">{field.label}</p>
                <p className="font-medium truncate text-sm" title={field.value || "-"}>
                  {field.value || "-"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          {/* ... eksisterende fallback ... */}
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};
```

## Forventet Resultat

Efter ændringen vil ASE-salg vise alle 33+ felter:
- Forening: "Fagforening med lønsikring"
- Lønsikring: "Lønsikring Udvidet"
- Email: ibenraskheuck@gmail.com
- Telefon: 004560456542
- Osv...

## Påvirkede Integrationer
- ✅ ASE (Enreach)
- ✅ Tryg (Enreach)
- ✅ Eesy (Enreach)
- ✅ Alle andre HeroBase-baserede integrationer
- ✅ Adversus (eksisterende funktionalitet bevares)

---

### Teknisk Note
Dette er en ren frontend-ændring. Backend gemmer allerede dataene korrekt - UI'en skal blot læse fra det rigtige felt baseret på integrations-type.
