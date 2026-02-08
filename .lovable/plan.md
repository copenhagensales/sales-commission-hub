
# Plan: Optimer "Hent sample-felter" Hastighed

## Problem

"Hent sample-felter" tager ~30 sekunder fordi den:
1. Henter alle 586 salg fra de sidste 7 dage
2. Kalder `buildLeadDataMap()` som henter 40.000+ leads fra alle kampagner
3. Alt dette bare for at ekstraktere feltstruktur fra 10 salg

```text
┌─────────────────────────────────────────────────────────────────┐
│  Nuværende Flow (Langsom)                                       │
├─────────────────────────────────────────────────────────────────┤
│  1. Hent alle salg (7 dage) ────────────► ~586 salg             │
│  2. Hent users ─────────────────────────► 1 API kald            │
│  3. buildLeadDataMap() ─────────────────► 40.000+ leads         │
│     └── 7 kampagner × 5000 leads hver                           │
│  4. Brug kun 10 salg til felt-analyse                           │
│                                                                 │
│  Total tid: ~30 sekunder                                        │
└─────────────────────────────────────────────────────────────────┘
```

## Løsning

Tilføj en ny **lightweight metode** til AdversusAdapter der kun henter rå salgsdata uden berigelse:

```text
┌─────────────────────────────────────────────────────────────────┐
│  Nyt Flow (Hurtigt)                                             │
├─────────────────────────────────────────────────────────────────┤
│  1. Kald adapter.fetchSalesRaw(limit: 20)                       │
│     └── Hent kun 20 rå salg fra /orders endpoint                │
│     └── SPRING buildLeadDataMap() OVER                          │
│  2. Ekstraher felter fra raw payload                            │
│                                                                 │
│  Total tid: ~2-3 sekunder                                       │
└─────────────────────────────────────────────────────────────────┘
```

## Ændringer

### 1. Tilføj `fetchSalesRaw()` metode til AdversusAdapter

Ny metode der kun henter rå salgsdata uden lead-berigelse:

```typescript
// I adapters/adversus.ts
async fetchSalesRaw(limit: number = 20): Promise<any[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);
  
  const filterStr = encodeURIComponent(JSON.stringify({ 
    created: { $gt: startDate.toISOString() } 
  }));
  
  // Hent kun én side med begrænsning
  const data = await this.get(`/orders?filters=${filterStr}&pageSize=${limit}`);
  return data.orders || [];
}
```

### 2. Opdater DialerAdapter interface

Tilføj optional `fetchSalesRaw` metode til interface:

```typescript
// I adapters/interface.ts
interface DialerAdapter {
  // ... eksisterende metoder
  fetchSalesRaw?(limit?: number): Promise<any[]>;
}
```

### 3. Opdater fetchSampleFields action

Brug den nye lightweight metode:

```typescript
// I actions/fetch-sample-fields.ts
// Før:
const sales = await adapter.fetchSales(7);

// Efter:
let rawPayloads: Record<string, unknown>[];

if (adapter.fetchSalesRaw) {
  // Hurtig vej: Hent kun rå salg uden berigelse
  const rawSales = await adapter.fetchSalesRaw(20);
  rawPayloads = rawSales;
} else {
  // Fallback: Brug eksisterende metode
  const sales = await adapter.fetchSales(7);
  rawPayloads = sales.slice(0, 10).map(s => s.rawPayload);
}
```

## Forventet Resultat

| Metric | Før | Efter |
|--------|-----|-------|
| API kald | ~10+ (users, sales, 7 campaigns) | 1 (kun sales) |
| Data hentet | 40.000+ leads | 20 salg |
| Tid | ~30 sekunder | ~2-3 sekunder |

## Filer der ændres

1. `supabase/functions/integration-engine/adapters/interface.ts` - Tilføj optional metode
2. `supabase/functions/integration-engine/adapters/adversus.ts` - Implementer `fetchSalesRaw()`
3. `supabase/functions/integration-engine/adapters/enreach.ts` - Implementer `fetchSalesRaw()` (hvis relevant)
4. `supabase/functions/integration-engine/actions/fetch-sample-fields.ts` - Brug ny metode
