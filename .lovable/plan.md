
## Fix: Enreach-adapterens retry-logik er ikke opdateret

### Problem
Kun Adversus-adapteren og fail-fast guarden blev ændret i den forrige implementering. Enreach-adapterens `get()` metode kører stadig med de gamle værdier:
- `maxRetries = 5` (skal være 2)
- Max delay cap: `60000ms` (skal være 15000ms)
- Backoff base: `5000 * Math.pow(2, attempt)` = 5s, 10s, 20s, 40s, 80s

Dette betyder at hver Enreach-sync bruger ~120s på retries før fail-fast guarden overhovedet kan fange fejlen, fordi `fetchUsers` kalder `get()` internt og bruger alle 5 retries inden den kaster fejlen op.

### Ændring

**Fil: `supabase/functions/integration-engine/adapters/enreach.ts`** (linje 183-219)

3 ændringer i `get()` metoden:

```text
// Fra (linje 185):
const maxRetries = 5;

// Til:
const maxRetries = 2;

// Fra (linje 203):
const delay = this.addJitter(Math.min(baseDelay, 60000));

// Til:
const delay = this.addJitter(Math.min(baseDelay, 15000));

// Fra (linje 199, kommentar opdatering):
// Exponential backoff: 5s, 10s, 20s, 40s, 80s with jitter
const exponentialDelay = 5000 * Math.pow(2, attempt);

// Til:
// Exponential backoff: 3s, 6s with jitter (capped at 15s)
const exponentialDelay = 3000 * Math.pow(2, attempt);
```

### Forventet resultat
- Worst-case retry-tid falder fra ~155s til ~12s
- Fail-fast guarden i sync-integration.ts fanger 429 hurtigere
- Enreach-integrationerne (Eesy, Tryg, ASE) stopper med at vise "Kritisk" når API'et er tilgængeligt igen
- Adversus-ændringerne fra forrige fix er allerede aktive og fungerer korrekt
