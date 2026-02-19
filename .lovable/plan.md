

# Flyt maxRecords ind i Adversus adapteren (kun Lovablecph)

## Problem
`maxRecords` begrænsningen i `sync-integration.ts` (linje 155) anvendes EFTER `fetchSales()`/`fetchSalesRange()` returnerer. Men inde i disse metoder kalder `buildLeadDataMap()` allerede individuelle API-kald for HVER lead. Resultat: ~94 unødvendige API-kald per kørsel, som udløser rate limits.

## Ændringer

### 1. `supabase/functions/integration-engine/adapters/interface.ts`
Tilføj optional `maxRecords` parameter til `fetchSales` og `fetchSalesRange` i interfacet:
- `fetchSales(days, campaignMappings?, maxRecords?)` 
- `fetchSalesRange?(range, campaignMappings?, maxRecords?)`

### 2. `supabase/functions/integration-engine/adapters/adversus.ts`

**`fetchSales()` (linje 171)**: Tilføj `maxRecords?: number` parameter. Efter `fetchSalesSequential()` (linje 188), men FØR `buildLeadDataMap()` (linje 194):
```
let rawSales = await this.fetchSalesSequential(filterStr);
if (maxRecords && rawSales.length > maxRecords) {
  rawSales.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
  rawSales = rawSales.slice(0, maxRecords);
  console.log(`[Adversus] Pre-enrichment limit: kept ${rawSales.length} newest (maxRecords=${maxRecords})`);
}
const leadIdToData = await this.buildLeadDataMap(rawSales, campaignConfigMap);
```

**`fetchSalesRange()` (linje 326)**: Samme ændring — tilføj `maxRecords?: number` parameter og slice rawSales (linje 342) før `buildLeadDataMap()` (linje 344).

### 3. `supabase/functions/integration-engine/actions/sync-integration.ts`

**Linje 132-137**: Send `maxRecords` videre til adapter-metoderne:
```
sales = await adapter.fetchSalesRange({ from, to }, campaignMappings, maxRecords);
// eller
sales = await adapter.fetchSales(days, campaignMappings, maxRecords);
```

Behold den eksisterende slice-logik (linje 154-158) som fallback for adaptere der ikke implementerer parameteren (Enreach).

## Scope-sikkerhed
- Kun Lovablecph sender `maxRecords: 30` i sin cron-payload
- Relatel og Enreach sender IKKE `maxRecords`, så parameteren er `undefined` og koden springes over
- Enreach-adapteren behøver ingen ændring — den har ikke `buildLeadDataMap`

## Forventet resultat

| Metric | Før | Efter |
|--------|-----|-------|
| API-kald per kørsel (Job 88) | ~96 | ~33 |
| API-kald per time (12 kørsler) | ~1.152 | ~396 |
| Rate limit risiko | Høj | Lav |
| Output (processerede sales) | 30 | 30 (uændret) |

