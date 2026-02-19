

# Fieldmarketing Dashboard: Standardisering + Systemoptimeringer

## Hvad aendres

### 1. `src/pages/dashboards/FieldmarketingDashboardFull.tsx`

Omskrives fra 542 linjer til ~50 linjer:

- Fjern custom `ClientDashboard` komponent med 5-6 langsomme live-queries
- Fjern `handleExportExcel` og XLSX-import
- Fjern `DashboardDateRangePicker`, `fetchAllRows`, `getPayrollPeriod`
- Behold tabs (Eesy FM / Yousee) som simpel state
- Render den generiske `ClientDashboard` fra `@/components/dashboard/ClientDashboard` per tab -- praecis som Eesy TM, TDC Erhverv og Relatel allerede goer

Cached data eksisterer allerede for begge FM-klienter (verificeret i databasen):
- Eesy FM (`9a92ea4c`): KPI'er + leaderboards for today/week/month/payroll
- Yousee (`5011a7cd`): KPI'er + leaderboards for today/week/month/payroll

### 2. Ingen andre filer roeres

- `src/routes/pages.ts` og `config.tsx` -- uaendret (import + rute forbliver)
- `src/hooks/useFieldmarketingSales.ts` -- beholdes (bruges i vagt-flow)
- TV board imports -- virker stadig
- `xlsx` dependency -- bruges i andre filer

## 3 Systemoptimeringer

### Forbedring 1: GIN-index paa `raw_payload`

Der er **ingen index paa `raw_payload` JSONB-kolonnen**. Alle FM-queries (ogsaa i edge functions som `calculate-kpi-values`) bruger `.contains("raw_payload", { fm_client_id: ... })` eller `.filter("raw_payload->>fm_client_id", ...)`. Med 23.000+ raekker i `sales`-tabellen laver dette fulde table scans hver gang.

**Aendring:** Opret GIN-index via SQL migration:

```text
CREATE INDEX idx_sales_raw_payload ON sales USING gin (raw_payload jsonb_path_ops);
```

Dette accelererer ALLE JSONB-forespørgsler paa tvaers af hele systemet -- ikke kun FM dashboardet, men ogsaa edge functions (`calculate-kpi-values`, `calculate-leaderboard-incremental`) der koerer hvert minut.

### Forbedring 2: Composite index for FM-specifikke queries

Edge functions og dashboards filtrerer naesten altid paa `source = 'fieldmarketing' AND sale_datetime >= X`. Der mangler et composite index for dette moenster.

**Aendring:** Opret composite index:

```text
CREATE INDEX idx_sales_source_datetime ON sales (source, sale_datetime DESC);
```

Dette goer det muligt for Postgres at bruge en enkelt index-scan i stedet for at kombinere to separate indexes. Gavner baade live-queries og de minutlige cache-beregninger.

### Forbedring 3: Oprydning af duplikerede leaderboard-cache raekker

`useCachedLeaderboard` hooket henter allerede med `.order("calculated_at", { ascending: false }).limit(1)` for at haandtere duplikater. Men dette betyder at der potentielt ligger gamle raekker i `kpi_leaderboard_cache` der aldrig laeses.

**Aendring:** Tilfoej `UNIQUE`-constraint paa `kpi_leaderboard_cache` saa edge functions bruger `UPSERT` i stedet for at oprette nye raekker:

```text
CREATE UNIQUE INDEX IF NOT EXISTS idx_leaderboard_cache_unique 
ON kpi_leaderboard_cache (period_type, scope_type, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'));
```

Dette reducerer tabelstorrelsen og eliminerer behovet for `.order().limit(1)` workarounds.

## Forventet effekt

| Metrik | Foer | Efter |
|--------|------|-------|
| FM Dashboard queries | 5-6 live (JSONB scans) | 4 cache-lookups |
| FM Dashboard latency | 2-4 sekunder | Under 200ms |
| JSONB query performance (systemwidt) | Full table scan | GIN index scan |
| Edge function KPI-beregning | Seq scan paa 23k raekker | Index scan |
| Leaderboard cache raekker | Voksende (duplikater) | 1 per scope/period |
| Kodelinjer i FM dashboard | 542 | ~50 |

