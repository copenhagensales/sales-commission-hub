

## Preventiv retry-reduktion for Adversus-adapteren

### Baggrund
Adversus-adapteren har p.t. 6 retries med 10s exponential backoff i `get()`, hvilket giver en worst-case ventetid pa ~310 sekunder. Dette overstiger edge function timeout (~50s) markant. Selvom staggering-fix og provider-sync locking holder 429-fejl nede, vil en enkelt rate-limit udlose samme cascade-problem som vi netop har fixet for Enreach.

### Aendringer

**Fil: `supabase/functions/integration-engine/adapters/adversus.ts`**

3 steder skal justeres:

**1. `get()` metoden (linje 84)**
- `retries`: 6 -> 3
- `baseDelay`: 10000 -> 5000
- Max delay cap: tilfoej `Math.min(..., 20000)` sa worst case = 5+10+20 = ~35s (under timeout)

**2. `fetchSales` pagineringens retry-loop (linje 697-720)**
- `maxRetries`: 6 -> 3
- Base delay: 10000 -> 5000
- Max delay: tilfoej cap pa 20000ms

**3. `fetchCalls` pagineringens retry-loop (linje 880-900)**
- `maxRetries`: 5 -> 3
- Max delay cap: 60000 -> 20000

**Fil: `supabase/functions/integration-engine/actions/sync-integration.ts`**

Udvid den eksisterende Enreach-scopede fail-fast guard til ogsa at daekke Adversus:

```text
const provider = (source || integration.provider || "").toLowerCase();
if (provider === "enreach" || provider === "adversus") {
  const earlyMetrics = adapter.getMetrics();
  if (earlyMetrics.rateLimitHits > 0) {
    log("WARN", `${provider} rate limit detected...`);
    throw new Error(`${provider} rate limited during meta sync, aborting`);
  }
}
```

### Oversigt

| Adapter | Retries for | Retries efter | Worst-case for | Worst-case efter |
|---------|------------|--------------|----------------|-----------------|
| Enreach get() | 5 | 2 | ~155s | ~12s |
| Adversus get() | 6 | 3 | ~310s | ~35s |
| Adversus fetchSales | 6 | 3 | ~310s | ~35s |
| Adversus fetchCalls | 5 | 3 | ~155s | ~35s |

### Hvorfor 3 retries for Adversus (vs 2 for Enreach)
- Adversus korer pa 5-min cron interval (vs 3-min for Enreach), sa der er mere plads
- 35s worst case er stadig under edge function timeout (~50s)
- Giver lidt mere resilience for transiente fejl

### Forventet resultat
- Ingen Adversus-sync vil nogensinde time ud pa retries
- Fail-fast guard forhindrer cascade hvis 429 rammer under meta-sync
- Eksisterende staggering og provider-sync locking forbliver uaendret
- Systemet er konsistent beskyttes mod retry-cascade pa tvaers af begge providers

