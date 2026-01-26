
# Plan: Personlig liga-visning med "din placering + nærmeste 2 over/under"

## Ændring
Opdater `LeaguePromoCard` på `/home` til at vise en mere relevant og personlig liga-visning, hvor brugeren ser sin egen placering med de 2 nærmeste spillere over og under sig - i stedet for blot at vise top 3.

## Nuværende adfærd
```
Top 3 lige nu:
🥇 Kasper M - 45.000 kr
🥈 Anna S - 42.000 kr
🥉 Peter L - 38.000 kr

Din placering:
#15 Jonas K - 18.000 kr
```

## Ny adfærd
```
Din placering i ligaen:
#13 Maria H - 19.200 kr
#14 Thomas B - 18.800 kr
#15 Jonas K (dig) - 18.000 kr  ← Fremhævet
#16 Louise M - 17.500 kr
#17 Frederik J - 17.000 kr
```

## Visningslogik

| Scenario | Hvad vises |
|----------|-----------|
| Bruger er i top 3 | Top 5 (da der ikke er nogen over dig) |
| Bruger er #4 eller #5 | Top 5 + brugeren fremhævet |
| Bruger er midt i feltet | 2 over + bruger + 2 under (5 i alt) |
| Bruger er i bunden | De nederste 3-5 med bruger fremhævet |
| Bruger ikke enrolled | Top 3 (nuværende adfærd) |

## Implementering

### Fil: `src/components/league/LeaguePromoCard.tsx`

1. **Ændre data-fetch logik**
   - I stedet for at hente "top 3", henter vi alle standings for brugeren
   - Brug eksisterende `useQualificationStandings` hook der allerede henter sorteret efter rank
   - Find brugerens position og slice de relevante 5 personer

2. **Ny hjælpefunktion: `getNeighborStandings`**
   ```text
   Input: allStandings[], myEmployeeId
   Output: { visibleStandings[], myIndex }
   
   Logik:
   - Find brugerens index i listen
   - Beregn start/slut for 5-personers vindue
   - Håndter edge cases (top/bund af listen)
   ```

3. **Opdater UI**
   - Fjern "Top 3 lige nu" header
   - Erstat med "Din placering i ligaen"
   - Vis rank nummer (#13, #14, #15...) i stedet for medaljer
   - Fremhæv brugerens egen række med primær farve og "(dig)" label

4. **Fallback for ikke-enrolled brugere**
   - Hvis brugeren ikke er enrolled, vis top 3 som før
   - Dette motiverer dem til at tilmelde sig

## UI-eksempel (enrolled bruger)

```
┌─────────────────────────────────────────┐
│ 🏆 Salgsligaen                 45 tilmeldt │
├─────────────────────────────────────────┤
│ Din placering i ligaen                   │
│                                          │
│ #13  Maria H        19.200 kr           │
│ #14  Thomas B       18.800 kr           │
│ #15  Jonas K (dig)  18.000 kr  ← blå bg │
│ #16  Louise M       17.500 kr           │
│ #17  Frederik J     17.000 kr           │
│                                          │
│ [     Se din position →    ]             │
└─────────────────────────────────────────┘
```

## Edge cases

1. **Færre end 5 tilmeldte**: Vis alle
2. **Bruger er #1**: Vis top 5 (ingen over)
3. **Bruger er sidst**: Vis de sidste 3-5
4. **Bruger er lige tilmeldt (ingen standing endnu)**: Vis top 3 med besked "Du er med - standings opdateres snart"

## Teknisk tilgang

Ændringerne holdes i én fil (`LeaguePromoCard.tsx`) og bruger eksisterende hooks og data.

**Ny query-strategi:**
- Hent standings via en ny "neighbor standings" query der finder brugerens position + naboer
- Alternativt: brug allerede fetchede `useQualificationStandings` og filtrer client-side (simplere)

For optimal performance vælger vi client-side filtrering, da standings-data allerede caches og bruges andre steder.
