# Balders 460 salg vs. ~1.300 i Excel — forklaring

Der er ingen fejl i importen. Tallet 460 på skærmbilledet var et **cachet tal fra før opdateringen**. Ingen ændringer nødvendige.

## Evidens

**Excel-filen:** 1.379 rækker i alt, heraf 1.293 på Balder Møller Nørgaard (alle med status "Succes"), 1.291 unikke numre, 1.293 unikke Emne-ID'er.

**Databasen (`sales`, `agent_email = bamn@copenhagensales.dk`):**
- 1.290 salg oprettet i dag (10/8) — resten af afvigelsen er 2 dubletnumre og 3 rækker med ugyldigt/manglende mobilnummer.
- I lønperioden 15/7–14/8: **1.293 salg** fordelt over 19 salgsdage (15/7: 96, 16/7: 90 … 10/8: 7).
- Alle 1.290 nye salg har provisionslinjer (`sale_items`) — ingen ligger uden sats.

**Tavlen (`kpi_leaderboard_cache`, `payroll_period` / `global`):**
- Rækken beregnet 08:30 (før registreringen) havde de gamle tal — det er den, skærmbilledet viser (460 × 75 kr = 34.500 kr, præcis som billedet).
- Rækken beregnet 09:24 viser nu: `salesCount: 1293`, `commission: 96975` for Balder.

## Konklusion

Tavlen opdateres af `calculate-leaderboard-incremental` ca. hvert 2. minut. Skærmbilledet blev taget i vinduet mellem registrering og næste genberegning. Efter genberegningen står Balder korrekt med 1.293 salg og 96.975 kr i provision i lønperioden.

## Restpunkt (ingen handling nu)

3 rækker i filen blev afvist på ugyldigt mobilnummer og 2 på dublet — de fremgår i "Fejl i upload". Sig til hvis du vil have en liste over dem, så de kan rettes og uploades igen.
