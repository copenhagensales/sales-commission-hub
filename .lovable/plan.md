

# Omdefinér Streak: "Overgå dagen før i indtjening"

## Ny definition
En streak-dag tæller når dagens provision er **højere end gårsdagens**. Streaken brydes hvis du tjener **mindre end eller lig med** dagen før. Weekender/fridage ignoreres (sammenlign med seneste arbejdsdag).

## Påvirkede områder

### 1. Streak-logik i `src/hooks/useSalesGamification.ts`
- Ændr `hitDailyGoal`-beregningen fra `todayTotal >= dailyTarget` til en sammenligning med gårsdagens provision
- Tilføj `yesterdayTotal` som ny prop (eller hent den internt via `get_personal_daily_commission`)
- Streak tæller op hvis `todayTotal > yesterdayTotal` (og `todayTotal > 0`)
- `streakAtRisk` ændres til: du har en streak, men har endnu ikke overgået gårsdagen

### 2. Datakilde: Gårsdagens provision
- Tilføj en `useQuery` i `useSalesGamification` der henter de sidste 2 arbejdsdages provision via `get_personal_daily_commission` RPC (allerede eksisterer)
- Alternativt: Udvid props med `yesterdayTotal` fra den kaldende komponent

### 3. UI-tekster der skal opdateres
- **`src/components/my-profile/SalesRecords.tsx`** og **`CompactSalesRecords.tsx`**: Ændr "dags streak" beskrivelse og `streakAtRisk`-tekst fra "Nå dit dagsmål" til "Overgå gårsdagen"
- **`src/components/my-profile/SalesStreakBadge.tsx`**: Opdater tooltip/beskrivelse
- **`src/lib/gamification-achievements.ts`**: Ændr achievement-beskrivelser fra "Sælg noget X dage i træk" til "Overgå dagen før X dage i træk"

### 4. Streak-mutation logik
- `updateStreakMutation` i `useSalesGamification.ts`: Behold eksisterende incrementering, men ændr betingelsen fra `hitDailyGoal` til `todayTotal > yesterdayTotal`
- Tabellen `employee_sales_streaks` behøver ingen skemaændringer

### 5. TV Dashboard (den godkendte plan)
- I den kommende udvidelse: Brug den nye streak-definition som KPI i stedet for "aktive dage" eller "mest konsistent"
- Vis f.eks. "Længste streak" (flest dage i træk med stigende provision) som erstatning

### 6. League Motivation Bar (`src/components/league/LeagueMotivationBar.tsx`)
- Opdater streak-relaterede motivationsbudskaber til at referere til "overgå gårsdagen"

## Ændringer

| Fil | Handling |
|-----|---------|
| `src/hooks/useSalesGamification.ts` | Hent gårsdagens provision, ændr streak-betingelse til `today > yesterday` |
| `src/components/my-profile/SalesRecords.tsx` | Opdater streak-tekster til ny definition |
| `src/components/my-profile/CompactSalesRecords.tsx` | Opdater streak-tekster |
| `src/components/my-profile/SalesStreakBadge.tsx` | Opdater beskrivelse |
| `src/lib/gamification-achievements.ts` | Ændr streak-achievement beskrivelser |
| `src/components/league/LeagueMotivationBar.tsx` | Opdater streak-motivationstekster |

Ingen databaseændringer nødvendige — tabellen `employee_sales_streaks` forbliver uændret.

