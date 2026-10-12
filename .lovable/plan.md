# Opret 7 nye Adversus-produkter i Stork på forhånd

## Hvad der oprettes

| Adversus-ID | Produktnavn | Provision | Omsætning |
|---|---|---|---|
| 11986 | Nummer reservation | 35 kr. | 75 kr. |
| 12134 | Lukket salg HAP (Inkl. Mobilevoice salg) | 0 kr. | 0 kr. |
| 12135 | Lead Provi HAP (Inkl. Mobilevoice salg) | 0 kr. | 0 kr. |
| 12136 | Fuldt salg HAP (Inkl. Mobilevoice salg) | 0 kr. | 0 kr. |
| 12137 | Lukket salg VOK (Inkl. Mobilevoice salg) | 0 kr. | 0 kr. |
| 12138 | Lead Provi VOK (Inkl. Mobilevoice salg) | 0 kr. | 0 kr. |
| 12139 | Fuldt salg VOK (Inkl. Mobilevoice salg) | 0 kr. | 0 kr. |

- Nummer reservation får samme satser som det integrerede Internetfilter (Adversus-ID 5190): 35 kr. provision / 75 kr. omsætning. Bekræftet i databasen; Internetfilter har ingen prisregler, kun basissats.
- Alle syv placeres på samme kampagne som de eksisterende HAP/VOK-produkter.
- "Tæller som salg" sættes til nej, som på de eksisterende HAP/VOK-produkter og Internetfilter. Sig til, hvis de nye skal tælle som salg.
- Hvert produkt kobles til sit Adversus-ID, så første salg lander direkte på det rigtige produkt i stedet for under "Mangler mapping". Ingen af ID'erne er koblet i dag.

## Hvad der ikke røres

- Eksisterende HAP/VOK-produkter, Internetfilter, prisregler, eksisterende salg, løn og provision.
- Ingen kodeændringer og ingen genberegning.

## Til i morgen

Når du retter satserne med en dato tilbage i tiden, bliver kun salg på disse nye produkter fra og med den dato genberegnet. Da de ikke har salg endnu, påvirkes intet andet.

## Teknisk

- Data-indsættelse (ingen skemaændring): 7 rækker i `products` (campaign `374ce55d-…`, `counts_as_sale = false`) og 7 rækker i `adversus_product_mappings` (`adversus_external_id`, `adversus_product_title`, `unit_price = NULL`).
- Efterkontrol: læs de 14 rækker tilbage og bekræft, at antal `sale_items` og totaler på eksisterende produkter er uændrede.
