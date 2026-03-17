

## Plan: Klikbare præmiebokse med ranglister i dialog

### Oversigt
Gør hver præmieboks klikbar, så den åbner en Dialog med den fulde rangliste for den pågældende kategori.

### Ændringer

**1. `src/hooks/useLeaguePrizeData.ts` — Udvid til at returnere fulde lister**

Hooket returnerer i dag kun top-1 per kategori. Udvid `PrizeLeaders` med:
- `allByPoints: Array<{employee, total_points}>` — alle spillere sorteret efter total_points (bruges til Top 3 dialog)
- `allBestRounds: Array<{employee, points_earned, round_number}>` — alle runde-standings sorteret efter points_earned desc (bedste runde per spiller, eller alle entries)
- `allTalents: Array<{employee, total_points}>` — kun spillere med < 3 mdr ansættelse og total_points > 0
- `allComebacks: Array<{employee, improvement}>` — alle med positiv rank-forbedring, sorteret desc

Dataen er allerede hentet i hooket (standingsWithDates, round1Standings, currentStandings) — vi skal bare returnere de fulde arrays i stedet for kun top-1.

**2. `src/components/league/PrizeShowcase.tsx` — Tilføj Dialog per boks**

- Importér `Dialog, DialogContent, DialogHeader, DialogTitle` fra UI
- Tilføj state: `openDialog: 'top3' | 'bestRound' | 'talent' | 'comeback' | null`
- Gør hver boks til en `<button>` der sætter `openDialog` (kun hvis `isActive`)
- Render 4 dialoger:
  - **Top 3**: Fuld rangliste af alle spillere med point, sorteret desc. Viser rank, navn, point.
  - **Bedste Runde**: Alle runde-præstationer sorteret efter points_earned. Viser rank, navn, point, runde-nummer.
  - **Sæsonens Talent**: Alle kvalificerede talenter med point > 0, sorteret desc. Viser rank, navn, point.
  - **Sæsonens Comeback**: Alle med positiv rank-stigning, sorteret desc. Viser rank, navn, "+X pladser".
- Brug `formatPlayerName` for navne, da-DK locale for tal
- Simpel tabel-lignende liste med alternerende rækker

### Ingen database-ændringer
Al data er tilgængelig fra eksisterende tabeller.

