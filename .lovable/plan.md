# Stabil Status-kolonne på Claims/Reimport

Status-kolonnen skifter bredde afhængigt af om der findes godkendte rækker ("Afventer" er kort, "Godkendt · dato · navn" er lang), så kolonnen hopper vandret.

## Løsning
Lås Status-kolonnens bredde, så placeringen er den samme uanset indhold — som på det vedhæftede billede.

## Teknisk
`src/pages/vagt-flow/EesyFmDeviations.tsx`:
- I `TableHead`-mapningen: giv `col === "Status"` klassen `w-[260px] min-w-[260px] whitespace-nowrap` (Notat beholder `w-full` som fleks-kolonne).
- Status-cellen i rækkerne får samme faste bredde og venstrejusteret indhold.

Ingen ændringer i data eller logik.
