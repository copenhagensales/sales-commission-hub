

# Plan: Hent manglende TDC Erhverv salg (uge 7)

## Problem
28 TDC Erhverv salg i uge 7 vs. 109 i uge 6. Backfill d. 23/2 tilfoejede 0 nye salg -- alle var allerede i databasen. De manglende ~80 TDC-salg blev aldrig hentet fra Adversus API.

## Rodaarsag
Den daglige sync (`maxRecords: 60`) tabte TDC-salg paa travle dage. Backfill bruger `lastModifiedTime` filter, men det returnerer kun salg sorteret efter seneste aendring. Hvis API'et returnerede 500+ salg per dag og `maxRecords: 600` var sat, burde alle vaere med -- men noget filtrerede dem fra.

De 3 mulige filtre der kan udelukke salg:
1. **Email-whitelist** (linje 220-225): Salg med agent-emails der IKKE ender paa `@copenhagensales.dk`, `@cph-relatel.dk` eller `@cph-sales.dk` droppes
2. **maxRecords pre-enrichment limit** (linje 375-378): Hvis API returnerer >600 salg per dag, sorterer den by closedTime DESC og beholder kun 600
3. **7-dages lookback cap** (linje 356-362): Cap'per fromDate til max 7 dage -- men dette burde ikke vaere problemet for Feb 16-22

## Loesning: Ny backfill uden beggraensninger

### Trin 1: Tilfoej "uncapped" mode til Adversus adapter
Tilfoej en parameter til `fetchSalesRange` der:
- Fjerner 7-dages lookback cap
- Fjerner maxRecords pre-enrichment limit
- Logger alle filtrerede salg (email-whitelist) saa vi kan se hvad der droppes

### Trin 2: Tilfoej kampagne-specifik backfill
Tilfoej `campaignIds` parameter til safe-backfill saa vi kan filtrere efter specifikke kampagner (TDC Erhverv). Dette reducerer datamengden og goer det lettere at debugge.

### Trin 3: Diagnostisk koersel foerst
Foer vi koerer den rigtige backfill, koer en diagnostisk koersel der:
1. Henter ALLE salg fra Adversus for Feb 16 (en enkelt dag) UDEN maxRecords limit
2. Logger hvor mange der er TDC Erhverv kampagner
3. Logger hvor mange der filtreres vaek af email-whitelist
4. Sammenligner med hvad vi har i databasen

### Trin 4: Koer fuld backfill for manglende dage
Baseret paa diagnostikken, koer backfill for alle dage der mangler TDC-salg.

### Trin 5: Verificer og genberegn KPIs

## Tekniske aendringer

### `adversus.ts` - Tilfoej uncapped mode
- Tilfoej `uncapped?: boolean` parameter til `fetchSalesRange`
- Naar `uncapped = true`: spring 7-dages cap og maxRecords limit over
- Tilfoej detaljeret logging af filtrerede salg per kampagne

### `safe-backfill.ts` - Tilfoej diagnostik og kampagne-filter
- Tilfoej `campaignIds?: string[]` parameter
- Tilfoej `uncapped?: boolean` parameter
- Send parametre videre til adapter

### `index.ts` - Parse nye parametre
- Destructure `campaignIds` og `uncapped` fra request body

## Forventet resultat
- Vi faar synlighed i PRAECIS hvor mange TDC-salg Adversus API returnerer vs. hvad vi gemmer
- Vi kan koere en maalstyret backfill der henter de manglende ~80 TDC-salg
- Fremtidig forebyggelse: oeg `maxRecords` paa den daglige sync saa TDC-salg ikke droppes

