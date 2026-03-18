

## LeagueMotivationBar — Intelligent Coach-bjælke

### Koncept

Én **dynamisk, coachende bjælke** der vælger de **3 mest motiverende beskeder** baseret på spillerens aktuelle situation. Ikke et statisk dashboard — en prioriteringsmotor der altid viser det mest handlingsanvisende.

Hver besked følger formlen: **Status + gevinst + næste handling**

### Prioriteringslogik (vælg top 3 fra denne liste)

| Prioritet | Signal | Betingelse | Besked-eksempel |
|---|---|---|---|
| 1 | 🔥 Streak i fare | `currentStreak > 0 && !hitDailyGoal` | "🔥 5 dages streak — 1 salg mere holder den i live!" |
| 2 | 🏁 Tæt på overhalning | gap til spiller over < 2.000 kr | "Kun 950 kr til at overhale #4 — det er inden for rækkevidde i dag" |
| 3 | 🎯 Tæt på dagens mål | har dailyTarget og mangler < 50% | "600 kr til dagens mål — du er næsten der!" |
| 4 | 🔥 Streak kører | `currentStreak >= 3` | "🔥 5 dages streak! Hold tempoet de næste timer" |
| 5 | 📈 Stærk uge-momentum | currentWeek > lastWeek | "+34% vs. forrige uge — hold tempoet de næste 2 timer" |
| 6 | ⚠️ Nogen tæt bag dig | gap fra spiller under < 1.500 kr | "#8 er kun 700 kr bag dig — hold afstanden!" |
| 7 | 💰 Ekstra indsats | altid tilgængelig (baseret på top 3 dage) | "Hver time ekstra ≈ X kr · Lørdag = +X.XXX kr" |
| 8 | 📈 Svag uge (konstruktivt) | currentWeek < lastWeek | "Du er ikke langt fra sidste uge — 2 gode timer kan vende den" |
| 9 | 🏆 Tæt på personlig rekord | todayTotal > 80% af bestDayRecord | "Du er 12% fra din personlige rekord — push!" |
| 10 | 🚀 Ny streak | `currentStreak === 0` | "Start en ny streak i dag — dit første salg tæller!" |

**Negativt momentum frames aldrig negativt** — altid "du er tæt på" eller "X kan vende den".

### Ekstra indsats-beregning

```text
dailyBreakdown (14 dage)
  → filtrer dage med commission > 0 (inkl. lørdage)
  → sortér desc, tag top 3
  → avgTopDay = sum(top3) / 3
  → hourlyRate = avgTopDay / 8
  → saturdayValue = hourlyRate * 8
```

Bruger top 3 dage — aspirationelt: "hvad du kan når du giver den gas".

### Data-kilder (alle eksisterende)

- `usePersonalWeeklyStats(employeeId)` → uge-momentum, dailyBreakdown for hourly rate
- `useSalesGamification(...)` → streak, bestDayRecord, hitDailyGoal, dailyTarget, todayTotal
- `myStanding` + `standings[]` (props) → liga-gap beregning

### Visuelt design

- Glasmorfisk bar: `bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg`
- **3 beskeder** i `grid-cols-1 md:grid-cols-3` med subtile dividers
- Hvert element: relevant ikon + 1-2 linjer tekst, nøgletal i `text-amber-400 font-semibold`
- Kompakt: `py-3 px-4`, `animate-fade-in`
- Farvekodning: grøn (fremdrift), amber (udfordring), rød kun ved streak-i-fare

### Ny fil

**`src/components/league/LeagueMotivationBar.tsx`**

```typescript
interface LeagueMotivationBarProps {
  employeeId: string;
  myStanding: QualificationStanding | null;
  standings: QualificationStanding[];
  dailyTarget: number;
  todayTotal: number;
  currentWeekTotal: number;
}
```

Internt kalder den `usePersonalWeeklyStats` og `useSalesGamification`, beregner top-3-dage hourly rate, og kører prioriteringslogikken for at vælge de 3 mest relevante beskeder.

### Integration i CommissionLeague.tsx

Indsættes mellem hero-header (linje ~336) og PrizeShowcase (linje ~338), kun for enrolled non-fan spillere:

```tsx
{isEnrolled && !isFan && currentEmployeeId && (
  <LeagueMotivationBar
    employeeId={currentEmployeeId}
    myStanding={isActivePhase ? mySeasonStanding : myStanding}
    standings={isActivePhase ? (seasonStandings || []) : (standings || [])}
    dailyTarget={0}
    todayTotal={0}
    currentWeekTotal={weeklyStats?.currentWeek?.weekTotal ?? 0}
  />
)}
```

### Filer der ændres
1. **Ny**: `src/components/league/LeagueMotivationBar.tsx`
2. **Edit**: `src/pages/CommissionLeague.tsx` — import + indsæt

