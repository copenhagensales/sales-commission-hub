

# Fix: Liga-side for aktiv sæson + rundehistorik

## Problemer fundet

**1. Kvalifikations-UI vises altid (uanset sæson-status)**
Linje 486-604 i `CommissionLeague.tsx` viser kvalifikationsboardet for alle tilmeldte brugere — uden at tjekke om sæsonen stadig er i "qualification". Det betyder at selvom sæsonen nu er "active", vises det gamle kvalifikationsboard med de kumulative tal fra kvalifikationsperioden.

**2. ActiveSeasonBoard viser kumulativ provision — ikke runde-provision**
`ActiveSeasonBoard` viser `total_provision` fra `league_season_standings`, som er kumulativt. Ifølge reglerne bestemmes din placering i divisionen af din provision **i den aktuelle runde** (uge). Boardet skal vise den aktuelle rundes provision som primær metric.

**3. Rundenavigation mangler tydelig historik-UI**
Runde-navigationen (linje 646-697) eksisterer men viser kun resultater for færdige runder via `RoundResultsCard`. Der mangler en tydelig oversigt over færdige runder.

## Plan

### 1. Wrap kvalifikations-UI i `isQualificationPhase` guard
**Fil:** `CommissionLeague.tsx` (linje 486)
- Ændr `{isEnrolled && (` til `{isQualificationPhase && isEnrolled && (`
- Sikrer at kvalifikationsboardet kun vises under kvalifikation

### 2. Ny hook: `useLeagueRoundProvision`
**Ny fil:** `src/hooks/useLeagueRoundProvision.ts`
- Tager `currentRound` (med `start_date` og `end_date`) og liste af employee IDs
- Kalder `get_sales_aggregates_v2` med rundens datoer og `p_group_by: "employee"`
- Returnerer `Record<string, number>` (employee_id → provision i runden)
- Refetch hver 2. minut (som `useLeagueTodayProvision`)

### 3. Opdater `ActiveSeasonBoard` til at vise runde-provision
**Fil:** `ActiveSeasonBoard.tsx`
- Tilføj ny prop `roundProvisionMap: Record<string, number>`
- Vis `roundProvisionMap[employee_id]` som primær provision-visning (i stedet for `total_provision`)
- Behold `total_points` og `total_provision` som sekundær info
- Sortér spillere indenfor division efter runde-provision (afspejler aktuel rangering)

### 4. Tilslut runde-provision i `CommissionLeague.tsx`
- Importér `useLeagueRoundProvision` og kald med `currentRound`
- Send `roundProvisionMap` til `ActiveSeasonBoard`

### 5. Forbedret rundehistorik-navigation
**Fil:** `CommissionLeague.tsx` (linje 646-697)
- Tilføj en dropdown/tabs med alle afsluttede runder i stedet for kun pile-navigation
- Vis rundenummer + datoer + status (afsluttet/i gang)
- "Samlet stilling" som standard, med mulighed for at klikke ind på specifikke runder

## Tekniske detaljer

| Fil | Ændring |
|-----|---------|
| `src/pages/CommissionLeague.tsx` | Guard qualification UI med `isQualificationPhase`, tilslut runde-provision, forbedret rundehistorik-UI |
| `src/hooks/useLeagueRoundProvision.ts` | Ny hook der henter provision scoped til aktuel runde |
| `src/components/league/ActiveSeasonBoard.tsx` | Vis runde-provision som primær, total points som sekundær |

