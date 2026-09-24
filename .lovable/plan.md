# Mobilvisning af kundetavler – forbedringsplan

Gælder kundetavlerne (TDC Erhverv, Eesy, Relatel m.fl.), der alle bruger samme byggeklodser. TV-visningen (1920x1080) røres ikke. Ingen tal, beregninger eller data ændres – kun visning.

## Hvad der halter i dag (set i koden)
- **Tal-kort:** med 3 kort står de altid 3 på en række, også på mobil (`ClientDashboard.tsx:382`), så tallene bliver små og klemte.
- **Toplister:** de tre lister (dag/uge/måned) ligger under hinanden. Hver har sin egen rullebjælke (`max-h-[560px]`, `CphBoardComponents.tsx:189`), så man ender med at rulle inde i siden, der også ruller. Det føles fastlåst på telefon.
- **Kolonner:** navn, salg, switch/fiber og provision deler en smal bredde, så navnene tidligere blev klippet (rettet i dag med ombrydning).
- **Toppen:** logo, titel, periodevælger og knapper ligger under hinanden og fylder en hel skærm, før man ser tal.

## Det ville jeg gøre (prioriteret)
1. **Faner i stedet for tre lister under hinanden på mobil:** "I dag / Uge / Måned" som en fanebjælke øverst i toplisten. Man ser én liste ad gangen og kan swipe mellem dem. Ingen rullen inde i rullen.
2. **Min egen placering altid synlig:** er du ikke i top 10, vises din egen række fastlåst nederst i listen ("Du: #14 · 3 salg · 2.450 kr.").
3. **Kompakte rækker:** navn på første linje, og salg/switch/fiber som små mærker under navnet. Provision står stort til højre. Så er der plads til fulde navne uden vandret klemning.
4. **Tal-kort 2 pr. række på mobil**, med det vigtigste kort i fuld bredde øverst.
5. **Kompakt top:** logo og titel på én linje. Periodevælgeren bliver til en lille knap, der åbner et ark nedefra. Knapperne "Fuldskærm" og "Dashboards" bliver til ikoner.
6. **Mobil-detaljer:** trykflader på mindst 44 px, tal med faste cifferbredder, og "opdateret kl."-markering, så man kan se at tallene er friske.

## Afgrænsning
- Kun visning. Datakilder (`useSalesAggregates`, cachede KPI'er) og beregninger er uændrede.
- Ingen ændring af TV-tilstand eller af ligaen/Powerdag i denne omgang. Ligaen kan tages bagefter med samme mønster.
- Grøn zone (layout/styling) jf. CLAUDE.md.

## Tekniske detaljer
- `CphBoardComponents.tsx`: ny mobilvariant af `CphLeaderboard` (kort-rækker under `sm`) og `CphBoardFrame` med faner under `lg`. `tvMode` uændret.
- `ClientDashboard.tsx`: KPI-grid for 3 kort → `grid-cols-2 md:grid-cols-3` med første kort `col-span-2` på mobil. Fjern indre `max-h` på mobil.
- `DashboardHeader.tsx` / `DashboardPeriodSelector.tsx`: kompakt top og periodevælger i et `Sheet` på mobil.
- Egen række: genbrug den nuværende brugers id mod listen, som allerede er hentet. Ingen nye forespørgsler.
- Verificering: skærmbilleder med Playwright i 390 px og 1280 px bredde samt tjek af TV-tilstand for at sikre, at den er uændret.
