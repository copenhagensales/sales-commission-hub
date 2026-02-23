

# Ret sync-frekvenser via edge function kald (ikke migration)

## Hvorfor ikke migrationen?

Migrationen har tre problemer der goer den upaalidelig:

1. **Lovablecph har ingen cron-jobs i databasen** -- UPDATE paa ikke-eksisterende raekker goer ingenting
2. **Job-navne matcher ikke** -- migrationen soeger efter `-sync-sales` og `-sync-meta`, men kun `-sync` eksisterer
3. **Migration kan ikke oprette nye cron-jobs** -- den kan kun opdatere eksisterende

## Korrekt tilgang: Kald update-cron-schedule for hver integration

Edge-funktionen `update-cron-schedule` haandterer alt automatisk:
- Fjerner gamle jobs (uanset navngivning)
- Opretter nye jobs med korrekt schedule
- Opretter split-jobs (sales + meta) for Lovablecph
- Persisterer config og frequency i dialer_integrations

### 5 kald der skal laves

| Integration | ID | Provider | Ny frekvens | Staggered schedule |
|---|---|---|---|---|
| Lovablecph | 26fac751-... | adversus | 5 min | `1,6,11,16,21,26,31,36,41,46,51,56 * * * *` |
| Relatel_CPHSALES | 657c2050-... | adversus | 5 min | `3,8,13,18,23,28,33,38,43,48,53,58 * * * *` |
| Eesy | d79b9632-... | enreach | 3 min | `0,3,6,9,...,57 * * * *` |
| Tryg | a5068f85-... | enreach | 3 min | `1,4,7,10,...,58 * * * *` |
| ASE | a76cf63a-... | enreach | 3 min | `2,5,8,11,...,59 * * * *` |

### Implementering

Ingen kodeaendringer -- kun 5 kald til `update-cron-schedule` edge-funktionen med:
```text
{
  integration_type: "dialer",
  integration_id: "<uuid>",
  provider: "<adversus|enreach>",
  frequency_minutes: <5|3>,
  is_active: true
}
```

Edge-funktionen beregner automatisk staggered schedules via den eksisterende `staggeredFiveMinuteSchedules` logik for Adversus, og standard `frequencyToCron` for Enreach (som vi eventuelt tilpasser med `custom_schedule` for 3-min stagger).

### Note om 3-minutters frekvens

`frequencyToCron` tabellen i `update-cron-schedule` har ikke en entry for `3` minutter. Vi har to muligheder:

1. **Tilfoej `3` til `frequencyToCron`** i edge-funktionen: `3: "*/3 * * * *"` -- men dette giver ikke stagger
2. **Send `custom_schedule`** med staggerede 3-min schedules for hver Enreach-integration

Option 2 er bedre for at undgaa samtidige API-kald. Vi sender `custom_schedule` direkte.

### Filer der aendres

| Fil | Aendring |
|---|---|
| `supabase/functions/update-cron-schedule/index.ts` | Tilfoej `3` til `frequencyToCron` mapping |
| Ingen migration | Slet den foreslaaede migration -- den virker ikke korrekt |

### Eksekvering

Efter deploy af opdateret edge-funktion, kalder vi den 5 gange via curl/invoke med korrekte parametre for hver integration.

