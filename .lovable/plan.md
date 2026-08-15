# Sortering på Claims/Reimport

## Hvad
På fanen "Claims/Reimport" bliver kolonnetitlerne "Salgsdato" og "Sælger" klikbare. Første klik sorterer stigende, andet klik faldende, og en lille pil viser retningen. Standard er nyeste salgsdato først. De øvrige kolonner er ikke sorterbare.

## Teknisk
- `src/pages/vagt-flow/EesyFmDeviations.tsx` (`DeviationsPanel`):
  - Ny state `sortKey: "date" | "seller"` (default `date`) og `sortDir: "asc" | "desc"` (default `desc`).
  - `claimRows` udvides med sortering efter filtrering: dato via `saleDatetime`, sælger via `sellerName.localeCompare(..., "da")`.
  - I `TableHeader` gøres "Salgsdato" og "Sælger" til knapper (kun når `claimsMode`) med `ChevronUp`/`ChevronDown`-ikon på den aktive kolonne; klik på samme kolonne skifter retning, klik på anden kolonne sætter default-retning.
- Kun UI/præsentation — ingen ændringer i hooks, data eller logik.
