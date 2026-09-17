# Excel-udtræk v2: én række pr. Sales ID

Samme afgrænsning som v1 (kampagne 105958, sidste 3 måneder, alle salg inkl. annullerede, kun Omstillingsbruger / Switch Contact Center / Switch Professionel / Switch Unlimited uanset endelsen efter navnet).

Eneste ændring: arket samles til én række pr. Sales ID (CVR) i stedet for én række pr. produktlinje.

## Sådan ser arket ud

| Sales ID (CVR) | Produkter | Antal |
|---|---|---|
| 44926822 | Omstillingsbruger ATL (4), Switch Contact Center ATL (1) | 5 |
| 39064499 | Switch Contact Center #3 | 1 |

- Produkter: alle de af de fire produkter der er solgt på det Sales ID, adskilt af komma. Er der solgt flere styk af samme produkt, står antallet i parentes.
- Antal: samlet antal enheder af de fire produkter på det Sales ID.
- Optræder samme Sales ID på flere salg i perioden, lægges de sammen til én række.
- Nederst en totalrække, som i v1.

## Teknisk
Samme forespørgsel som v1, men grupperet på Sales ID med `string_agg` af produktnavn (+ antal i parentes når antal > 1) og `sum(quantity)`. Ny fil i Files: `switch-krydssalg-105958-sidste-3-maaneder_v2.xlsx`. v1-filen bevares.
