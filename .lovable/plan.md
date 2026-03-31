

## Problem

Billedet viser at indholdet stadig er klemt sammen i øverste venstre hjørne på TCL-skærmen. Årsagen er at TV-browserens CSS viewport sandsynligvis rapporterer ~1920×1080 (ikke 4K pixels), så `scaleFactor` bliver ~1.0 og den faste `1920×1080`-container hjælper ikke. Desuden stjæler TV-browserens toolbar plads i bunden.

## Løsning

Fjern den faste `1920×1080` dimension og scale-wrapper tilgangen i TV-mode. Brug i stedet viewport-relative units (`100vw` / `100vh`) så dashboardet altid fylder hele den tilgængelige skærmplads ud, uanset hvad TV-browseren rapporterer.

## Ændringer i `src/pages/tv-board/TvLeagueDashboard.tsx`

1. **Fjern scale-wrapper i TV-mode**: Returner `desktopContent` direkte i `DashboardShell` (ligesom desktop-mode).

2. **Ændr TV-mode container** fra fast `w-[1920px] h-[1080px]` til `w-screen h-screen` (fylder hele viewport).

3. **Fjern ubrugte imports**: `useTvScreenAdapter`, `getTvScaleStyles`, `getTvCenteringStyles` (bruges ikke længere).

4. **Skaler tekst op i TV-mode**: Erstat de små `2xl:`-breakpoints med større base-størrelser i TV-mode, f.eks.:
   - Titler: `text-2xl` → `text-4xl`
   - Spillernavne: `text-base` → `text-lg`
   - Provision-tal: `text-sm` → `text-lg`
   - Padding: `p-3` → `p-6`
   
   Dette gøres ved at tilføje en `tvClass`-hjælper eller inline conditionals der bruger større størrelser når `tvMode` er aktiv.

## Resultat

Dashboardet vil altid fylde hele TV-skærmen ud — uanset om browseren rapporterer 1080p, 4K eller noget midt imellem. Tekst og spacing vil være proportionelt større og læsbart på afstand.

