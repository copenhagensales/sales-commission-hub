# TDC Månedsmål: on-track-indikering

Prompten er god og kan implementeres stort set som beskrevet. Nedenfor er planen med de justeringer jeg vil lave.

## Gennemgang af prompten — hvad jeg ændrer/tilføjer

1. **Zone:** `src/lib/calculations/*` er rød zone (lønberegning). Beregningen lægges derfor i en ny, isoleret fil `src/lib/boardProgress.ts` — ikke i `dates.ts`. Den eksisterende `countWorkDaysInPeriod` i `dates.ts` bruges kun læsende (import), så lønlogik røres ikke.
2. **Nuværende `barColor`:** de individuelle barer farves i dag efter opnået procent (grøn ≥100, blå ≥75, gul ≥50, ellers rød). Den erstattes for sælgerrækkerne af status-farven (grøn/amber/rød), som prompten beskriver. Den fælles bar beholder sin nuværende farvelogik, medmindre du vil have status-farve der også — jeg lader den være, da markør + ghost er signalet der.
3. **Sælgere uden mål (mål = 0):** har ingen bar i dag. Det bevares — status beregnes ikke for dem (ingen tvivl om en "grøn" nulrække).
4. **Timezone:** "i dag" udledes af browserens lokale tid, hvilket på TV'et er dansk tid. Måneden er samme kalendermåned som resten af boardet bruger.
5. **Helligdage:** som ønsket lægges `const HELLIGDAGE: string[] = []` (ISO `YYYY-MM-DD`) i beregningsfilen og filtreres fra i begge hverdagstællinger. Note: databasen har allerede en `danish_holiday`-tabel — den kan kobles på senere, hvis du vil have dem automatisk.
6. **Tærskler:** `ON_TRACK_DAGE = 1` og `EFTER_DAGE = 2` som konstanter øverst.

## Beregning (delt hjælpefunktion)

`src/lib/boardProgress.ts`:

```text
arbejdsdageTotal = hverdage i måneden (minus HELLIGDAGE)
arbejdsdageGaaet = hverdage fra 1. til og med dagen før i dag (minus HELLIGDAGE)
forventet        = mål * (arbejdsdageGaaet / arbejdsdageTotal)
gab              = forventet - faktisk
dagspace         = mål / arbejdsdageTotal
status: gab <= 1*dagspace -> "on-track"
        gab <= 2*dagspace -> "efter"
        ellers            -> "bagud"
```

Returnerer `{ forventet, forventetPct, gab, dagspace, status }`. Ingen særregel for månedens første hverdag.

## UI-ændringer i `TdcMonthlyGoalBoard.tsx`

**Fælles bar:**
- Ghost-fyld 0 → `forventetPct` i samme farve, ~25% opacity, bag det solide fyld.
- Lodret markør ved `forventetPct`: 2px, fuld barhøjde, lys tekstfarve, afrundet.
- Lille label "forventet" ved markøren.
- Metadatalinje: `X% opnået · forventet 39 · 835 tilbage`.

**Individuelle rækker:**
- Kun fyldfarven ændres efter status: on-track = grøn, efter = amber, bagud = rød. Ingen markør, ghost, ekstra tekst eller tooltips. Ingen legende.

## Filer
- `src/lib/boardProgress.ts` (ny, grøn zone)
- `src/pages/dashboards/TdcMonthlyGoalBoard.tsx` (præsentation)
