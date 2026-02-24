
# Fix: Enrichment-healer bygger ikke leadResultFields korrekt fra API-svar

## Problem

Healeren henter lead data fra Adversus API, men:

1. **API'et returnerer `resultData`** (et array af objekter med `{id, name, value}`), men returnerer IKKE `resultFields` (et key-value objekt)
2. Healeren tjekker `leadData.resultFields` som ikke eksisterer i API-svaret, og faar derfor `{}`
3. Healeren gemmer det tomme objekt og overskriver `leadResultFields` med `{}`
4. Resultatet er at salget markeres som "healed" men stadig viser "Lead data ikke modtaget"

Integration-engine adapteren (adversus.ts linje 586-606) haandterer dette korrekt ved at **bygge** `resultFields` manuelt fra `resultData`-arrayet.

## Loesning

Opdater `healAdversus()` i `supabase/functions/enrichment-healer/index.ts` til at:

1. Bygge `resultFields` fra `resultData`-arrayet (som adapteren goer)
2. Kun markere som "healed" hvis der faktisk er data

### Aendring i `supabase/functions/enrichment-healer/index.ts` (linje 114-123)

Foer:
```typescript
const leadData = await response.json();
const leadResultFields = leadData.resultFields || leadData.leadResultFields || {};
const leadResultData = leadData.resultData || leadData.leadResultData || [];

const updatedPayload = {
  ...rawPayload,
  leadResultFields,
  leadResultData,
};
```

Efter:
```typescript
const leadData = await response.json();
const leadResultData = leadData.resultData || leadData.leadResultData || [];

// Build leadResultFields from resultData array (same logic as integration-engine adapter)
const leadResultFields: Record<string, any> = {};
if (Array.isArray(leadResultData)) {
  for (const field of leadResultData) {
    const fieldName = field?.name || field?.label;
    if (field && fieldName !== undefined) {
      leadResultFields[fieldName] = field.value;
    }
  }
}

// Only mark as healed if we actually got data
if (leadResultData.length === 0 && Object.keys(leadResultFields).length === 0) {
  throw new Error("API returned empty lead data");
}

const updatedPayload = {
  ...rawPayload,
  leadResultFields,
  leadResultData,
};
```

### Hvad dette loeser

- `leadResultFields` bygges korrekt fra API-svarets `resultData`-array (fx "Tilskud", "Sales ID", "Bindingsperiode")
- Salg markeres kun som "healed" hvis data faktisk blev hentet
- Eksisterende salg med tom `leadResultFields` kan re-heales ved at nulstille deres `enrichment_status`
- Logikken matcher nu praecis hvad integration-engine adapteren goer

### Efterfoelgende handling

Det allerede "healede" salg (1206846) skal have sin `enrichment_status` sat tilbage til "pending" saa healeren koerer igen med den rettede kode. Dette kan goeres via "Sync single sale"-knappen.
