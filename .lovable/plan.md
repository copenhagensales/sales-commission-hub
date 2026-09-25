# Hiper Lukning: CPO mangler på salg før 14/9

## Årsag (bekræftet i databasen)
- Produktet "Hiper Lukning" har som grundindstilling provision 125 kr. og omsætning 1.300 kr. Det er det, du ser under produkter.
- Produktet har også en aktiv prisregel, "Hiper Lukning - default", der gælder fra 8/7. Den sætter provision 200 kr. og **omsætning 0 kr.** En regel går altid forud for grundindstillingen.
- Derfor ser salgene sådan ud i Stork:
  - 9/7–13/9: 303 salg med provision 200 kr. og omsætning 0 kr.
  - 14/9: 10 salg med provision 200 kr. og omsætning 1.300 kr.
  - Fra 15/9: 59 salg med provision 125 kr. og omsætning 1.300 kr.
- Konklusion: omsætningen er blevet rettet på et tidspunkt omkring 14/9, men salgene fra før den dato er ikke blevet genberegnet. Arket viste derfor korrekt det, Stork har gemt, men det Stork har gemt, er forkert for de gamle salg.
- "Hiper lukning rabattrin 1/2" har ingen regler og har derfor den rigtige omsætning (1.200 og 1.100 kr.). "Viderestilling" har 0 kr. med vilje.

## Hvad jeg laver nu (kun arket, ingen ændringer i Stork)
1. Jeg laver en ny version af arket: `hiper_annulleringer_15-8_14-9_udfyldt_v2.xlsx`.
2. På rækker med "Hiper Lukning", hvor Stork har 0 kr. i omsætning, skriver jeg produktets CPO fra produktlisten (1.300 kr.). Cellen markeres med orange, og der står en note om, at tallet kommer fra produktlisten og ikke fra salget.
3. Viderestilling står fortsat tom og markeret med gult, fordi den med vilje er 0 kr.
4. Provisionen står som Stork har beregnet den, dvs. 200 kr. på de gamle Lukning-salg. Det står også i noten, så I kan tage stilling til den.

## Separat beslutning (ikke med i denne plan)
Selve rettelsen i Stork hører til pricing-motoren, som er rød zone, og kræver jeres godkendelse. Der er to muligheder:
- **A:** Ret reglen "Hiper Lukning - default" til omsætning 1.300 kr. og genberegn salgene fra 8/7. Det ændrer omsætningen på de gamle salg, og provisionen på 200 kr. bliver stående.
- **B:** Slå reglen fra, så grundindstillingen gælder. Så bliver både omsætningen (1.300 kr.) og provisionen (125 kr.) ændret bagud. **Det påvirker løn.**

I skal også afklare, hvilken provision der er den rigtige for perioden før 15/9: 200 kr. eller 125 kr.
