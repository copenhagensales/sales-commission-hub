## Diagnose

**Aktiv sæson:** S2 `f1df70db-b1dc-4afd-aa8c-943b4a55e1c6`, status `active`, start_date `2026-05-11`, end_date `2026-06-21`.

**Faktisk DB-tilstand:**
- `league_qualification_standings`: 47 rækker for S2 (sidst beregnet 11/5 18:30) ✅
- `league_season_standings`: **0 rækker** ❌
- `league_rounds`: **0 rækker** ❌
- Status er allerede flippet til `active` på `2026-05-11 00:00:00.098+00`.

**Rod-årsag:** Race condition i `supabase/functions/calculate-kpi-values/index.ts`:

1. `auto-transition`-logikken (linje 366-403) kører hvert minut og flipper status `qualification → active` så snart `start_date <= now`. For S2 skete det kl. 00:00:00 UTC den 11/5.
2. Straks efter kalder den `initializeActiveSeasonData()` (linje 259-321), som henter `league_qualification_standings` og kopierer dem til `league_season_standings` + opretter runde 1.
3. **MEN** kvalifikationsperioden sluttede officielt 10/5 21:59:59 UTC, og `league-calculate-standings` (cron-baseret) havde ikke nødvendigvis populereret de endelige `qualification_standings` på det præcise sekund hvor transition skete.
4. Linje 270-273:
   ```ts
   if (!qualStandings || qualStandings.length === 0) {
     console.log("[season-init] No qualification standings to copy");
     return;  // ← early return, INGEN runde oprettes
   }
   ```
5. Funktionen returnerede uden at oprette runde 1. Status blev dog opdateret til `active` (linje 389-396 kører før `initializeActiveSeasonData`), så ved næste kørsel matcher `season.status === "qualification"` ikke længere → transition-logikken hopper helt over → `initializeActiveSeasonData` kaldes aldrig igen.

Resultatet: Sæsonen er teknisk "active" men har ingen runder eller season_standings, så hele runde-systemet står stille.

## Plan

**Scope:** `supabase/functions/calculate-kpi-values/index.ts` (gul zone — liga-feature, ikke løn/pricing) + en engangs-fix for S2 via direkte data-indsættelse. Ingen rød zone.

### Steg 1 — Engangs-fix for S2 (akut)
Manuel trigger af `initializeActiveSeasonData` for S2 ved enten:
- (a) Kalde edge function `calculate-kpi-values` med en intern flag, eller
- (b) Køre en SQL-migration der kopierer `qualification_standings → season_standings` + indsætter runde 1 for S2 direkte.

**Anbefaling:** (b) — Insert via migration (read-only på qual_standings, insert på season_standings + league_rounds). Dette er idempotent for S2 specifikt og fjerner blocker med det samme.

Runde 1 vindue baseret på `season.start_date`:
- `start_date = 2026-05-11 00:00:00 UTC`
- `end_date = start_date + 7 dage = 2026-05-18 00:00:00 UTC`
- `status = 'active'`

### Steg 2 — Strukturel fix (idempotent re-init)
Ret `auto-transition`-logikken til at også re-køre `initializeActiveSeasonData` når sæsonen ALLEREDE er `active` men mangler runder/standings. Tilføj efter linje 376:

```ts
// Idempotent recovery: if season is already active but missing init data, retry
if (season.status === "active" && !newStatus) {
  const { count: roundCount } = await supabase
    .from("league_rounds")
    .select("*", { count: "exact", head: true })
    .eq("season_id", season.id);
  if (roundCount === 0) {
    console.log(`[auto-transition] Active season S${season.season_number} missing rounds — re-initializing`);
    await initializeActiveSeasonData(supabase, season.id, season.start_date, season.config);
  }
}
```

Dette beskytter mod fremtidige race conditions med qualification_standings-cron.

### Steg 3 — Verifikation
- Bekræft `league_rounds` har 1 row for S2 med status `active`.
- Bekræft `league_season_standings` har 47 rows for S2.
- Bekræft `league-process-round` edge function ikke fejler ved næste kørsel.
- Tjek UI på `/commission-league` viser runde 1 som aktiv.

## Hvad jeg IKKE rører
- `league-process-round`-funktionen (den virker fint når runder først eksisterer).
- `league-calculate-standings`-cron.
- Qualification-fasen logik.
- Pricing, løn, RLS, permissions.

Bekræft scope, så starter jeg med Steg 1 (migration der populerer S2) + Steg 2 (idempotent edge-fix) i samme commit.
