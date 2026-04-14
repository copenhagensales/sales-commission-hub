

## Problem

Cron-jobbet `fm-checklist-daily-summary` kører med schedule `0 18 * * *` (18:00 UTC = 20:00 dansk sommertid). Konfigurationen i `fm_checklist_email_config` siger `send_time: 15:00`, men **ingen kode synkroniserer `send_time` til cron-jobbet**.

Når man ændrer afsendelsestidspunkt i admin-panelet, opdateres kun databaserækken — cron-jobbet forbliver uændret.

## Løsning

### 1. Ret cron-jobbet NU (migration)
Opdater det eksisterende cron-job til `0 13 * * *` (13:00 UTC = 15:00 CEST).

### 2. Synkroniser `send_time` → cron ved ændring
Udvid `useUpdateEmailConfig` i `useFmChecklist.ts` så den kalder en RPC-funktion der opdaterer cron-schedulet når `send_time` ændres.

Opret en database-funktion `update_checklist_email_cron(new_time text)` der:
- Parser `HH:mm` til UTC (fratrækker 2 timer for CEST / 1 time for CET)
- Kører `cron.alter_job()` eller `unschedule` + `schedule` med det nye tidspunkt

### 3. Tidszonebevidst konvertering
Da Danmark skifter mellem CET (UTC+1) og CEST (UTC+2), brug `AT TIME ZONE 'Europe/Copenhagen'` i SQL-funktionen for korrekt UTC-konvertering hele året.

### Filer der ændres
| Fil | Ændring |
|-----|---------|
| Migration (ny) | Ret cron til `0 13 * * *` + opret `update_checklist_email_cron()` funktion |
| `src/hooks/useFmChecklist.ts` | Kald RPC efter `send_time` opdatering |

