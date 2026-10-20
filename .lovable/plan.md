# SmartResponse - Standalone undtages i Eesy TM's specialregler fra 15/9

## Hvad der findes i dag (tjekket i databasen)
- Eesy TM har 10 aktive regler af typen "alle kampagner undtagen valgte", alle med navnet "Specialkampagne 2026", én for hvert produkt. SmartResponse - Standalone konkurrence er ikke valgt i nogen af dem.
- Hvis kampagnen bliver undtaget, får salget produktets egen pris. 5GI MBB har to andre aktive regler, men ingen af dem gælder SmartResponse, så produktets egen pris gælder også her.
- Omsætningen er den samme i reglen og på produktet. Det er kun provisionen, der ændres.

## Ændring
1. Tilføj SmartResponse - Standalone konkurrence som undtaget kampagne i alle 10 "Specialkampagne 2026"-regler. Intet andet i reglerne ændres.
2. Genberegn kun Eesy TM-salg på SmartResponse - Standalone fra 15/9-2026 og frem. Det sker med den eksisterende genberegning, og der bruges ikke kode til det.
3. Kontrollér før og efter, at kun disse linjer ændres:

| Produkt | Linjer | Provision før → efter |
|---|---|---|
| Fri tale + fri data | 7 | 275 → 375 |
| Fri tale + 100 | 5 | 260 → 350 |
| Fri tale + 40 GB data (5G) | 1 | 190 → 250 |

Det er i alt 13 linjer og ca. +1.210 kr. provision. Omsætningen er uændret. Salg før 15/9 og alle andre kampagner og kunder røres ikke.

## Risiko
Provisionen i lønperioden 15/9–14/10 ændres for de berørte sælgere. Hvis perioden allerede er udbetalt, vises forskellen som en efterregulering. De nævnte tal er fra i dag og kan stige, hvis der kommer nye salg inden kørslen.
