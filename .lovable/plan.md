

# Rate Limit Budget per integration (ikke per provider)

## Problem

Den nuvaerende implementering grupperer integrationer per provider-type (alle Adversus sammen, alle Enreach sammen). Men i virkeligheden har hver integration sine egne API-credentials og dermed sit eget uafhaengige rate limit:

- **Lovablecph** (Adversus / TDC) -- eget API, eget budget
- **Relatel_CPHSALES** (Adversus / Relatel) -- eget API, eget budget
- **ASE** (Enreach) -- eget API, eget budget
- **Eesy** (Enreach) -- eget API, eget budget
- **Tryg** (Enreach) -- eget API, eget budget

## Loesning

Aendr budgetberegningen fra provider-gruppering til **per-integration**, hvor hver integration faar sin egen gauge med de korrekte limits baseret paa dens provider-type.

## Aendringer

### 1. SystemStability.tsx -- Beregning per integration

Erstat `providerMap`-grupperingen (linje 176-200) med et loop over hver enkelt integration:

- Hver integration faar sin egen budget-entry
- Limits bestemmes stadig af provider-type (Adversus: 60/min, 1000/time; Enreach: 240/min, 10000/time)
- `calls1m` og `calls60m` beregnes kun fra den paagaeldende integrations sync runs

### 2. SystemStability.tsx -- UI

Aendr Rate Limit Budget sektionen:

- Vis en Card per integration (ikke per provider)
- Overskrift: Integrationsnavn (fx "Lovablecph")
- Under-tekst: Provider-type og limits (fx "Adversus -- 60/min, 1000/time")
- To progress bars: Burst (1 min) og Time (60 min)

### 3. useStabilityAlerts.ts -- Alerts per integration

- `providerBudgets`-arrayet indeholder nu en entry per integration
- Alert-beskeder bruger integrationsnavnet (fx "Lovablecph: Burst limit (1m) er 92% brugt")

### Filer der redigeres
- `src/pages/SystemStability.tsx` -- budget-beregning og UI
- `src/hooks/useStabilityAlerts.ts` -- type-opdatering (provider -> integrationsnavn)

### Ingen nye filer eller database-aendringer

