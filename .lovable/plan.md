# Hiper 15/8–14/9: samlet omsætning og provision (kun opslag)

## Resultat (kun Hiper-produkter, 363 salgslinjer)

| Produkt | Antal | Provision | Korrekt omsætning | I Stork i dag |
|---|---|---|---|---|
| Hiper Lukning | 160 | 32.000 | 208.000 (160 x 1.300) | 13.000 |
| Hiper lukning rabattrin 1 | 3 | 525 | 3.600 | 3.600 |
| Hiper lukning rabattrin 2 | 19 | 2.850 | 20.900 | 20.900 |
| Hiper Viderestilling | 159 | 63.600 | 0 | 0 |
| Hiper viderestilling rabattrin 1 | 3 | 1.125 | 0 | 0 |
| Hiper viderestilling rabattrin 2 | 19 | 6.650 | 0 | 0 |
| **Total** | **363** | **106.750 kr.** | **232.500 kr.** | 37.500 kr. |

- Provisionen i Stork stemmer med produkternes priser i perioden.
- Omsætningen mangler 195.000 kr. Hele forskellen ligger på "Hiper Lukning": kun 10 af 160 salg har fået 1.300 kr. De andre står med 0 kr.
- Årsagen er den aktive prisregel "Hiper Lukning - default", der sætter omsætningen til 0 kr. og går forud for produktets egen pris i MG test.

## Forslag til næste skridt (kræver jeres godkendelse)
Prisreglen hører til pricing-motoren, som er rød zone. Hvis I godkender det, retter jeg reglen, så Lukning får 1.300 kr. i omsætning. Derefter genberegner jeg Hiper-salgene, så Dagsrapporter viser de rigtige tal. Provisionen ændres ikke.
