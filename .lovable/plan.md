# Skjul godkendte claims

Tilføj en toggle "Skjul godkendte" ved siden af status-pillerne (Alle / Afventer / Godkendt) på fanen Claims/Reimport.

## Adfærd
- Default slået fra (false) — alle claims vises som i dag.
- Slået til: rækker med status "Godkendt" filtreres væk fra listen.
- Virker sammen med de øvrige filtre (periode, søg, medarbejder, status).

## Teknisk
`src/pages/vagt-flow/EesyFmDeviations.tsx`:
- Ny state `hideApproved` (default `false`).
- `Switch` + label placeret i samme række som status-pillerne (kun når `claimsMode`).
- I `claimRows`-filteret: hvis `hideApproved` er true, ekskluder `sale.approved === true`.

Ingen ændringer i data-lag eller database.
