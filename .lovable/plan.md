

## Opret ALKA API integration (Enreach)

### Overblik
Opretter en ny Enreach-integration kaldet "ALKA API" der bruger samme HeroBase API URL som Tryg, men med egne credentials og config. Kunden ALKA eksisterer allerede i systemet (id: `0a8048ac-ac28-4999-b1a7-5d1238d7fc2c`).

### Trin

#### 1. Indsæt ny integration i `dialer_integrations`
- **name**: `alka`
- **provider**: `enreach`
- **api_url**: `https://wshero01.herobase.com/api`
- **is_active**: `true`
- **config**: Baseret på Tryg-strukturen men med tilpassede filtre (skal konfigureres — f.eks. org code filter, produktregler)
- **Credentials**: Krypteres via `update_dialer_credentials` RPC med brugernavn `api_alka_performance@tryg.dk` og kode `g_2f1z0H!t`

#### 2. Opret cron jobs til automatisk sync
Følger Tryg-mønsteret med to jobs:
- **`enreach-alka-sales`** — henter salg hvert 15 min (staggered schedule, f.eks. `4,19,34,49 * * * *`)
- **`enreach-alka-meta`** — henter users/campaigns/sessions én gang i timen

Begge kalder `integration-engine` med den nye integration_id.

#### 3. Tilføj til cron-schedule config
Opdater `update-cron-schedule` edge function med `alka` entry.

#### 4. Tilføj til TV dashboard mappings
Opdater `tv-dashboard-data` med `alka` → ALKA client_id mapping.

### Tekniske detaljer
- Credentials gemmes krypteret via eksisterende `update_dialer_credentials` DB-funktion med `DB_ENCRYPTION_KEY`
- Config starter med en minimal opsætning — kan tilpasses efterfølgende med produktregler og datafiltre
- Ingen kodeændringer i integration-engine — den håndterer allerede Enreach-adaptere generisk

### Filer der ændres
1. `supabase/functions/update-cron-schedule/index.ts` — tilføj `alka` schedule
2. `supabase/functions/tv-dashboard-data/index.ts` — tilføj `alka` client mapping
3. Database: INSERT i `dialer_integrations` + cron jobs via migration

