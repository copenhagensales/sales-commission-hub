

## Lyn-backfill: Alka 45 dage med pauset normal sync

### Mål
Hente ALLE salg fra Alka API'en for de sidste 45 dage så hurtigt som muligt — ved at pause den normale 15-min cron sync midlertidigt, så hele API-budgettet (10.000 kald/time) er tilgængeligt for backfill.

### Plan

**Step 1 — Pause normal sync på Alka**  
Sæt `is_active = false` på Alka-integrationen i `dialer_integrations`. Det stopper den løbende cron fra at bruge API-budget. Tager ~5 sek.

**Step 2 — Kør safe-backfill med fuldt budget**  
Kald `integration-engine` action `safe-backfill` med:
- `integration_id` = Alka's ID (`48d8bd23-...`)
- `from` = i dag - 45 dage
- `to` = i dag
- `datasets` = `["sales"]` (KUN salg, ingen calls)
- `uncapped` = `true` (ingen per-dag cap)
- `background` = `true` (kør asynkront)

Med `is_active=false` er der ingen konkurrence om budget. Med Enreach-limit på 10.000 kald/time og typisk ~50-200 kald per dag (afhænger af lead-volumen), kan 45 dage gennemføres på 1-3 timer i stedet for 6-12 timer.

**Step 3 — Monitor progress**  
Følg fremskridt via `integration_logs` og `integration_sync_runs` tabellerne. Hver dag logges separat med `details.results`.

**Step 4 — Genaktivér normal sync**  
Når backfill er færdig (eller stopper med `stoppedEarly: true`), sæt `is_active = true` igen. Cron tager over fra næste 15-min-tick.

### Tekniske noter
- `safe-backfill` har allerede 30% budget-reserve indbygget — men den reserve er irrelevant nu da intet andet bruger Alka's budget
- `enableUserPreFetch=true` (fra forrige fase) sikrer at orgCode→email mapping er aktiv → CPH-sælgeren bliver korrekt attribueret
- Hvis budget alligevel rammer loftet, fortsætter backfill bare i næste time-vindue
- Calls hentes IKKE i denne kørsel (sparer ~50% af API-kaldene)

### Hvad jeg IKKE rører
- Andre integrationer (Tryg, Eesy, ASE) — kører normalt videre
- Adapter-kode eller core ingestion-logik
- Whitelist (stadig kun `@copenhagensales.dk`)
- DB schema

### Næste skridt efter approval
1. Pause Alka (`is_active=false`)
2. Trigger safe-backfill 45 dage, kun sales, uncapped, background
3. Vis dig hvor mange dage der kører + estimeret tid
4. Når færdig: aktivér Alka igen + rapportér total antal salg hentet

