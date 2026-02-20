
# Tilpas logo-størrelse i sidebaren

## Problem
Logoet har klassen `h-40` (160px højt) men sidder i en header-container der kun er `h-24` (96px). Det flyder derfor ud over kanten og dækker bl.a. dashboard-knappen, så den ikke kan klikkes ordentligt.

## Løsning
Reducer logoets højde til `h-16` (64px) så det passer inden for headeren med lidt luft, og tilføj `overflow-hidden` på containeren som sikkerhedsnet.

## Tekniske detaljer

### Fil: `src/components/layout/AppSidebar.tsx`

**3 steder med `h-40` ændres til `h-16`:**

1. **Linje 405** (loading-state, desktop): `className="h-40 w-auto object-contain"` til `className="h-16 w-auto object-contain"`
2. **Linje 490** (desktop-visning): Samme ændring
3. Tjek om der også findes en mobilversion med samme problem

Derudover tilføjes `overflow-hidden` på header-containerne (linje 400 og 485) for at forhindre overflow.
