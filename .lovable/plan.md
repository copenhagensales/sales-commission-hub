# Sean skal ikke stå på TDC Erhverv-boardet

## Årsag
Sidste rettelse fjernede kun Seans **fiberpoint** fra TDC-boardet (derfor står han med 0 fiber). Han står der stadig, fordi toplisterne (`ClientDashboard.tsx:111`, `useCachedLeaderboards`) hentes fra den fælles provisions-topliste for kunden TDC Erhverv. Leadet ligger på en TDC Erhverv-kampagne, så hans 625 kr. leadprovision lander i TDC's topliste – uanset at han er på Relatel.

## Ændring (kun boardvisning)
1. `tv-dashboard-data` (TDC-varianten af fiber-statistikken) returnerer også, pr. periode, de Relatel-leadgivere og den leadprovision, der skal ud af TDC-boardet (samme regel som nu: leadgiver var på Relatel, da leadet blev lavet).
2. `ClientDashboard.tsx` trækker den provision fra på TDC-boardet og fjerner sælgeren fra toplisten, hvis der så intet er tilbage (0 salg, 0 fiber, 0 kr.). Har en sælger også rigtige TDC-salg, bliver han stående med resten.
3. Relatel-boardet er uændret (Sean vises der med 1 fiber).

Ingen ændring af provision, løn, salg, dagsrapporter, den fælles topliste-beregning eller databasen.

## Kontrol
- Kald `tv-dashboard-data` og bekræft at Sean er markeret til udelukkelse for i dag/uge/lønperiode.
- TDC-boardet: Sean væk fra Top i dag/uge/lønperiode; Oliver uændret med 0,5 fiber/625 kr.
- Relatel-boardet: Sean stadig med 1 fiber.
