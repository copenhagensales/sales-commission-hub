## Diagnose

Sæson 1 er sat til `status = 'completed'` i DB, men runde 6 kører stadig (slut 4. maj 2026, dvs. i morgen). Nogen har manuelt trykket "afslut sæson" via admin-knappen.

Derudover skjuler `CommissionLeague.tsx` HELE liga-siden når status ≠ `active`/`qualification` — også færdige resultater. Det er en bug: en afsluttet sæson skal stadig kunne ses i historik-form.

## To ændringer

### 1. Genåbn den nuværende sæson (data-fix)
- Sæt `league_seasons.status = 'active'` for sæson 1 (id `1413d941-...`) via migration.
- Runde 6 er allerede `active` med end_date 4. maj — så cron'en `league-process-round` afslutter den automatisk i morgen.

### 2. Vis færdige sæsoner (kode-fix) — GUL ZONE
**`src/hooks/useLeagueData.ts`** (`useActiveSeason`):
- Udvid query til at inkludere `completed` som fallback: hvis ingen `qualification`/`active` findes, returnér seneste `completed` sæson.

**`src/pages/CommissionLeague.tsx`**:
- Fjern `season?.status === "active"` gating på data-hooks (linje 109-112) — hent også standings/runder for `completed` sæsoner.
- Tilføj `isCompletedPhase = season.status === "completed"` flag.
- Vis slut-resultat med banner "Sæson X afsluttet — endeligt resultat" øverst når completed.
- Skjul tilmelding/unenroll-knapper og sticky-bar live-data når completed; vis i stedet final placering.
- "Ingen aktiv sæson"-kortet vises kun hvis der slet ingen sæsoner findes.

## Zone
Gul zone (liga-modul, ikke løn/pricing). Ingen DB-skema-ændringer udover én UPDATE på status-felt.

## Åben beslutning
Skal admin-knappen "afslut sæson" beskyttes med en bekræftelses-dialog så det ikke sker ved et uheld igen? (Ja/Nej før jeg tilføjer det.)