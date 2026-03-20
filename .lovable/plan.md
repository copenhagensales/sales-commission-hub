

# Flyt Movements & Records til venstre side — Divisioner altid i højre

## Nuværende layout
- **Venstre (40%)**: Top 3 podium, Prize Cards, Ticker (statisk)
- **Højre (60%)**: Roterer mellem Divisions → Movements → Records

## Nyt layout
- **Venstre (40%)**: Roterer mellem 3 scener:
  1. Top 3 podium + Prize Cards + Ticker (nuværende indhold)
  2. Movements (Dagens bevægelser + Top sidste time)
  3. Records (Statistik & Records)
- **Højre (60%)**: Kun divisioner (altid synligt, roterer internt mellem divisioner)

Begge sider bliver dynamiske — venstre roterer scener, højre roterer divisioner.

## Ændringer i `src/pages/tv-board/TvLeagueDashboard.tsx`

1. **Fjern scene-rotation fra højre side** — højre viser kun `SceneDivisions` permanent
2. **Tilføj scene-rotation til venstre side** med 3 left-scenes:
   - `"overview"` → Top 3 + Prize Cards + Ticker (15 sek)
   - `"movements"` → SceneMovements (20 sek)
   - `"records"` → SceneRecords (20 sek)
3. **Flyt scene-indikator dots** (de 3 streger i toppen) til venstre side
4. **Bevar header + timestamp** i venstre side (udenfor rotation)
5. **Fjern den ydre `SCENES` rotation** — erstat med en `leftSceneIndex` state

| Fil | Handling |
|-----|---------|
| `src/pages/tv-board/TvLeagueDashboard.tsx` | Omstrukturér layout: venstre roterer 3 scener, højre kun divisioner |

