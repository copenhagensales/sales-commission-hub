# Relatel-leadgivere vises på TDC Erhverv-boardet

## Årsag (bekræftet)
- William Sean Maare Bai er på Relatel-teamet (siden 9/9). Hans Lead Provi-del af Olivers salg ligger på TDC Erhverv-kunden.
- På TDC-boardet medtager listen »Top i dag/uge« (fiber-point og provision) alle Lead Provi-linjer uanset hvilket team leadgiveren er på (`supabase/functions/tv-dashboard-data/index.ts`, `handleFiberBoardStats`, TDC-varianten). Derfor står William der med 0,5 og 625 kr.
- Relatel-boardets fibertæller tæller ham allerede med 1 (samme regel: Relatel-medlem på salgstidspunktet).
- Topkortet »(+1 fiber)« på TDC tæller kun lukkerens salg, så det er korrekt.

## Rettelse
I TDC-varianten af `handleFiberBoardStats` springes Lead Provi-linjer over, hvis leadgiveren var på Relatel-teamet, da leadet blev lavet (genbruger `getRelatelEmailToEmployee` + `relatelLeadCounts`). Det betyder:
- William forsvinder fra TDC-boardet og vises kun på Relatel.
- Leads lavet af en sælger, før vedkommende kom på Relatel (fx Jacob H. 19/10), tæller fortsat på TDC.
- Oliver beholder sine 0,5 / 625 kr. på TDC.

Kun `tv-dashboard-data/index.ts` ændres og udrulles. Provision, løn, salg og rapporter er uændrede – kun hvad TDC-boardet viser.

## Kontrol
- Kald funktionen for i dag og se, at TDC-listen kun har Oliver, og at Relatel-listen har William med 1.
