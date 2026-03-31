

## Problem

Billedet viser at 3-kolonne layoutet virker, men kun ca. 3-4 sælgere er synlige per kolonne. Resten er skjult under kanten. Rækkerne har for meget padding/spacing til at 20 entries kan passe i den tilgængelige højde.

## Løsning

Gør rækkerne mere kompakte i TV-mode, så flere entries er synlige uden scroll. Reducer padding, avatar-størrelse og font-sizes per række. Gør også header og top-margin mindre for at frigøre plads.

## Ændringer i `src/pages/CsTop20Dashboard.tsx`

1. **Reducer top-header**: `mb-6` → `mb-3`, `text-4xl` → `text-2xl`, fjern subtitle-teksten i TV-mode for at spare plads.

2. **Reducer grid gap**: `gap-6` → `gap-4`.

3. **Reducer padding i container**: `p-8` → `p-4`.

4. **Kompakte rækker i TV-mode**:
   - Row padding: `px-4 py-3` → `px-3 py-1.5`
   - Avatar: `h-10 w-10` → `h-7 w-7`
   - Navn: `text-base` → `text-sm`
   - Commission badge: `text-base px-3 py-1.5` → `text-sm px-2 py-1`
   - Rank emoji: `text-xl` → `text-base`
   - Salg-tekst: `text-xs` → `text-[10px]`
   - Team badge: `text-[11px]` → `text-[9px]`

5. **Card header kompakt**: `pb-4` → `pb-2`, titel `text-xl` → `text-base`.

Dette skulle give plads til ca. 15-20 entries per kolonne i stedet for 3-4.

