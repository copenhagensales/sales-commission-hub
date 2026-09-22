# Excel-ark: TDC Erhverv fiberprodukter (VOK/HAP)

## Formål
Et lille regneark med de seks fiberprodukter og deres omsætning og provision, som de står i systemet i dag.

## Indhold (bekræftede tal fra systemet)

| Produktnavn | CPO/omsætning | Provision |
|---|---|---|
| Fuldt salg VOK | 2.500 | 1.250 |
| Lead Provi VOK | 1.650 | 625 |
| Lukket salg VOK | 850 | 625 |
| Fuldt salg HAP | 1.500 | 750 |
| Lead Provi HAP | 1.000 | 375 |
| Lukket salg HAP | 500 | 375 |

Alle seks er aktive, ingen er skjulte eller sammenlagte.

## Udformning
- Tre kolonner: Produktnavn, CPO/omsætning, Provision.
- Rækkefølge: VOK først, derefter HAP (som ovenfor).
- Arial, fed overskriftsrække, tal i kr.-format uden decimaler, kolonnebredder tilpasset.
- Ingen totalrække, ingen beregninger — ren oversigt.
- Filen leveres som download: `TDC_Erhverv_fiberprodukter.xlsx`.

## Teknisk
- Kun læsning fra databasen; ingen ændringer i produkter, prisregler eller kode.
- Arket bygges med openpyxl og gemmes under Filer (`/mnt/documents`).
- Værdier hentes fra produkternes grundsatser (`products.revenue_dkk` / `commission_dkk`). Eventuelle kampagnespecifikke prisregler er ikke medtaget — sig til, hvis de skal med.
