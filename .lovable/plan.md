

# Fix: "Gem tidsplan" gemmer ikke startminut

## Problemet

Naar du trykker "Gem tidsplan", sker foelgende:

1. Cron-jobbet opdateres korrekt i databasen (det virker)
2. Audit-loggen skrives korrekt (det virker)
3. Men den nye tidsplan skrives IKKE tilbage til integrationen i `dialer_integrations.config.sync_schedule`
4. Naar siden genindlaeser data, laeser den den gamle config -- og startminuttet nulstilles

## Loesning

### 1. Edge function: Gem schedule i integrationsconfig

**Fil:** `supabase/functions/update-cron-schedule/index.ts`

Efter at cron-jobbet er oprettet (linje ~210), tilfoej en UPDATE der gemmer den nye `sync_schedule` og `sync_frequency_minutes` paa integrationen:

```typescript
// After scheduling, persist to integration config
if (integration_type === "dialer" && integration_id) {
  const currentConfig = integrationMetadata?.config || {};
  const updatedConfig = { ...currentConfig, sync_schedule: cronExpression };
  await supabase
    .from("dialer_integrations")
    .update({
      config: updatedConfig,
      sync_frequency_minutes: frequency_minutes,
    })
    .eq("id", integration_id);
}
```

### 2. Frontend: Synkroniser lokal state naar data genindlæses

**Fil:** `src/components/system-stability/ScheduleEditor.tsx`

Tilfoej en `useEffect` der opdaterer `frequency` og `startMinute` naar `integrations`-prop'en aendrer sig (efter refetch):

```typescript
useEffect(() => {
  const int = integrations.find(i => i.id === selectedId);
  if (int?.config?.sync_schedule) {
    const freq = estimateFrequencyFromCron(int.config.sync_schedule);
    setFrequency(String(freq));
    const mins = parseCronMinutes(int.config.sync_schedule);
    setStartMinute(String(mins[0] ?? 0));
  }
}, [integrations, selectedId]);
```

### 3. Invalidering af React Query cache

**Fil:** `src/components/system-stability/ScheduleEditor.tsx`

Tilfoej `useQueryClient` og invalider relevante queries efter succesfuld gem:

```typescript
const queryClient = useQueryClient();
// ... i handleSave, efter success:
queryClient.invalidateQueries({ queryKey: ["system-stability-integrations"] });
```

## Filer der aendres

- `supabase/functions/update-cron-schedule/index.ts` -- gem schedule i config
- `src/components/system-stability/ScheduleEditor.tsx` -- synkroniser state + cache invalidering

## Ingen database-aendringer

