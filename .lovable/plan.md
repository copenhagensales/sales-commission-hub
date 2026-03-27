

## Tillad handlinger på helligdage i vagtplan-oversigten

### Problem
I `ShiftOverview.tsx` er helligdage fuldstændig blokeret:
1. **Linje 1398**: Helligdags-celler får `cursor-not-allowed` styling
2. **Linje 1519**: Popover-menuen (med "Opret vagt", "Ferie", "Syg" osv.) vises slet ikke for helligdage (`{!holiday && (...)}`)

Brugeren kan derfor ikke oprette vagter, registrere fravær eller gøre noget som helst på helligdage.

### Løsning
Ændringer i **`src/pages/shift-planning/ShiftOverview.tsx`**:

1. **Fjern `cursor-not-allowed`** fra helligdags-celler (linje 1398) — behold den dæmpede baggrundsfarve men gør cellen klikbar
2. **Vis popover-menuen på helligdage** (linje 1519) — fjern `!holiday &&` betingelsen så menuen åbnes når man klikker
3. **Tilføj hover-effekt** på helligdage (linje 1400) — så de også får `hover:bg-muted/30`

Kun én fil ændres. Ingen database-ændringer.

