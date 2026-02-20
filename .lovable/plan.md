

# Fix: Lovablecph/TDC salg mangler i dag

## Problem identificeret

Lovablecph sync-jobbet korer hvert 5. minut og rapporterer `records_processed: 30` -- men **ingen TDC-salg fra i dag (20. feb) er kommet ind**. De seneste TDC-salg i databasen er fra i gar kl. 11:15.

### Rodarsag

Der er **to problemer** der tilsammen forhindrer nye salg:

1. **Pre-enrichment maxRecords cap i adapteren**: Adversus-adapteren (`adversus.ts` linje 192) skarer listen til `maxRecords=30` **for** den returnerer data. Selvom `sync-integration.ts` ogsa sorterer newest-first bagefter, er det for sent -- adapteren har allerede kasseret nyere salg.

2. **`days=1` er for snaevert**: Cron-jobbet sender `days: 1`, men Adversus API filteret bruger `created.$gt` (strikse stoerre-end), ikke `$gte`. Det betyder at salg oprettet praecis 24 timer siden kan falde udenfor vinduet. Kombineret med `maxRecords=30` risikerer vi at de 30 aeldste salg fra i gar fylder hele kvoten, og dagens salg aldrig nar igennem.

3. **Sorteringsretning**: Adapteren sorterer `newest first` for at beholde de nyeste -- det er korrekt. Men Adversus API returnerer data pagineret, og `fetchSalesSequential` henter ALLE sider forst. Problemet er at `maxRecords=30` skaerer for tidligt i adapteren (for lead-enrichment), og databasen viser at de seneste processerede salg stadig er fra 19. feb.

### Bevis
- Cron payload: `{"actions":["sales"],"days":1,"maxRecords":30}`
- Seneste Lovablecph sale_datetime: `2026-02-19 11:15:58`
- Sync runs i dag: Alle viser `records_processed: 30`, men kun eksisterende salg opdateres (upserts)
- **0 nye salg fra 20. feb med source=Lovablecph**

## Losning

### 1. Fjern dobbelt maxRecords-begransning i adapteren

I `adversus.ts`, fjern pre-enrichment slicing (linje 192-196) og lad `sync-integration.ts` haandtere begransningen **efter** sortering. Dette sikrer at adapteren altid returnerer alle salg fra API'en, og at de nyeste altid prioriteres.

```text
Fil: supabase/functions/integration-engine/adapters/adversus.ts
Linje 191-196: Fjern pre-enrichment maxRecords check
(Behold logikken i sync-integration.ts linje 154-158 som allerede goer det korrekt)
```

**Udfordring**: maxRecords i adapteren er der for at spare API-kald pa lead-enrichment (buildLeadDataMap). Uden den vil adapteren bruge flere API-kald per sync.

**Kompromis**: Oeg maxRecords fra 30 til 60 i cron-jobbet, og behold pre-enrichment limit i adapteren men med den hoejere graense. 60 records giver plads til bade gars og dagens salg.

### 2. Opdater cron-job payload

Aendr `maxRecords` fra 30 til 60 og `days` fra 1 til 2 i cron-jobbet, sa vi altid har overlap:

```sql
-- Opdater cron job for Lovablecph standard sync
SELECT cron.unschedule('dialer-26fac751-sync');
SELECT cron.schedule(
  'dialer-26fac751-sync',
  '3,8,13,18,23,28,33,38,43,48,53,58 * * * *',
  $$SELECT net.http_post(
    url:='https://jwlimmeijpfmaksvmuru.supabase.co/functions/v1/integration-engine',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer ..."}'::jsonb,
    body:='{"source":"adversus","actions":["sales"],"days":2,"maxRecords":60,"integration_id":"26fac751-c2d8-4b5b-a6df-e33a32e3c6e7"}'::jsonb
  ) AS request_id;$$
);
```

### 3. Opdater dialer_integrations config

Gem de nye vaerdier i `config` sa Schedule Editor har korrekt state:

```sql
UPDATE dialer_integrations
SET config = jsonb_set(
  jsonb_set(config, '{sales_max_records}', '60'),
  '{sync_days}', '2'
),
updated_at = now()
WHERE id = '26fac751-c2d8-4b5b-a6df-e33a32e3c6e7';
```

### 4. Kor manuel sync for at hente manglende data

Efter deploy, kor en engangssync med `days=3` for at indhente de manglende salg fra 18. og 20. februar:

```sql
SELECT net.http_post(
  url := 'https://jwlimmeijpfmaksvmuru.supabase.co/functions/v1/integration-engine',
  headers := '{"Content-Type":"application/json","Authorization":"Bearer ..."}'::jsonb,
  body := '{"source":"adversus","actions":["sales"],"days":3,"maxRecords":200,"integration_id":"26fac751-c2d8-4b5b-a6df-e33a32e3c6e7"}'::jsonb
);
```

## Opsummering

| Hvad | For | Efter |
|------|-----|-------|
| maxRecords | 30 | 60 |
| days | 1 | 2 |
| Risiko for manglende salg | Hoj | Lav |
| API-kald per sync (ca.) | 32 | ~55 |
| Inden for rate limit (60/min)? | Ja | Ja |

De ekstra API-kald (ca. 23 mere per sync) er inden for Adversus' 60 req/min graense, da Lovablecph korer forskudt fra Relatel.

