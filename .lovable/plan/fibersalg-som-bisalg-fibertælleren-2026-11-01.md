# Fibersalg som bisalg + fibertælleren

## Det har jeg fundet
- **Almindelige salg:** Alle 12 fiberprodukter (HAP/VOK, Fuldt/Lukket/Lead, med og uden Mobilevoice) står allerede som »tæller ikke som salg«. De indgår altså ikke som almindelige salg på dashboards i dag.
- **Bisalg:** Kun de 6 Mobilevoice-varianter står som bisalg. De 6 uden Mobilevoice står hverken som salg eller bisalg.
- **Fibertælleren på TDC Erhverv-dashboardet** tæller på produktet: Fuldt salg = 1 point, Lukket salg = 0,5 og Lead Provi = 0,5. Tastede salg kommer automatisk med, fordi de bruger de samme produkter.
- **Fejl i tælleren:** Den springer annullerede linjer over, men ikke salg med status »afvist«. En leaddel, der er afvist ved en rettelse (lukket → fuldt), ville derfor stadig give 0,5 point og provision på fibertavlen.

## Ændringer
1. **Alle 12 fiberprodukter markeres som bisalg** (»tæller som salg« forbliver fra). Det sker i produktindstillingerne, de samme som under Produkter.
   - Gælder også historiske Adversus-fibersalg: de 6 produkter uden Mobilevoice begynder at tælle som bisalg på leaderboards, også bagud. Provision og omsætning ændres ikke.
2. **Fibertælleren springer afviste salg over** (point, provision og antal). Det ændrer kun tallene for salg, der er afvist; i dag er der ingen afviste fibersalg.

## Teknisk
- Dataændring: `products.counts_as_cross_sale = true` for de 6 id'er uden Mobilevoice (id'erne står i `src/config/fiberBoardPoints.ts`). Før/efter kontrolleres med en læsning.
- `supabase/functions/tv-dashboard-data/index.ts`: `handleFiberSalesCount` og `handleFiberBoardStats` henter `sales.validation_status` og springer `rejected` over, samme regel som leaderboard-beregningen. Kun disse to funktioner ændres; TV-sidernes udseende røres ikke. Edge-funktionen udrulles efter ændringen (sender intet).
- Leaderboard-cachen genberegnes af den eksisterende cron; der trigges ingen manuel kørsel.

## Ikke med
- Relatels board med sekundær fibermarkering (kommer senere, som aftalt).
