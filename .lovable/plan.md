

# Fix: Comeback beregnes fra kval-placering (ikke runde 1)

## Problem
Comeback-logikken (linje 220-270) bruger runde 1-placeringer som baseline. Men ifølge reglerne er det **kvalifikationsrundens endelige placering** der er udgangspunktet. Vinderen er den der rykker flest pladser fra kval-slutplacering til nuværende/endelig placering.

Derudover kræver den nuværende kode at runde 1 er **afsluttet** (`league_round_standings` populeret) — så under runde 1 vises ingen comeback-data.

## Ændring

### `src/hooks/useLeaguePrizeData.ts` — Comeback-blokken (linje 220-271)

**Erstat** baseline fra `league_round_standings` (runde 1) med `league_qualification_standings.overall_rank`:

```
Gammel logik:
  startRank = runde 1 placering (fra league_round_standings)
  currentRank = overall_rank (fra league_season_standings)
  improvement = startRank - currentRank

Ny logik:
  startRank = overall_rank fra league_qualification_standings (kval-slutplacering)
  currentRank = overall_rank fra league_season_standings
  improvement = startRank - currentRank
```

- Fjern opslaget af `round1` og `round1Standings`
- Hent i stedet `league_qualification_standings` med `employee_id, overall_rank` for `season_id`
- Brug kval `overall_rank` som baseline
- Virker allerede fra runde 1 (kval-data eksisterer altid når sæsonen er aktiv)

| Fil | Ændring |
|-----|---------|
| `src/hooks/useLeaguePrizeData.ts` | Brug kval-placering som comeback-baseline i stedet for runde 1 |

