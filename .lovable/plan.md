## Mål
1. Sæson 1 er afsluttet → vis den korrekt som "afsluttet" og ryd op i runde 6 (står stadig `active`).
2. Brugeren skal kunne **bladre** mellem sæsoner (S1, S2, …) på `/commission-league`.
3. **Næste sæson skal starte automatisk** — uden at en admin manuelt skal trykke "Aktiv".

---

## Hvad er på plads i dag

- `league_seasons` har 1 række: Sæson 1, status `completed`, slutdato 2026-05-03.
- `useActiveSeason()` viser allerede `completed` som fallback når der ikke er en live sæson — men kun den **seneste**.
- Der findes ingen UI til at vælge en anden (gammel) sæson på spillersiden.
- Der findes **ingen cron/auto-flow** der promoverer en kladde-sæson til `qualification` → `active` → `completed` baseret på datoer. Status sættes manuelt i `SeasonManagerCard`.
- Runde 6 i Sæson 1 står stadig `active` selvom sæsonen er `completed` (datafejl).

---

## Plan

### 1. Datafix (migration)
- Sæt `league_rounds.status = 'completed'` for runde 6 i Sæson 1.
- Bekræft `league_seasons.is_active = false` for Sæson 1.

### 2. Sæson-vælger på spillersiden (`CommissionLeague.tsx`)

Tilføj en kompakt sæson-switcher i hero-headeren (ved siden af "Sæson X"-titlen):

```text
[ ◀  Sæson 1  ▼  ▶ ]   ← dropdown + pile
```

- Ny hook `useViewableSeasons()` henter alle sæsoner med status `qualification | active | completed` (skjuler kladder for almindelige brugere).
- Ny lokal state `viewedSeasonId`. Default = den "live" sæson (qualification/active), ellers seneste completed.
- Alle eksisterende hooks (`useMyEnrollment`, `useQualificationStandings`, `useCurrentRound`, `useSeasonStandings`, `useRoundHistory`, …) får `viewedSeasonId` i stedet for `season.id`.
- Når man kigger på en **gammel** sæson:
  - Skjul tilmeldings-/fan-knapper og sticky bar (de hører til live sæson).
  - Vis tydelig badge: "Historisk – afsluttet d. {end_date}".
  - Confetti-effekten må ikke trigge for historiske sæsoner.

### 3. Auto-status for sæsoner

To dele:

**a) DB-funktion `league_auto_advance_seasons()`** (SECURITY DEFINER):
- For hver sæson:
  - `draft` + `qualification_start_at <= now()` → `qualification` (+ `is_active = true`).
  - `qualification` + `qualification_end_at <= now()` og `start_date <= now()` → `active`.
  - `active` + `end_date IS NOT NULL` og `end_date < now()` → `completed` (+ `is_active = false`, og luk evt. åbne runder).
- Sikrer at maks. 1 sæson kan være `active` ad gangen (samme garde som `useUpdateSeasonStatus`).

**b) pg_cron job** der kalder funktionen hver 5. minut.

Resultatet: Når en admin opretter Sæson 2 som kladde med datoer i fremtiden, skifter den selv til `qualification` og senere `active`/`completed` uden manuel handling.

### 4. UI-feedback i admin (`SeasonManagerCard`)
- Lille hjælpetekst: "Status opdateres automatisk hvert 5. minut baseret på datoerne. Manuel ændring tilsidesætter."
- (Allerede delvist til stede — udvides.)

---

## Tekniske detaljer

**Filer der ændres:**
- `supabase/migrations/<ny>.sql` — datafix + `league_auto_advance_seasons()` + pg_cron schedule.
- `src/hooks/useLeagueData.ts` — ny `useViewableSeasons()` hook.
- `src/pages/CommissionLeague.tsx` — sæson-switcher + brug af `viewedSeasonId` overalt + skjul live-only UI for historiske sæsoner.
- `src/components/league/SeasonManagerCard.tsx` — opdateret hjælpetekst.

**Rød zone-tjek:** Ingen lønberegning, ingen pricing, ingen GDPR. Påvirker kun league-feature (gul zone). OK at implementere når godkendt.

**Åbne spørgsmål (besluttes inden implementation):**
- Skal kladder (`draft`) være synlige i sæson-switcheren for ejere/admins? Foreslår: nej, kun synlig i admin-siden.
- Når Sæson 2 auto-aktiveres, skal spillere fra Sæson 1 så **auto-tilmeldes** Sæson 2, eller skal de tilmelde sig manuelt? Foreslår: manuel tilmelding (matcher nuværende mønster), men sig til hvis I vil have auto-tilmelding.
