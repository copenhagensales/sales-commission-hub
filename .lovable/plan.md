# Kampagne ja/nej på 5G Bredbånd / Fiber + nyt produkt MBB 200/40

## Hvad ændres
- Ved overskriften "5G Bredbånd / Fiber" på **1. Tilbud** kommer en lille kontakt: **Kampagne** (tændt) / **Ikke kampagne** (slukket). Den starter tændt, og "Nulstil alle valg" sætter den tilbage til tændt.
- Kontakten styrer, hvilken provision 5G-linjerne viser og regner med. Totalerne i "Provision" følger med.
- Nyt produkt **MBB 200/40** mellem 100/20 og 500/100. Prisen pr. md står som "–" og tæller 0 kr. i prisen, indtil du sender den. Provisionen er hentet fra produkterne.
- MBB 200/40 tæller med som 5G (5G Fri i mailen), ligesom de andre MBB-linjer.

## Satser fra produkterne (provision pr. stk.)

| Produkt | Kampagne | Ikke kampagne |
|---|---|---|
| MBB 50/10 | 1.000 | 1.400 |
| MBB 100/20 | 1.100 | 1.500 |
| MBB 200/40 (ny) | 1.200 | 1.600 |
| MBB 500/100 | 1.300 | 1.700 |

Kampagnesatserne er de samme som dem, der står i værktøjet i dag. Ingen af de otte produkter har prisregler, der ændrer satserne.

## Det mangler / bliver ikke ændret
- **Pris pr. md. uden kampagne** findes ikke i produkterne, fordi de kun gemmer provision og omsætning. Jeg bruger dagens priser (249/299/399) både med og uden kampagne, indtil du sender de rigtige priser.
- **Fiber 100/100 og 1000/1000** er ikke med i produkterne som kampagne-/ikke-kampagneprodukter. De bliver derfor ikke påvirket af kontakten.
- Det er kun værktøjet, der ændres. Produkterne, priserne og lønberegningen bliver ikke rørt.

## Teknisk
- `catalog.ts`: valgfrit felt `campaignAlt: { price?, commission }` på MBB-produkterne, samt nyt `mbb-200` med `price: 0` og et flag til at vise "–".
- `calc.ts`: `calcTilbud(..., { campaign })` vælger satsen ud fra kontakten. Standardværdien er kampagne, så de eksisterende test ikke ændres.
- `TdcTilbudForm.tsx`: en `Switch` i gruppeoverskriften for 5G, og tabellen viser den aktive sats.
- `TdcSalgTool.tsx`: `campaign`-tilstand med standardværdien `true`, som nulstilles af "Nulstil alle valg".
- Nye test for begge tilstande og for MBB 200/40. Jeg tjekker også i browseren, at kontakten skifter provision.
