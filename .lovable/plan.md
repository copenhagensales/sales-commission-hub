Jeg fandt årsagen: filen har headers i C/M, men parseren fjerner tomme A/B fra header-listen og forskyder derfor data to kolonner. Samtidig kigger 5G-kampagneparseren positionsbaseret efter OPP i kolonne D og CPO i kolonne M. Den nuværende fil ender derfor med at blive læst som om `Produkt` er OPP-kolonnen og uden kolonne M.

Plan:
1. Generér en ny version af filen som `/mnt/documents/5gfil-med-headers-v2.xlsx`.
2. Bevar de oprindelige data-positioner, men udfyld også kolonne A og B med headers, så parseren ikke forskyder kolonnerne.
3. Brug præcise headers:
   - A: `Kol A`
   - B: `Kol B`
   - C: `Lukkedato`
   - D: `OPP nr.`
   - E: `Sælger`
   - F: `Produkt`
   - G: `Antal`
   - H: `Pris`
   - I: `Kampagne`
   - J: `Kol J`
   - K: `Kol K`
   - L: `Kol L`
   - M: `Kol M`
4. Verificér efter generering, at række 2 mapper korrekt: `Lukkedato = 46174`, `OPP nr. = OPP-1087496`, og at kolonne M stadig findes til CPO-rettelsen.

Ingen kodeændringer i projektet.