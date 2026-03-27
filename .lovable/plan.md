

## Problem: `extractOpp` bruger hardcoded nøgler til OPP-udtræk

`extractOpp`-funktionen (linje 1156-1169) slår OPP-nummeret op i salgets `raw_payload` med **eksakte** nøgle-matches:
- `fields['OPP nr']` (mellemrum)
- `fields['OPP-nr']` (bindestreg)

Men den mangler varianter som `'OPP nr.'` (med punktum), `'OPP-nr.'`, eller andre formateringer. Samme type problem vi lige har løst på Excel-siden — men her på raw_payload-siden.

Ligeledes checker `leadResultData`-arrayet kun `label === 'OPP nr'` og `label === 'OPP-nr'` med eksakt match.

Når et salgs raw_payload har OPP-feltet under en nøgle der ikke matcher præcist (f.eks. `'OPP nr.'`), returnerer `extractOpp` tom streng → salget kan ikke matches mod Excel-filen.

### Løsning

Opdater `extractOpp` til at bruge den allerede eksisterende `getCaseInsensitive`-funktion (som nu har fuzzy matching) i stedet for hardcoded property access.

### Ændring

**Fil: `src/components/cancellations/UploadCancellationsTab.tsx`** — `extractOpp` (linje 1156-1169)

```typescript
const extractOpp = (rawPayload: unknown): string => {
  if (!rawPayload || typeof rawPayload !== 'object') return "";
  const rp = rawPayload as Record<string, unknown>;
  if (rp['legacy_opp_number']) return String(rp['legacy_opp_number']);
  
  const fields = rp['leadResultFields'] as Record<string, unknown> | undefined;
  if (fields) {
    const oppVal = getCaseInsensitive(fields, "OPP nr");
    if (oppVal) return String(oppVal);
  }
  
  const data = rp['leadResultData'] as Array<{label?: string; value?: string}> | undefined;
  if (Array.isArray(data)) {
    const normalize = (s: string) => s.toLowerCase().replace(/[-\s.]/g, "");
    const target = normalize("OPP nr");
    const found = data.find(d => d.label && normalize(d.label) === target);
    if (found?.value) return String(found.value);
  }
  return "";
};
```

`getCaseInsensitive` håndterer allerede fuzzy matching (ignorerer bindestreg/mellemrum/punktum), så ét kald med `"OPP nr"` vil matche `'OPP nr'`, `'OPP-nr'`, `'OPP nr.'`, `'OPP-nr.'` osv.

### Berørte filer
- `src/components/cancellations/UploadCancellationsTab.tsx` — én funktion ændres

### Risiko
**Meget lav** — bruger den samme fuzzy-logik vi allerede har implementeret, og `getCaseInsensitive` laver altid eksakt match først.

