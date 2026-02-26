

# Fix-plan: Fuldfor stabilitets-implementering

## Problemoversigt

Der er 3 problemer der skal fixes for at stabilitetsplanen er fuldt implementeret:

### Problem 1: Circuit breaker bug
`sync-integration.ts` har en reference-fejl (`pausedMinutes is not defined`) i error-håndteringen. Variablen fra `recordCircuitBreakerFailure` destruktureres korrekt som `{ newCount, pausedMinutes }` men tilgås senere som `cb.pausedMinutes` i stedet for den lokale variabel.

### Problem 2: Enreach-kollisioner (manglende staggering)
Tryg (`d79b9632`) og Eesy (`a5068f85`) korer sales-sync pa same minut-offsets, hvilket skaber samtidige API-kald mod Enreach/HeroBase. Tryg's sales korer `:0,:5,:10...` og Eesy's sales korer `:2,:7,:12...` -- men Tryg burde IKKE kore pa `:0` da Relatel allerede gor det.

### Problem 3: Alle Enreach-integrationer er 100% rate-limited
Tryg, Eesy og ASE viser `rate_limit_hits = api_calls_made` pa ALLE runs den seneste time. Ingen data processeres (0 records). Dette indikerer at HeroBase har en strammere rate-limit end forventet, og at integrationerne skal bruge provider-level serialisering.

---

## Implementeringsplan

### Trin 1: Fix circuit breaker bug
**Fil:** `supabase/functions/integration-engine/actions/sync-integration.ts`

Find alle steder hvor `cb.pausedMinutes` refereres og ret til den korrekte lokale variabel fra `recordCircuitBreakerFailure`-kaldet. Der er mindst 2 steder:
- I success-flowet (linje ~370): `if (cb.pausedMinutes)` skal bruge den returnerede variabel
- I error-flowet (linje ~420): Samme fix

### Trin 2: Ret cron-kollisioner for Enreach
Opdater cron-schedules sa ingen Enreach-integrationer korer samtidigt:

| Integration | Sales (nu) | Sales (nyt) | Meta (uaendret) |
|---|---|---|---|
| Tryg (d79b9632) | `:0,:5,:10...` | `:0,:5,:10...` | `:1,:31` |
| Eesy (a5068f85) | `:2,:7,:12...` | `:2,:7,:12...` | `:3,:33` |
| ASE (a76cf63a) | `:4,:9,:14...` | `:4,:9,:14...` | `:5,:35` |

Staggeringen ser faktisk OK ud (2 min mellem hver). Det reelle problem er at de IKKE bruger provider-locking.

### Trin 3: Skift Enreach-jobs til provider-sync
I stedet for at hver integration kalder `integration-engine` direkte, skal Enreach-integrationernes cron-jobs bruge `action: "provider-sync"` med `source: "enreach"`. Dette aktiverer:
- Database-las via `provider_sync_locks`
- Sekventiel eksekvering (kun en ad gangen)
- Budget-gating (stop ved 80% kapacitet)

Konkret: Fjern de 6 individuelle Enreach cron-jobs (Tryg/Eesy/ASE sales+meta) og erstat med 2 provider-level jobs:
- `provider-enreach-sync-sales`: Hvert 5. minut, `{"source":"enreach","action":"provider-sync","actions":["sales"]}`
- `provider-enreach-sync-meta`: Hvert 30. minut, `{"source":"enreach","action":"provider-sync","actions":["campaigns","users","sessions"]}`

### Trin 4: Deploy og verificer
- Deploy `integration-engine` edge function
- Vent 10-15 minutter
- Verificer at `integration_sync_runs` viser lavere `rate_limit_hits`

---

## Tekniske detaljer

### Circuit breaker fix (sync-integration.ts)
```text
// FOER (buggy):
const cb = await recordCircuitBreakerFailure(supabase, integration.id, ...);
if (cb.pausedMinutes) {  // <-- "pausedMinutes is not defined"

// EFTER (fix):
const cbResult = await recordCircuitBreakerFailure(supabase, integration.id, ...);
if (cbResult.pausedMinutes) {
```

### Provider-sync cron SQL
```text
-- Fjern 6 individuelle Enreach-jobs
SELECT cron.unschedule(111);  -- Tryg sales
SELECT cron.unschedule(112);  -- Tryg meta
SELECT cron.unschedule(113);  -- Eesy sales
SELECT cron.unschedule(114);  -- Eesy meta
SELECT cron.unschedule(115);  -- ASE sales
SELECT cron.unschedule(116);  -- ASE meta

-- Opret 2 provider-level jobs
SELECT cron.schedule('provider-enreach-sync-sales', '*/5 * * * *', ...);
SELECT cron.schedule('provider-enreach-sync-meta', '5,35 * * * *', ...);
```

### Forventet resultat
- Circuit breaker logger korrekt uden fejl
- Enreach-integrationer korer sekventielt (aldrig samtidigt)
- Rate-limit hits falder dramatisk
- Data begynder at blive processeret igen for Tryg/Eesy/ASE

