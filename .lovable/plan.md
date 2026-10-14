# Genberegning af 5GI MBB-salg fra 15. sept. (plan A)

## Hvad der sker
- Jeg genberegner provision og omsætning for alle salgslinjer på "5GI MBB" med salgstidspunkt fra og med 15. sept. 2026 kl. 00:00 dansk tid.
- Linjer, der rammer en regel, får reglens sats på 225 kr. De øvrige beholder grundsatsen på 300 kr. Der bliver ikke ændret i regler, satser eller koder.
- Linjerne før 15. sept. bliver ikke rørt.

## Bemærk
Fra 15. sept. kommer der også linjer med, som allerede lå på "5GI MBB" i perioden 15.–24. sept. Ud over de 290 flyttede linjer omfatter genberegningen derfor flere linjer. Nogle af dem kan skifte sats, hvis de i dag står forkert.

## Trin
1. Optælling før kørslen: antal linjer og sum af provision og omsætning fra 15. sept.
2. Prøvekørsel med samme afgrænsning. Den viser, hvor mange linjer der skifter fra 300 til 225 kr. og omvendt, og den samlede forskel.
3. Hvis prøvekørslen kun ændrer 5GI MBB-linjer og forskellen er rimelig, kører jeg den rigtige genberegning med samme afgrænsning.
4. Kontrol bagefter: summen skal svare til prøvekørslen, ingen linjer før 15. sept. må være ændret, og salget i dagsrapporten (Hans Hugo, 14. okt.) skal stå til 225 kr., hvis det rammer reglen.
5. Hvis prøvekørslen viser noget uventet, stopper jeg og melder tilbage, inden jeg ændrer noget.

## Teknisk
- Genberegningen kaldes med `product_id = 5GI MBB` og `min_sale_datetime = 2026-09-14T22:00:00Z`, først med `dry_run`.
- Der er ingen kodeændringer.
