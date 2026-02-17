

# Universel MG-reference + udfasning af adversus_opp_number

## Status nu

- `internal_reference` kolonne: **findes IKKE** endnu
- `sales_reference_sequence` tabel: **findes IKKE** endnu
- `adversus_opp_number` kolonne: **aktiv**, 1.916 af 22.261 raekkker har vaerdi
- 6 edge functions refererer til `adversus_opp_number`
- 2 edge functions (`backfill-opp`, `fetch-single-opp`) skal slettes
- 3 frontend-filer refererer til backfill-opp/fetch-single-opp

Din eksterne commit (docs + hardening migration) er IKKE i Lovable-kodebasen -- alt implementeres fra bunden her.

## Trin 1: Database-migration

En samlet migration der:

1. Opretter `sales_reference_sequence` tabel (year_month TEXT PK, last_number INTEGER DEFAULT 0)
2. Tilfojer `internal_reference TEXT UNIQUE` paa `sales` med index
3. Opretter trigger-funktion `generate_sales_internal_reference()` (BEFORE INSERT)
   - Beregner year_month fra sale_datetime (fallback now())
   - Atomisk upsert paa sekvens-tabel
   - Saetter internal_reference = 'MG-' || year_month || '-' || lpad(nr, 5, '0')
4. Backfiller alle 22.261 eksisterende salg kronologisk (per maaned)
5. Kopierer 1.916 adversus_opp_number vaerdier til raw_payload->'legacy_opp_number'
6. Dropper adversus_opp_number kolonne og idx_sales_adversus_opp_number index
7. Tilfojer format-constraint: CHECK (internal_reference ~ '^MG-\d{6}-\d{5}$')

## Trin 2: Edge functions (6 filer aendres, 2 slettes)

| Fil | Aendring |
|-----|----------|
| integration-engine/core/sales.ts | Fjern adversus_opp_number fra SELECT og upsert-objekt. Fjern OPP-preserve logik |
| sync-adversus/index.ts | Fjern adversus_opp_number fra 4 steder (linje 824, 936, 1132, 1237) |
| dialer-webhook/index.ts | Fjern adversus_opp_number fra insert (linje 193) |
| adversus-webhook/index.ts | Fjern adversus_opp_number fra insert (linje 289) |
| backfill-opp/index.ts | SLET hele funktionen |
| fetch-single-opp/index.ts | SLET hele funktionen |

## Trin 3: Frontend (3 filer)

| Fil | Aendring |
|-----|----------|
| Settings.tsx | Fjern backfill-opp invoke (linje 429) og backfillOpp() funktionen (linje 442-458) |
| DialerIntegrations.tsx | Fjern backfill-opp fra dropdown (linje 2383), skift default manualFunction, fjern limit-UI (linje 2406-2418), fjern body-logik (linje 519-520) |
| CphAdversusApiTab.tsx | Fjern TableRow for backfill-opp (linje 315-321) og fetch-single-opp (linje 322-328) |

## Trin 4: Config

- Fjern `[functions.fetch-single-opp]` og `[functions.backfill-opp]` fra supabase/config.toml (linje 75-79)

## Data-garanti

- Alle 22.261 eksisterende salg faar MG-ref via backfill, sorteret kronologisk per maaned
- 1.916 OPP-vaerdier bevares i raw_payload->'legacy_opp_number' FOER kolonnen droppes
- Alle nye salg faar automatisk MG-ref via BEFORE INSERT trigger
- OPP fra dialer-API'et gemmes stadig i raw_payload som normalt datafelt

## Verifikation efter koersel

```text
SELECT COUNT(*) FILTER (WHERE internal_reference IS NULL) as missing FROM sales;           -- Skal vaere 0
SELECT COUNT(*) FILTER (WHERE internal_reference !~ '^MG-\d{6}-\d{5}$') FROM sales;        -- Skal vaere 0
SELECT COUNT(*) - COUNT(DISTINCT internal_reference) as duplicates FROM sales;              -- Skal vaere 0
SELECT COUNT(*) FROM sales WHERE raw_payload->>'legacy_opp_number' IS NOT NULL;             -- Skal vaere 1916
```

