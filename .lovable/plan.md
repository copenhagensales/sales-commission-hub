
# Fix: Adversus Rate Limit Fejl for Relatel_CPHSALES

## Problem
Integrationen **Relatel_CPHSALES** fejler konsekvent med "Rate Limit Adversus Excedido" - 10 fejl alene de seneste 2 dage.

## Root Cause Analyse

### 1. Samtidig API-kald
- **2 Adversus integrationer** kører begge hvert 5. minut (`*/5 * * * *`):
  - `Lovablecph` (26fac751)
  - `Relatel_CPHSALES` (657c2050)
- Når de overlapper, rammer den ene Adversus API rate limit

### 2. Manglende retry-logik i `get()` metoden
Den nuværende kode kaster fejl ved rate limit uden at forsøge igen:

```typescript
// adversus.ts linje 50-57
private async get(endpoint: string) {
  const res = await fetch(...);
  if (res.status === 429) throw new Error("Rate Limit Adversus Excedido"); // ← Fejler direkte
  ...
}
```

### 3. Ingen staggering af cron jobs
Begge jobs starter på samme minut, hvilket maximerer API-kollisioner.

## Løsning

### Ændring 1: Tilføj exponential backoff til `get()` metoden
I `supabase/functions/integration-engine/adapters/adversus.ts`:

```typescript
private async get(endpoint: string, retries = 3, baseDelay = 1000): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(`${this.baseUrl}/v1${endpoint}`, {
      headers: { Authorization: `Basic ${this.authHeader}`, "Content-Type": "application/json" },
    });
    
    if (res.status === 429) {
      if (attempt === retries) {
        throw new Error("Rate Limit Adversus Excedido (after retries)");
      }
      // Exponential backoff: 1s, 2s, 4s
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`[Adversus] Rate limited, waiting ${delay}ms before retry ${attempt}/${retries}`);
      await new Promise(r => setTimeout(r, delay));
      continue;
    }
    
    if (!res.ok) throw new Error(`Adversus API Error ${res.status}`);
    return await res.json();
  }
}
```

### Ændring 2: Tilføj retry til `fetchSalesSequential()` 
I samme fil, tilføj retry-logik når sales-pagination rammer rate limit:

```typescript
// I fetchSalesSequential() - omkring linje 565
if (res.status === 429) {
  console.log(`[Adversus] Rate limited on page ${page}, waiting 2s...`);
  await new Promise(r => setTimeout(r, 2000));
  continue; // Retry same page
}
```

### Ændring 3: Tilføj retry til lead-fetching
I `buildLeadDataMap()` - omkring linje 363:

```typescript
// Tilføj retry ved rate limit på kampagne lead-fetch
if (res.status === 429) {
  console.log(`[Adversus] Rate limited on campaign ${campaignId}, waiting 2s...`);
  await new Promise(r => setTimeout(r, 2000));
  // Retry campaign
  continue;
}
```

### Ændring 4: Øg delays mellem API calls
Nuværende delays er for korte:
- `fetchSalesSequential`: 50ms → **150ms**
- `buildLeadDataMap`: 100ms → **250ms**
- Fallback batch: 200ms → **400ms**

## Påvirkede filer
- `supabase/functions/integration-engine/adapters/adversus.ts`

## Forventet resultat
- Rate limit fejl vil blive håndteret automatisk med retry
- Synkroniseringer vil gennemføres selvom de kortvarigt rammer rate limit
- Færre fejl i integration logs

## Alternativ/Fremtidig forbedring
- Stagger cron jobs så de kører forskudt (f.eks. minut 0 og 2)
- Implementer cursor-baseret resumable sync for store datasæt

