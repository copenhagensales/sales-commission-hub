# Excel: opstartsbonus 15/8–14/9

## Hvad jeg har fundet

Bonussen du peger på (Aslak, 18/8, 500 kr) ligger som daglige bonus-udbetalinger fra vagtplanen — ikke som "Opstartsbonus" i lønvisningen (den bygger på oplæringsbonus-dage, og der er ingen af dem i perioden).

I perioden 15/8–14/9 er der 10 medarbejdere med registreret dagsbonus:

| Sælger | Opstartsdage | Beløb |
| --- | --- | --- |
| Aslak Longo Rosenberg | 9 | 4.500 kr |
| Jacob Østergaard Hansen | 1 | 3.500 kr |
| Jasper Christensen | 2 | 1.000 kr |
| Julius Rødsø Langkilde | 9 | 4.500 kr |
| Lukas Nielsen | 9 | 4.500 kr |
| Mads Demant | 9 | 4.500 kr |
| Matias Heller Frederiksen | 2 | 1.500 kr |
| Storm Søegaard | 9 | 4.500 kr |
| Thomas Wehage | 9 | 4.500 kr |
| Zean Romeo Ayvaz | 9 | 4.500 kr |

Bemærk: Jacob har 1 dag men 3.500 kr, og Matias 2 dage til 1.500 kr — satsen er altså ikke 500 kr overalt. Beløbene tages som de står; intet rettes.

## Leverance

Et Excel-ark med to kolonner: **Sælger** og **Antal opstartsdage** (sorteret alfabetisk). Jeg tilføjer en kolonne med beløb, hvis du vil have den med.

Filen gemmes i Filer som `opstartsbonus_15-08_14-09_2026.xlsx`.

## Teknisk

Ren læsning: `daily_bonus_payouts` for `date` mellem 2026-08-15 og 2026-09-14, koblet til `employee_master_data` på `employee_id`, grupperet pr. medarbejder (antal rækker = antal dage). Ingen ændringer i app, database, RLS eller løndata.
