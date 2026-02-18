
# Plan: Genstart salgssynkroniseringen

## Problemet

Siden 17. februar kl. ~16:00 er **0 salg** blevet registreret i systemet. Alle syncs rapporterer "0 sales" med 100% fejlrate paa upsert-operationen.

## Rodaarsag

Den **deployede** version af `integration-engine` edge-funktionen (version 1477) refererer stadig kolonnen `sales.adversus_opp_number`, som blev droppet i en migration den 17. februar. Kildekoden i projektet er korrekt og refererer IKKE kolonnen -- men den deployede version er ikke synkroniseret med koden.

Sekundaert: Adversus-integrationen rammer ogsaa rate limits ("Rate Limit Adversus Excedido"), men det er et separat problem.

## Evidens

- Postgres fejllog: `column sales.adversus_opp_number does not exist` (gentages hvert minut)
- `integration_logs`: Alle syncs viser `{ errors: 34-67, processed: 0 }`
- `sales`-tabellen: 0 raekker for 18. februar
- Sidste succesfulde sync med data: 17. feb kl. 15:51
- Kildekoden (`supabase/functions/integration-engine/core/sales.ts`): Ingen reference til `adversus_opp_number`

## Loesning

**En enkelt handling:** Redeploy `integration-engine` edge-funktionen saa den deployede version matcher kildekoden.

Det er alt. Ingen kodeaendringer er noedvendige -- koden er allerede korrekt.

## Forventet resultat

- Naeste cron-koersel vil upserte salg uden fejl
- Enreach/Eesy: ~67 salg vil blive registreret per sync
- Adversus: Vil stadig have rate-limit-problemer (separat issue, ikke relateret til denne fix)

## Risici

1. Adversus rate limiting er et separat problem der kraever justering af API-kaldshastighed
2. Salg fra 17. feb aften + 18. feb morgen vil blive backfilled ved naeste sync (da synk-vinduet er 1-3 dage)
