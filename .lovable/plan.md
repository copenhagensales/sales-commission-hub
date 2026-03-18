

## Runde-navigation: Kun aktive og færdigspillede runder

### Ændring

**`src/hooks/useLeagueActiveData.ts`** — `useRoundHistory` (linje 170-185):
- Ændr filteret fra `.eq("status", "completed")` til `.in("status", ["completed", "active"])`
- Sortér ascending (`round_number asc`) så runder vises i kronologisk rækkefølge

**`src/pages/CommissionLeague.tsx`** — Aktiv-sæson sektionen:
- Erstat de tre tabs med en navigerbar header med venstre/højre pile (ChevronLeft/ChevronRight)
- Tilføj `selectedRoundIndex` state: `-1` = "Samlet stilling", `0..n` = specifik runde
- Byg en sorteret liste af tilgængelige runder fra `useRoundHistory` (som nu kun returnerer `completed` + `active`)
- Hent `useRoundStandings` for den valgte runde når index ≥ 0
- Vis `ActiveSeasonBoard` ved "Samlet", `RoundResultsCard` ved valgt runde
- Deaktivér venstrepil på "Samlet", højrepil på seneste runde

Runder med status `pending` eller `scheduled` vil ikke indgå — kun runder der er i gang eller afsluttede kan bladres.

