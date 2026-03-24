

# Optimeret TDC OPP Backfill — færdig på ~30 minutter

## Nuværende estimat
- 1.5s delay × 20 per batch = 30s per kald, 44 kørsler → mange timer/aftener

## Optimeret setup
Adversus API-grænser: **60 req/min**, **1000 req/hr**. Vi har 873 leads at hente — det passer i ét time-vindue med margin.

### Ændringer i `tdc-opp-backfill/index.ts`

1. **Delay ned til 1.05s** — giver ~57 req/min, sikkert under 60/min-grænsen
2. **Batch op til 50** — hvert kald tager ~53s (under edge function timeout på 60s)
3. **Auto-continue mode** — funktionen kalder sig selv via `fetch()` hvis der er flere salg, med 5s pause mellem batches for at undgå burst
4. Returnerer stadig `{ processed, remaining, done }` så man kan følge med

### Beregning
- 873 salg ÷ 50 per batch = **18 kørsler**
- Hver kørsel: ~53s execution + 5s pause = ~58s
- Total: **~18 minutter** wall time
- API-forbrug: 873 kald i timen (under 1000-grænsen)

### Alternativ: Manuel loop uden auto-continue
Hvis vi ikke vil have self-invocation, kan vi i stedet lave et simpelt frontend-loop der kalder funktionen 18 gange med 10s interval. Samme resultat, ~20 min.

## Filer
- **Ny**: `supabase/functions/tdc-opp-backfill/index.ts` — med `batchSize: 50`, `delay: 1050ms`, optional `autoRun: true` for self-continuation
- **Opdater**: `supabase/config.toml` — tilføj funktionen

## Kørsel
```js
// Ét kald starter hele processen — den fortsætter selv
await supabase.functions.invoke('tdc-opp-backfill', { 
  body: { batchSize: 50, autoRun: true } 
})
```
Eller manuelt gentag uden `autoRun` til `done: true`.

