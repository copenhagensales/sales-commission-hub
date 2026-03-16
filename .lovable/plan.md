

## Automatisk cron-job for league-calculate-standings hvert 15. minut

### Problem
Funktionen kræver et `seasonId` i request body. Et cron-job kan ikke vide hvilken sæson der er aktiv. Løsningen er at opdatere funktionen til automatisk at finde den aktive sæson hvis intet `seasonId` sendes.

### Ændringer

**1. Edge Function: `league-calculate-standings/index.ts`**
- Gør `seasonId` valgfri — hvis den ikke sendes, find automatisk den aktive sæson (`status = 'qualification'` eller `'active'`)
- Tilføj auto-detect logik før den eksisterende kode

**2. Cron-job via SQL (pg_cron + pg_net)**
- Opret et cron-job `league-standings-refresh` der kører hvert 15. minut
- Kalder funktionen uden `seasonId` så den selv finder den aktive sæson
- Schedule: `*/15 * * * *`

### Resultat
Standings opdateres automatisk hvert 15. minut for den aktive sæson. Manuelle beregninger fra admin-dashboardet fungerer stadig som før.

