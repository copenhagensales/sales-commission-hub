

# Fix: Sort baggrund på logoer i TV-tilstand

## Problem
Når "Salgsoversigt alle" vises på en fysisk TV-skarm, viser logo-containerne sort baggrund i stedet for hvid. I en normal browser ser det korrekt ud. Arsagen er sandsynligvis at TV-browseren (Samsung Tizen, LG webOS o.l.) har en "forced dark mode" der overskriver Tailwinds `bg-white` CSS-klasse.

## Losning
Erstat `bg-white` Tailwind-klassen pa logo-containerne med inline `style={{ backgroundColor: '#ffffff' }}`, som er mere modstandsdygtig over for forced dark mode. Desuden tilfojes `color-scheme: light` pa containeren for at signalere til browseren at elementet skal forblive i light mode.

## Teknisk aendring

**Fil:** `src/pages/dashboards/SalesOverviewAll.tsx`

Linje 196 -- logo-containeren i TV-mode:
```text
// Fra:
<div className="flex items-center justify-center rounded-xl bg-white h-16 w-32 p-3">

// Til:
<div
  className="flex items-center justify-center rounded-xl h-16 w-32 p-3"
  style={{ backgroundColor: '#ffffff', colorScheme: 'light' }}
>
```

Samme aendring for logo-containeren i normal-mode (linje ~259):
```text
// Fra:
<div className="flex items-center justify-center rounded-xl shadow-sm bg-white h-16 w-32 mb-3 p-2.5">

// Til:
<div
  className="flex items-center justify-center rounded-xl shadow-sm h-16 w-32 mb-3 p-2.5"
  style={{ backgroundColor: '#ffffff', colorScheme: 'light' }}
>
```

Dette sikrer at logoernes hvide baggrund altid renderes korrekt -- uanset TV-browserens dark mode-indstillinger.

