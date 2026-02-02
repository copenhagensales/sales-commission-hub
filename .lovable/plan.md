
# Fix: Manglende Lead Data for salg

## Problem
Salget fra screenshottet (Lead: 960554083, Opportunity: 1198157) viser "Lead data ikke modtaget fra kildesystemet" fordi `leadResultData` er tom `[]`.

## Root Cause Analyse

### 1. Feltnavn mismatch
Adversus API returnerer lead result data med **`label`** property:
```json
{"id": 74539, "label": "Er OA gennemgået?", "value": "JA"}
```

Men koden i `buildLeadDataMap()` søger efter **`name`** property:
```typescript
// Linje 393 i adversus.ts
if (field && field.name !== undefined) {
  resultFields[field.name] = field.value;
}
```

### 2. Kampagne 101396 har ingen lead data
- Kampagnenavn: "CPH Sales - Blandet"
- 31 salg total, 0 med lead data (0% coverage)
- Bulk lead fetch inkluderer denne kampagne, men Adversus API returnerer tom `resultData` for disse leads

### 3. Sammenligning med fungerende kampagner
| Kampagne | Navn | Total | Med data | Coverage |
|----------|------|-------|----------|----------|
| 105958 | CPH Sales - Switch Krydssalgs | 363 | 293 | 81% |
| 101396 | CPH Sales - Blandet | 31 | 0 | **0%** |
| 98374 | Cph Sales - Google 1-5 | 77 | 0 | **0%** |

## Løsning

### Ændring 1: Ret feltnavn i `buildLeadDataMap`
I `supabase/functions/integration-engine/adapters/adversus.ts` (linje 391-407):

```typescript
// NUVÆRENDE (fejler for label)
if (field && field.name !== undefined) {
  resultFields[field.name] = field.value;
}

// RETTET (støtter både name og label)
const fieldName = field.name || field.label;
if (field && fieldName !== undefined) {
  resultFields[fieldName] = field.value;
}
```

### Ændring 2: Ret også i fallback-logikken
I samme fil (linje 456-469), samme rettelse for individuel lead fetch.

### Ændring 3: Gem også label-baserede felter i resultData
Sørg for at `resultData` gemmes korrekt med label info:

```typescript
// Linje 385: Ændre type til at inkludere label
const resultData: Array<{ 
  id: number; 
  name?: string; 
  label?: string; 
  type?: string; 
  value: any 
}> = lead.resultData || [];
```

## Påvirkede filer
- `supabase/functions/integration-engine/adapters/adversus.ts`

## Forventet resultat efter fix
- Fremtidige synkroniseringer vil korrekt gemme lead data med label-baserede felter
- **OBS**: Eksisterende salg med tom `leadResultData` kræver re-sync for at få data

## Re-sync af historiske data
Efter deployment kan du køre en repair sync:
```
POST /integration-engine
{
  "source": "adversus",
  "action": "repair-history",
  "days": 30
}
```

## Alternativ: Manuelt tjek i Adversus
Hvis kampagne 101396 slet ikke har result fields konfigureret i Adversus admin panel, vil der aldrig komme lead data. Dette skal verificeres direkte i Adversus.
