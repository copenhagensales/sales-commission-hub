

## Fix: rematch-pricing-rules laeser leadResultFields for Relatel

### Problemet (verificeret med data)
Relatel-salg gemmer "Tilskud" i `raw_payload.leadResultFields`, men rematch-funktionen laeser KUN `raw_payload.data` (som er `null` for Relatel). Derfor matcher prisregler med `conditions: { "Tilskud": "0%" }` aldrig, og salg falder til lavere fallback-priser.

### Bevis fra databasen
- `raw_payload.data` = `null` for Relatel-salg
- `raw_payload.leadResultFields` = `{ "Tilskud": "0%", "Bindingsperiode": "36", ... }`
- 65+ prisregler med Tilskud-betingelse (priority 5) springer over, fallback (priority 0) bruges

### Paavirkede produkter
Switch Contact Center og MBB-varianter (ATL/BTL) - alle med Tilskud-differentierede prisregler.

### Upaavirkede produkter
ASE-produkter (bruger `raw_payload.data` som allerede virker), alle andre klienter.

### Aendring (1 fil, ca. 15 linjer)

**Fil:** `supabase/functions/rematch-pricing-rules/index.ts`

Paa linje 339-340, efter extraction af `rawPayloadData`, tilfoej merge af `leadResultFields` og `leadResultData`:

```text
// Nuvaerende (linje 340):
let rawPayloadData = rawPayload?.data as Record<string, unknown> | undefined;

// Tilfoej efter linje 340:
const leadResultFields = rawPayload?.leadResultFields as Record<string, unknown> | undefined;
const leadResultData = rawPayload?.leadResultData as Record<string, unknown> | undefined;

// Merge leadResultFields ind i rawPayloadData (saa conditions kan finde Tilskud)
if (leadResultFields && typeof leadResultFields === "object") {
  if (!rawPayloadData) rawPayloadData = {};
  for (const [key, value] of Object.entries(leadResultFields)) {
    if (value !== null && value !== undefined && value !== "") {
      rawPayloadData[key] = value;
    }
  }
}
if (leadResultData && typeof leadResultData === "object") {
  if (!rawPayloadData) rawPayloadData = {};
  for (const [key, value] of Object.entries(leadResultData)) {
    if (value !== null && value !== undefined && value !== "") {
      rawPayloadData[key] = value;
    }
  }
}
```

### Resultat efter fix
- Prisregler med `Tilskud: 0%` (priority 5) vil nu matche korrekt for Relatel-salg
- Switch og MBB-produkter faar de rigtige provisioner
- ASE og alle andre klienter er helt upaavirkede (deres data-struktur aendres ikke)

### Anbefalet test
1. Deploy fix
2. Koer `dry_run: true` for et enkelt Switch-produkt og verificer at Tilskud-regler matcher
3. Koer uden dry_run naar resultat er bekraeftet

