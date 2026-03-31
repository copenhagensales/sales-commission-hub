

## Problem

Divisions-visningen på TV'et viser kun ca. 10 ud af 14 spillere — de sidste rækker er afskåret i bunden. Rækkerne har for meget padding og spacing til at alle 14 spillere kan passe i den tilgængelige højde.

## Løsning

Gør divisions-rækkerne mere kompakte i `SceneDivisions`-komponenten og reducer padding i TV-mode, så alle 14 spillere er synlige uden scroll.

## Ændringer i `src/pages/tv-board/TvLeagueDashboard.tsx`

1. **Reducer højre-zone padding** i TV-mode: `p-8` → `p-4 pt-3` (linje 1110)

2. **Kompakte rækker i `SceneDivisions`** (linje 294-354):
   - Row spacing: `space-y-1 2xl:space-y-1.5` → `space-y-0.5 2xl:space-y-1`
   - Row padding: `py-1.5 2xl:py-2` → `py-1 2xl:py-1.5`
   - Row rounding: `rounded-xl` → `rounded-lg`

3. **Reducer header margin** i divisions: `mb-2 2xl:mb-4` → `mb-1 2xl:mb-2` (linje 269)

4. **Reducer legend margin**: `mt-2 2xl:mt-3` → `mt-1 2xl:mt-2` (linje 358)

5. **Reducer venstre-zone padding** i TV-mode: `p-8` → `p-4 pt-3` (linje 985), og header `mb-6` → `mb-3` (linje 987)

Disse ændringer sparer ca. 80-100px vertikal plads, nok til at vise alle 14 spillere.

