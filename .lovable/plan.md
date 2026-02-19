

# Fix Lovablecph: Et samlet job hvert 5. minut med alle actions (uden sessions)

## Problem
Job 72 crasher fordi payloaden inkluderer `sessions`, som returnerer HTTP 403 fra Adversus. Dette blokerer hele synkroniseringen, inklusiv sales.

## Løsning
Erstat Job 72 og Job 74 med **et enkelt job** der kører hvert 5. minut med `actions: ["campaigns", "users", "sales"]`. Alt er automatiseret -- kun `sessions` fjernes, da Adversus API'et ikke tillader det for denne integration.

## Trin

### 1. Fjern Job 72 og Job 74
Afskeduler begge eksisterende Lovablecph-jobs via SQL.

### 2. Opret nyt samlet job
- Schedule: hvert 5. minut (staggered: `1,6,11,16,21,26,31,36,41,46,51,56 * * * *`)
- Actions: `["campaigns", "users", "sales"]`
- Alt automatiseret, intet manuelt

### 3. Beskyt koden mod sessions-crash
Tilføj et filter i `sync-integration.ts` der fjerner `sessions` fra action-listen for Lovablecph-integrationen. Dette sikrer at selv ved manuelle triggers vil sessions ikke crashe synkroniseringen.

### 4. Fjern legacy Job 11
`customer-crm-syncer` er forældet og bør fjernes samtidig.

---

## Tekniske detaljer

### SQL-kommandoer
```text
SELECT cron.unschedule(72);  -- Lovablecph sync (crasher)
SELECT cron.unschedule(74);  -- Lovablecph meta (overflødig)
SELECT cron.unschedule(11);  -- Legacy customer-crm-syncer

-- Nyt samlet job:
SELECT cron.schedule(
  'dialer-26fac751-sync',
  '1,6,11,16,21,26,31,36,41,46,51,56 * * * *',
  ... payload med actions: ["campaigns", "users", "sales"], days: 1 ...
);
```

### Kodeaendring i sync-integration.ts
I `getEffectiveActionList()` eller lige efter: Filtrer `sessions` fra for integrationer hvor navnet matcher `lovablecph` eller hvor config eksplicit ekskluderer det. Dette forhindrer fremtidige crashes hvis nogen manuelt inkluderer sessions.

```text
// Pseudokode:
if (isLovableTdcIntegration(integration)) {
  actions = actions.filter(a => a !== "sessions");
}
```

### Resultat
- Campaigns, users og sales synkroniseres automatisk hvert 5. minut
- Sessions er permanent ekskluderet (403-beskyttelse)
- 1 job i stedet for 2
- Legacy Job 11 ryddet op
