
# Fix: Mulighed for at fjerne Fridag og Udeblivelse

## Problem identificeret
Når en leder tilføjer en **Fridag** eller **Udeblivelse** til en medarbejder, vises knappen **"Fjern status"** ikke i popover-menuen. Det betyder, at det ikke er muligt at slette/fjerne disse fraværstyper, hvis man har lavet en fejl.

## Årsag
I `ShiftOverview.tsx` (linje 1356) defineres `hasStatus` som:

```javascript
const hasStatus = isVacation || isSick || isLate;
```

Her mangler `isDayOff` (Fridag) og `isNoShow` (Udeblivelse).

Derfor vises "Fjern status" knappen (linje 1657-1669) **kun** for:
- Ferie (vacation)
- Syg (sick)
- Forsinket (late)

Men **ikke** for:
- Fridag (day_off) ❌
- Udeblivelse (no_show) ❌

## Løsning
Opdatér `hasStatus` til at inkludere alle fraværstyper:

```javascript
// Før
const hasStatus = isVacation || isSick || isLate;

// Efter
const hasStatus = isVacation || isSick || isLate || isDayOff || isNoShow;
```

## Fil der ændres
`src/pages/shift-planning/ShiftOverview.tsx` - linje 1356

## Resultat
Efter ændringen vil "Fjern status" knappen vises for alle fraværstyper:
- Ferie ✅
- Syg ✅
- Forsinket ✅
- Fridag ✅ (ny)
- Udeblivelse ✅ (ny)

Dette gør det muligt at rette fejlindtastninger for alle fraværstyper.

## Teknisk detalje
Den eksisterende `handleClearStatus()` funktion (linje 960-974) håndterer allerede sletning af alle absence-typer korrekt - den kalder `deleteAbsence.mutate(absenceToDelete.id)` uanset hvilken type det er. Derfor kræves kun én enkelt linje ændring.
