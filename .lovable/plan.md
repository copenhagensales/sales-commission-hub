

## Justeret Pointmodel: Division-først Ranking

### Problemet
Med den nuværende multiplikator-model kan #10 i Div 1 (0 × 2.0 = 0 pt) score lavere end #1 i Div 5 (10 × 0.5 = 5 pt). Det skal altid være bedre at være i en højere division.

### Løsning: Lineær division-først model

Formel:
```text
points = (total_divisions - division) × players_per_division + (players_per_division - rank + 1)
```

Med 5 divisioner à 10 spillere:
```text
Div 1: #1=50, #2=49, ... #9=42, #10=41
Div 2: #1=40, #2=39, ... #9=32, #10=31
Div 3: #1=30, #2=29, ... #9=22, #10=21
Div 4: #1=20, #2=19, ... #9=12, #10=11
Div 5: #1=10, #2=9,  ... #9=2,  #10=1
```

**Garanti:** #10 i Div 1 (41 pt) > #1 i Div 2 (40 pt). Altid.

### Fordele
- Simpel og gennemsigtig — spillere kan hurtigt forstå deres point
- Skalerer automatisk med antal divisioner og spillere pr. division (bruger `players_per_division` fra `season.config`)
- Ingen konfigurerbare multiplikatorer — færre fejlkilder
- Op/nedrykning har massiv betydning (10 point forskel pr. division)

### Teknisk ændring ift. den godkendte plan
- Fjern `multiplier` kolonne fra `league_round_standings` — erstat med den simple formel
- `base_points` omdøbes til `points_earned` og beregnes direkte
- Edge function `league-process-round` bruger formlen i stedet for lookup-tabel + multiplikator
- Resten af planen (tabeller, hooks, UI, op/nedrykning) er uændret

