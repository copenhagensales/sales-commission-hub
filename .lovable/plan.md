

# System Stability: To faner + Komplet live arkitekturdiagram

## Oversigt

Opdel `/system-stability` i to faner og byg et visuelt laekker arkitekturdiagram der viser ALLE grene i systemet -- med live statusfarver og advarsel naar data-throughput er for hoejt.

## Fane 1: "Systemstabilitet"

Alt eksisterende indhold flyttes hertil uaendret:
- Status-kort, budget gauges, timeline, schedule editor, sync runs, data health, audit log

## Fane 2: "System Opsaetning"

### Nyt: `SystemArchitectureDiagram.tsx`

Et visuelt diagram der viser hele systemets dataflow med alle grene. Bygget med CSS Grid + glassmorphism cards + animerede SVG-forbindelseslinjer.

### Alle grene i diagrammet

**Lag 1 -- Eksterne kilder (venstre):**

```text
Adversus API        (brugt af: Lovablecph, Relatel)
Enreach API         (brugt af: ASE, Eesy, Tryg)
---
Adversus Webhook    (passiv indgaaende)
Dialer Webhook      (passiv indgaaende)
Economic Webhook    (e-conomic faktura)
Zapier Webhook      (rekruttering)
Twilio              (opkald/SMS)
```

**Lag 2 -- Processing (midte):**

```text
Integration Engine  (edge function -- central orchestrator)
  - Adversus Adapter
  - Enreach Adapter
  - Rate Limiter
  - Smart Backfill

Webhook Processors
  - adversus-webhook
  - dialer-webhook
  - economic-webhook
  - zapier-webhook
  - twilio-webhook
```

**Lag 3 -- Database (midte-hoejre):**

```text
sales + sale_items
integration_logs
integration_sync_runs
adversus_events
```

**Lag 4 -- Scheduling + KPI Engine:**

```text
pg_cron Scheduler
  - Triggers integration-engine per integration
  - Triggers KPI-beregning

KPI Engine (edge functions)
  - calculate-kpi-incremental
  - calculate-kpi-values
  - calculate-leaderboard-incremental
```

**Lag 5 -- Output:**

```text
Cache tabeller
  - kpi_cached_values
  - kpi_leaderboard_cache

Klient Dashboards
  - Eesy TM / FM
  - TDC Erhverv
  - Relatel / Tryg
  - TV Boards
```

### Live data i hvert kort

Hvert kort i diagrammet faar:
- **Statusfarve** (emerald/amber/red glow-border) baseret paa realtidsdata
- **Mini-metriker**: API-kald, succes-rate, seneste koersel
- **Pulserende animation** paa aktive forbindelser

### Throughput-advarsel (nyt)

Diagrammet viser advarsler naar data-throughput er for hoejt:

1. **Per-integration overload**: Hvis `used1m > 80%` eller `used60m > 80%`, faar forbindelseslinjen fra den integration en roed pulserende animation + et advarselsbadge "Overbelastet"
2. **Systemwid throughput**: Summer alle API-kald paa tvaers af integrationer. Vis et samlet throughput-gauge oeverst i diagrammet med:
   - Graen: < 50% af samlet kapacitet
   - Amber: 50-80%
   - Roed: > 80% -- med tekst "System naermer sig kapacitetsgraense"
3. **Database-belastning**: Vis antal records processed (fra sync runs) per time som en mini-graf, saa man kan se om der skydes for meget data ind

### UI-design

- **Glassmorphism cards**: `backdrop-blur-xl bg-card/60 border border-border/50` med farvet glow
- **Animerede SVG-linjer**: Dashed stroke med CSS `stroke-dashoffset` animation. Farve matcher status
- **Pulserende noder**: Aktive integrationer har en bloed pulse-ring animation
- **Gradient header** paa hvert lag med subtil baggrund
- **Hover-effekt**: Hover paa et kort highlighter alle forbundne linjer og kort
- **Responsivt**: Desktop = horisontal flow, tablet/mobil = vertikal stack

### Supplerende komponenter under diagrammet

- `<LiveCronStatus />` -- viser pg_cron jobs vs. konfiguration
- `<WebhookActivity />` -- viser webhook-trafik (24t)

## Teknisk implementering

### Filer der aendres

| Fil | Aendring |
|-----|----------|
| `src/pages/SystemStability.tsx` | Tilfoej Tabs wrapper, flyt indhold til fane 1, tilfoej fane 2 |
| `src/components/system-stability/SystemArchitectureDiagram.tsx` | **NY** -- hele diagrammet |

### Ingen andre filer roeres

- Alle eksisterende komponenter forbliver uaendrede
- Hooks og data-fetching forbliver i `SystemStability.tsx` og deles mellem faner
- Ingen nye dependencies -- bruger Tailwind, Lucide icons, native SVG

### Data til diagrammet

Genbruger eksisterende queries fra `SystemStability.tsx`:
- `integrations` -- liste over aktive integrationer med provider-type
- `integrationMetrics` -- succes-rate, 429-rate, varighed per integration
- `integrationBudgets` -- API-forbrug vs. limits per integration
- `syncRuns` -- seneste koersler (records processed, api calls)

Props til `SystemArchitectureDiagram`:

```text
interface Props {
  integrations: Array<{ id, name, provider, last_sync_at, last_status }>
  metrics: Array<{ id, successRate1h, rateLimitRate15m, avgDurationMs, totalApiCalls15m }>
  budgets: Array<{ provider, providerType, used1m, used60m, calls1m, calls60m, limit1m, limit60m }>
  syncRuns: Array<{ records_processed, api_calls_made, rate_limit_hits, started_at }>
}
```

### Throughput-beregning

```text
// Samlet system-throughput
totalCalls1m = sum(budgets.map(b => b.calls1m))
totalLimit1m = sum(budgets.map(b => b.limit1m))
systemUsage = totalCalls1m / totalLimit1m * 100

// Records per time (fra sync runs)
recordsLastHour = syncRuns
  .filter(r => r.started_at > 1hAgo)
  .reduce((sum, r) => sum + r.records_processed, 0)
```

## Forventet resultat

| Element | Foer | Efter |
|---------|------|-------|
| Sidestruktur | 1 lang side | 2 faner |
| Arkitekturoverblik | Intet | Live diagram med alle grene |
| Throughput-advarsel | Kun per-integration | Systemwid + per-forbindelse |
| LiveCronStatus | Ubrugt | Vist i fane 2 |
| WebhookActivity | Ubrugt | Vist i fane 2 |
| Webhook-grene | Ikke synlige | Alle 5 webhooks vist |
| KPI Engine | Ikke synlig | Vist som separat lag |

