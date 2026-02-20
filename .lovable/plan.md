
# Fix: Gør logoet synligt igen i sidebaren

## Problem
Logoet blev reduceret fra `h-40` (160px) til `h-16` (64px), hvilket kan gøre det for lille til at være tydeligt synligt. Derudover kan `overflow-hidden` på containeren klippe logoet uhensigtsmæssigt.

## Løsning
Øg logoets højde til `h-20` (80px) -- et kompromis der passer inden for `h-24` containeren uden at flyde ud over kanten. Behold `overflow-hidden` som sikkerhedsnet.

## Tekniske detaljer

### Fil: `src/components/layout/AppSidebar.tsx`

**3 ændringer:**

1. **Linje 405** (loading-state, desktop): Ændr `h-16` til `h-20`
2. **Linje 490** (desktop-visning): Ændr `h-16` til `h-20`
3. Evt. mobilversionen hvis den også bruger `h-16`

Resultat: Logoet fylder 80px i højden, passer fint i den 96px høje header, og er tydeligt synligt.
