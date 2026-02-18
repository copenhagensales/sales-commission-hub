

# Luk de blinde punkter i SystemStability

## Problem

SystemStability-siden har 3 huller der betyder at ikke al API-aktivitet overvages, og at schedule-aendringer ikke altid er synkroniserede.

## Hvad der mangler

### 1. Gamle funktioner der rammer API uden overvagning

- `adversus-sync-v2` og `sync-adversus` er gamle edge functions der stadig kan kaldes fra Settings-siden
- De bruger hardkodede environment variable credentials (ikke per-integration)
- De logger IKKE til `integration_sync_runs`, saa SystemStability ser dem ikke
- `customer-crm-syncer` koerer som cron job (hver time) uden at blive vist

**Loesning:** Fjern de gamle knapper fra Settings.tsx saa de ikke kan udloeses. Redirect al sync til `integration-engine`. Fjern det ubrugte `customer-crm-syncer` cron job.

### 2. Webhooks tæelles ikke med i rate limit budget

Adversus/Enreach webhooks (`dialer-webhook`, `adversus-webhook`) modtager data og kan lave API-kald, men de logger ikke til `integration_sync_runs` -- saa de taelles ikke med i burst/time-budgettet.

**Loesning:** Tilfoej en sektion paa SystemStability der viser webhook-aktivitet baseret paa `integration_logs` (der allerede logges). Alternativt: Webhooks er passiv modtagelse og rammer ikke eksternt API -- i saa fald er det ikke et rate limit problem, men det skal vaere tydeligt paa siden.

### 3. Cron jobs kan oprettes uden om Schedule Editor

Flere steder i koden kalder `update-cron-schedule` direkte (DialerIntegrations.tsx, Settings.tsx). Der er ingen validering af at `cron.job`-tabellen matcher det Schedule Editor viser.

**Loesning:** Tilfoej en "Live cron status"-sektion der henter aktive jobs fra `cron.job`-tabellen og sammenligner dem med hvad Schedule Editor forventer. Vis en advarsel hvis der er uoverensstemmelser.

## Tekniske aendringer

### Fil 1: `src/pages/Settings.tsx`
- Fjern "adversus-sync-v2" og "sync-adversus" fra manual function picker
- Slet den gamle sync-knap der kalder `adversus-sync-v2`
- Behold KUN `integration-engine` som sync-metode

### Fil 2: `src/pages/SystemStability.tsx`
- Tilfoej en ny useQuery der henter aktive cron jobs via `supabase.rpc()` eller en ny edge function
- Vis en "Aktive jobs"-oversigt med advarsel hvis der er jobs der ikke matcher en aktiv integration
- Tilfoej webhook-aktivitet som en separat lille sektion (antal webhooks modtaget sidste 24 timer fra `integration_logs`)

### Fil 3: Database cleanup (migration)
- Fjern det ubrugte `customer-crm-syncer` cron job via SQL: `SELECT cron.unschedule('sync-client-20744525-7466-4b2c-afa7-6ee09a9112b0')`

### Ingen nye edge functions noedvendige

## Resultat

Efter denne aendring:
- Al API-aktivitet er synlig paa SystemStability-siden
- Gamle funktioner kan ikke laengere udloeses ved en fejl
- Uoverensstemmelser mellem cron jobs og Schedule Editor bliver automatisk opdaget og vist
- Webhook-aktivitet er synlig (selvom den typisk ikke pavirker rate limits)

