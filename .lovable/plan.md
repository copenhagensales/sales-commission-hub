# Excel: TDC Erhverv fiber-salg (HAP/VOK), august 2026

## Datagrundlag (verificeret)
De 6 fiber-produkter fra `fiberBoardPoints.ts` findes i perioden 1/8–31/8 2026 med i alt 26 salgslinjer:

| Produkt | Linjer | Antal | Omsætning |
| --- | --- | --- | --- |
| Fuldt salg HAP | 13 | 14 | 21.000 |
| Lead Provi HAP | 6 | 8 | 8.000 |
| Lukket salg HAP | 4 | 6 | 3.000 |
| Fuldt salg VOK | 1 | 1 | 2.500 |
| Lead Provi VOK | 1 | 1 | 1.650 |
| Lukket salg VOK | 1 | 1 | 850 |

## Kolonner i filen
- **Salgsdato** — `sales.sale_datetime` i dansk tid
- **OPP Nummer** — `raw_payload.leadResultFields."OPP nr"`
- **Produkt** — produktnavn (med antal hvis > 1)
- **CPO/Omsætning** — `sale_items.mapped_revenue` pr. linje

Én række pr. fiber-salgslinje, sorteret efter dato. Totalrække nederst.

## Teknisk
Ét SELECT mod `sale_items` + `sales` + `products` filtreret på de 6 produkt-id'er og perioden. Filen genereres med openpyxl til `/mnt/documents`. Ingen ændringer i kodebasen eller databasen.
