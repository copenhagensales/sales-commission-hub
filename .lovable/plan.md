

## Vis kun til og med 3. Division på TV-boardet

Filtrer divisions-data i `TvLeagueDashboard.tsx` så kun division 1–4 vises (Superligaen, 1. Division, 2. Division, 3. Division).

### Ændringer i `src/pages/tv-board/TvLeagueDashboard.tsx`

1. **Filtrér divisions** efter data er hentet — tilføj en konstant `MAX_DIVISION = 4` og filtrér `data.divisions` overalt hvor det bruges:
   - `SceneDivisions` — kun divisioner ≤ 4
   - `SceneLeagueOverview` — kun divisioner ≤ 4
   - Opdatér `totalDivisions`-visningen til at reflektere det filtrerede antal

2. **Steder der skal opdateres** (ca. 6 linjer):
   - Linje ~888: `<SceneDivisions divisions={data.divisions.filter(d => d.division <= 4)}` />
   - Linje ~952: Samme filter på `SceneLeagueOverview`
   - Linje ~1091: Samme filter på desktop `SceneLeagueOverview`
   - Tilsvarende `totalDivisions` props opdateres til filtreret antal

3. **Ingen backend-ændringer** — edge function leverer stadig alle divisioner, men frontend viser kun de øverste 4.

