

## Problem: TDC Erhverv OPP-matching virker ikke

### Årsag
Den gemte konfiguration "TDC Erhverv Standard" har `opp_column = "OPP nr."` (med mellemrum), men den uploadede Excel-fil har kolonnenavnet `"OPP-nr."` (med bindestreg). 

`getCaseInsensitive` gør kun case-insensitive opslag — den matcher **ikke** `"opp nr."` med `"opp-nr."`, fordi der er forskel på mellemrum vs. bindestreg. Resultatet er, at **ingen OPP-numre bliver udtrukket** fra Excel-filen, og hele OPP-matchingen springes over → 0 matches.

### Løsning
Gør kolonne-opslaget mere robust, så det også ignorerer forskelle i bindestreg/mellemrum/punktum ved lookup.

### Ændring

**Fil: `src/components/cancellations/UploadCancellationsTab.tsx`**

Opdater `getCaseInsensitive`-funktionen (linje ~111-118) til at normalisere nøgler ved at fjerne bindestreger, mellemrum og punktum før sammenligning:

```typescript
function getCaseInsensitive(obj: Record<string, unknown> | undefined, key: string): unknown {
  if (!obj) return undefined;
  // Exact case-insensitive match first
  const lowerKey = key.toLowerCase();
  for (const k of Object.keys(obj)) {
    if (k.toLowerCase() === lowerKey) return obj[k];
  }
  // Fuzzy: ignore hyphens, spaces, dots
  const normalize = (s: string) => s.toLowerCase().replace(/[-\s.]/g, "");
  const normKey = normalize(key);
  for (const k of Object.keys(obj)) {
    if (normalize(k) === normKey) return obj[k];
  }
  return undefined;
}
```

Med denne ændring vil `"OPP nr."`, `"OPP-nr."`, `"OPP nr"` og `"opp-nr"` alle matche hinanden, og TDC Erhverv-matchingen vil fungere igen uanset mindre formateringsforskelle i Excel-kolonnenavne.

### Berørte filer
- `src/components/cancellations/UploadCancellationsTab.tsx` — én funktion ændres

### Risiko
**Meget lav** — fuzzy-matching er kun et fallback efter det eksakte case-insensitive tjek, så eksisterende matches påvirkes ikke.

