

## "Fan"-tilmelding og rollebegrænsning i Salgsligaen

### Hvad skal laves

1. **Definér ikke-deltagende roller** — roller som ejer, ass. teamleder, some, rekruttering, FM leder osv. må ikke deltage som spillere. De kan kun tilmelde sig som "fan" (spectator).

2. **Ny "Bliv fan"-knap** på landing-sektionen — vises for alle, ved siden af "Tilmeld mig nu". Fans tilmeldes med `is_spectator = true` og ser leaderboardet, men optræder ikke i standings.

3. **Bloker deltagelse for ikke-spillende roller** — "Tilmeld mig nu"-knappen skjules for ejer, ass. teamleder, some, rekruttering m.fl. De ser kun "Bliv fan"-knappen.

### Ændringer

**`src/hooks/useLeagueData.ts`**
- Tilføj ny `useEnrollAsFan()` mutation der altid sætter `is_spectator = true`
- I `useEnrollInSeason()` — tilføj tjek af brugerens `system_role_key` via `position_id`. Hvis rollen er i en blocklist (`ejer`, `some`, `rekruttering`, `assisterende_teamleder_fm`, `fm_leder`), kast en fejl ("Din rolle tillader ikke deltagelse")

**`src/pages/CommissionLeague.tsx`**
- Hent brugerens rolle via `useUnifiedPermissions()` (allerede tilgængelig)
- Definer `canParticipate` boolean: `true` kun for `medarbejder` og `teamleder` roller
- Landing-sektion:
  - Vis "Tilmeld mig nu" kun hvis `canParticipate`
  - Vis altid "Bliv fan 👀"-knap for alle
- Enrolled-sektion:
  - Hvis fan (`enrollment.is_spectator`): vis leaderboard men **ikke** `MyQualificationStatus`, og vis "Du følger med som fan" badge
  - Skjul "Afmeld liga" → vis "Stop med at følge" for fans

**`src/hooks/useLeagueData.ts` — `LeagueEnrollment` interface**
- Tilføj `is_spectator?: boolean` til interfacet
- Opdater `useMyEnrollment` select til at inkludere `is_spectator`

### Rolleblocklist (kan ikke deltage, kun fan)
| Rolle | system_role_key |
|-------|----------------|
| Ejer | `ejer` |
| Ass. teamleder FM | `assisterende_teamleder_fm` |
| SoMe | `some` |
| Rekruttering | `rekruttering` |
| FM Leder | `fm_leder` |

### UI-flow

```text
Ikke tilmeldt + kan deltage:
  [🏆 Tilmeld mig nu]  [👀 Følg som fan]

Ikke tilmeldt + kan IKKE deltage (ejer etc.):
  [👀 Følg som fan]

Tilmeldt som deltager:
  → Ser standings + egen placering
  → [Afmeld liga]

Tilmeldt som fan:
  → Ser standings (uden egen placering)
  → Badge: "Du følger med som fan"
  → [Stop med at følge]
```

Ingen databaseændringer — `is_spectator` kolonne eksisterer allerede i `league_enrollments`.

