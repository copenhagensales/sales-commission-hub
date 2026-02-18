
# Rate Limit Budget opdelt per API-provider med faktiske limits

## Oversigt

Opdel Rate Limit Budget-sektionen fra en enkelt global gauge til separate gauges per API-provider, med de faktiske rate limits fra Adversus og Enreach.

## Faktiske API-graenser

**Adversus:**
- 60 requests/minut (burst)
- 1.000 requests/time
- Max 2 samtidige requests

**Enreach:**
- Dynamiske daglige limits per service (hentes fra `/api/myaccount/request/limits`)
- Per-minut limit = Max(Ceiling(daglig limit / 1440), 240) naar fair use header sendes
- Kald taeller 8x i produktionstid (08-21) uden fair use header

Da vi ikke henter Enreach-limits dynamisk endnu, bruger vi konservative estimater som standard.

## Aendringer

### 1. SystemStability.tsx -- Budget-beregning per provider

Erstat den globale budget-beregning (linje 165-179) med provider-grupperet logik:

```typescript
const PROVIDER_BUDGETS: Record<string, { limitPerMin: number; limitPerHour: number }> = {
  adversus: { limitPerMin: 60, limitPerHour: 1000 },
  enreach: { limitPerMin: 240, limitPerHour: 10000 },
};
const DEFAULT_BUDGET = { limitPerMin: 60, limitPerHour: 1000 };
```

- Grupper sync runs/logs efter integration -> provider
- Beregn apiCalls for sidste 1 minut og sidste 60 minutter per provider
- Beregn procent brugt af hver providers faktiske limits
- Byg et `providerBudgets`-array:

```typescript
interface ProviderBudget {
  provider: string;
  integrationNames: string[];
  calls1m: number;
  limit1m: number;
  used1m: number;  // procent
  calls60m: number;
  limit60m: number;
  used60m: number; // procent
}
```

### 2. SystemStability.tsx -- UI opdeling (linje 282-316)

Erstat den enkelte Card med en Card per provider:

- Overskrift: Provider-navn (fx "Adversus") med faktiske limits i parentes
- Under-tekst: Navne paa integrationer der deler API'et (fx "Lovablecph, Relatel_CPHSALES")
- To progress bars: Per minut (burst) og per time
- Farve-kodning som i dag (groen/gul/roed)

### 3. useStabilityAlerts.ts -- Budget-alerts per provider

Aendr hook-signaturen:

```typescript
interface ProviderBudget {
  provider: string;
  used1m: number;
  used60m: number;
}

interface UseStabilityAlertsParams {
  integrationMetrics: IntegrationMetric[];
  providerBudgets: ProviderBudget[];
}
```

- Fjern de gamle `budgetUsed15m`/`budgetUsed60m` parametre
- Erstat de 4 globale budget-checks (linje 142-185) med et loop over `providerBudgets`
- Alert-beskeder inkluderer provider-navn: fx "Adversus: Burst limit (1m) er 92% brugt"
- Behold samme taerskler: warning ved 70%, critical ved 90%

### Filer der redigeres
- `src/pages/SystemStability.tsx` -- budget-beregning og UI
- `src/hooks/useStabilityAlerts.ts` -- hook-parametre og budget-checks

### Ingen nye filer eller database-aendringer
