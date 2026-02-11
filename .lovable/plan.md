

## Optimering af `calculate-kpi-values` - Stop Timeout-problemet

### Problem
Funktionen timer konsekvent ud med "CPU Time exceeded" fordi den proever at beregne ALT i een koersel:
- Global KPIs (alle definitioner x 4 perioder)
- Client-scoped KPIs (6 slugs x alle klienter x 4 perioder = hundredvis af DB-queries)
- Employee-scoped KPIs
- Liga KPIs
- Global leaderboards (henter 8000+ salg x 4 perioder)
- Team leaderboards (N teams x 4 perioder)
- Client leaderboards (N klienter x 4 perioder)

**Kritisk fejl**: KPI cached values gemmes foerst paa linje 873 - EFTER alle leaderboards. Naar funktionen timer ud under client-leaderboards, gaar ALLE beregnede KPI-vaerdier tabt (inklusiv Tryg's data).

### Loesning: Progressiv gemning + chunk-baseret request
To aendringer:

**1. Gem KPI-vaerdier progressivt (quick fix)**
Gem cached values i batches efterhaanden som de beregnes, ligesom leaderboards allerede goer:
- Gem global KPIs straks efter beregning
- Gem client-scoped KPIs per klient (eller i batches)
- Gem employee KPIs straks efter beregning

Dette sikrer at selvom funktionen timer ud sent i processen, er alle KPI-vaerdier allerede gemt.

**2. Chunk-parameter for opdelt koersel**
Tilfoej en `chunk` parameter saa cron-jobbet kan kalde funktionen i dele:
- `chunk: "kpis"` - kun global + client + employee KPIs
- `chunk: "leaderboards-global"` - kun globale + team leaderboards
- `chunk: "leaderboards-client"` - kun client leaderboards
- Uden chunk = alt (bagudkompatibel)

Cron-jobbet opdateres til at kalde funktionen 3 gange i stedet for 1.

### Tekniske detaljer

**Fil: `supabase/functions/calculate-kpi-values/index.ts`**

Aendring 1 - Flyt KPI-gem til lige efter beregning:
```text
Nuvaerende flow:
  Beregn global KPIs -> (holder i memory)
  Beregn client KPIs -> (holder i memory)  
  Beregn employee KPIs -> (holder i memory)
  Beregn liga KPIs -> (holder i memory)
  Beregn alle leaderboards -> (gemmer progressivt)
  Gem ALLE KPI values -> (her timer den ud)

Nyt flow:
  Beregn global KPIs -> GEM STRAKS
  Beregn client KPIs -> GEM PER BATCH
  Beregn employee KPIs -> GEM STRAKS
  Beregn liga KPIs -> GEM STRAKS
  Beregn leaderboards -> (gemmer progressivt, som nu)
```

Aendring 2 - Chunk-parameter:
```text
// Request body:
{ "chunk": "kpis" }           // Global + client + employee KPIs
{ "chunk": "leaderboards" }   // Alle leaderboards
// Ingen chunk = alt (default)
```

Aendring 3 - Opdater cron-job:
```text
Nuvaerende: 1 kald hvert 30. minut
Nyt: 2 kald hvert 30. minut (forskudt med 5 min)
  - */30 * * * * -> chunk=kpis
  - 5,35 * * * * -> chunk=leaderboards
```

### Prioritering
Aendring 1 (progressiv gemning) er den vigtigste - den loeser Tryg-problemet og sikrer at data aldrig gaar tabt. Aendring 2+3 reducerer risikoen for timeout yderligere ved at dele arbejdet op.

