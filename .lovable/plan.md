# Verifikation: Balders 3 fejlrækker i bulk-uploaden

Konklusion: de 3 rækker blev **ikke** importeret, og der er ingen dobbelttælling. Ingen ændringer nødvendige.

## Evidens

Balder har i alt 1.293 salg i perioden fra 15/7 og frem, fordelt sådan:

- 1.290 salg oprettet i dag (10/8) — bulk-uploaden
- 3 salg oprettet 17/7 med `source = Lovablecph` (Adversus-integrationen)

De 3 gamle salg har numrene 40802671, 22257130 og 51374010 og kom automatisk ind fra dialeren tilbage i juli. Da de samme tre numre også lå i Excel-filen, blev filens rækker afvist som dubletter — netop derfor står de under "Fejl i upload".

## Hvorfor tallet stemmer alligevel

Excel-filen indeholdt 1.293 rækker på Balder. Systemet har 1.293 salg. Det er 1.290 nye plus de 3, der allerede var registreret via Adversus. Hvert salg findes altså kun én gang — dubletsikringen gjorde præcis sit arbejde.

## Ingen handling

Der er intet at rette. Hvis du vil, kan jeg lave et lille udtræk af de 3 salg (dato, nummer, produkt, provision), så du kan se dem sammenlignet med filens rækker.
