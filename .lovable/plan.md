# Verifikation: dubletter i bulk-uploaden (Balder og Flora)

Konklusion: ingen af de afviste rækker er kommet ind. Ingen dobbelttælling på tavlen. Ingen ændringer nødvendige.

## Balder

I alt 1.293 salg i perioden fra 15/7:

- 1.290 oprettet i dag (10/8) — bulk-uploaden
- 3 oprettet 17/7 med kilde `Lovablecph` (Adversus-integrationen): numrene 40802671, 22257130 og 51374010

De 3 var altså allerede registreret automatisk fra dialeren i juli. Derfor blev filens tilsvarende rækker afvist som dubletter. Excel havde 1.293 rækker, systemet har 1.293 salg — hvert salg findes kun én gang.

## Flora

Samme billede. I dag er der oprettet 28 manuelle salg på hende plus 4 fra dialeren. Kontrol af alle hendes salg i perioden viser **nul** telefonnumre der optræder mere end én gang (de eneste gentagelser er dialer-salg helt uden nummer, som ikke stammer fra uploaden).

Hendes ~20 dubletfejl var derfor rækker, der allerede fandtes i systemet — typisk fordi salget var kommet ind via dialeren eller via "Tast selv" tidligere. De blev sprunget over og er ikke tilføjet igen.

## Ingen handling

Dubletsikringen virker som tilsigtet: den matcher på mobilnummer og Emne-ID og afviser rækker der allerede findes. Sig til hvis du vil have et udtræk over de afviste rækker med angivelse af, hvor det oprindelige salg kom fra.
