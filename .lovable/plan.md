
# Tilfoej burst-throttling til Adversus-adapteren

## Problem
Adversus-adapteren sender API-kald i hurtig raekkefoelge uden pause. Relatel-kontoen har tilsyneladende en lavere burst-graense, hvilket udloeser 429-fejl selv med faa kald totalt.

## Loesning
Tilfoej en 500ms pause **efter hvert succesfuldt API-kald** i `get()`-metoden. Da `get()` er den eneste gateway for alle Adversus API-kald, daekker dette automatisk alle operationer (sales, users, campaigns, calls, sessions, lead enrichment).

## AEndring

### Fil: `supabase/functions/integration-engine/adapters/adversus.ts`

Tilfoej en `lastRequestTime`-tracker og en `throttle()`-metode, der venter minimum 500ms mellem kald:

```text
// Ny property paa klassen (efter linje 18):
private lastRequestTime = 0;
private throttleMs = 500;

// Ny metode:
private async throttle(): Promise<void> {
  const elapsed = Date.now() - this.lastRequestTime;
  if (elapsed < this.throttleMs) {
    await new Promise(r => setTimeout(r, this.throttleMs - elapsed));
  }
  this.lastRequestTime = Date.now();
}

// I get()-metoden (linje 86, foer fetch-kaldet):
await this.throttle();
```

### Forventet effekt
- Maks ~2 API-kald pr. sekund i stedet for ubegreanset burst
- Reducerer 429-fejl for Relatel uden at pavirke overall throughput vaesentligt
- Foerste kald har ingen ventetid (lastRequestTime = 0)
