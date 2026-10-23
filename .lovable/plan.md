# Rettelse af Excel-ark "FF - 1/1-2026-18/10-2026"

Ny fil: `Book_9_v2.xlsx` (originalen bevares). Kun arket ændres – intet i Stork.

## 1. "Data fra Mikkel" (E2:H7)
Røres ikke – værdier, formatering og placering forbliver præcis som nu (kontrolleres celle for celle efter rettelsen).

## 2. Højre side – "Emnestatus 18/10"
Række "Ugyldig & MCR" (1.873) og "Ukvalificeret" (306) slås sammen til én række:

| Status | Antal | % af brutto | % af rapport |
|---|---|---|---|
| Ikke interesseret | 3.336 | 38,5 % | 42,2 % |
| Ugyldig, MCR & ukvalificeret | 2.179 | 25,1 % | 27,6 % |
| Succes (møde booket) | 1.851 | 21,3 % | 23,4 % |
| Endeligt afsluttede i alt | 7.366 | 84,9 % | 93,2 % |
| Igangværende genkald | 538 | 6,2 % | 6,8 % |
| Ikke afstemt mod Adversus* | 770 | 8,9 % | – |
| Total brutto modtaget | 8.674 | 100,0 % | – |

Procenter laves som formler (ikke tekst), så de regner selv.

## 3. Venstre side – "Opgørelse"
Formlerne peger på de nye rækker:
- Emner modtaget = total brutto (8.674)
- Emner lukket = afsluttede i alt (7.366)
- Emner åbne = genkald + ikke afstemt (1.308)
- MCR/ugyldig/ukvalificeret = den sammenlagte række (2.179)
- Møder booket = 1.851
- De tre hitrates beholdes og genberegnes automatisk (25,1 % / 21,3 % / 35,9 %).

## 4. Forklaringen nederst
Omskrives, så den kun siger det, der er dokumenteret:
- 7.904 = emner med status i vores afrapportering (7.366 afsluttet + 538 i genkald pr. 18/10).
- 770 = forskellen mellem Trygs brutto (8.674) og vores 7.904. Den er endnu ikke talt op emne for emne i Adversus, så vi kan ikke sige præcist, hvor de ligger lige nu (fx ubehandlede, udløbet eller fjernet).
- De 378 tilgængelige emner i Adversus i dag viser, at der stadig arbejdes på puljen, men det er ikke bevist, at de er en del af de 538 eller af de 770.

Vigtig rettelse: Mit tidligere "ja, lige præcis" om 538 − 378 ≈ 160 ringede var for skråsikkert – det er et regnestykke, ikke en optælling fra Adversus. Teksten i arket formuleres derfor neutralt.

## 5. Kontrol
Genberegn arket, tjek 0 formelfejl, at Mikkels felt er uændret, og at tallene går op (7.366 + 538 + 770 = 8.674). Leveres som downloadbar fil.
