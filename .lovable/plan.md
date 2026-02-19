

## Deploy Edge Functions

Deployer de to edge functions til produktion:

1. **integration-engine** — Synkroniseringsmotor med alle adapters, actions og core-logik
2. **update-cron-schedule** — Cron-job management (opret/opdater/slet schedules)

### Hvad sker der
- Begge funktioner deployes med deres nuværende kode
- Ingen kodeændringer er nødvendige — det er et rent deploy af eksisterende filer
- Efter deploy er funktionerne live og kan kaldes via HTTP eller pg_cron

### Teknisk detalje
- `integration-engine`: Indeholder `index.ts`, `actions/sync-integration.ts`, `adapters/`, `core.ts`, `utils/`, `types.ts`
- `update-cron-schedule`: Enkelt `index.ts` med CORS, auth og cron.schedule/cron.unschedule logik

