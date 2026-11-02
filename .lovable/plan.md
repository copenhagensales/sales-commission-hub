# Fiberleads tæller med på Relatel Månedsmål

## Hvad der ændres
Relatel Månedsmål-boardet tæller i dag kun salg på Relatels egne kampagner. Fiberleads tastes på TDC Erhverv-kampagner, så de kommer slet ikke med. Efter ændringen tæller hvert fiberlead fra en Relatel-sælger som **1 salg** på:
- det fælles mål (total),
- sælgerens individuelle mål,
- dagsboksen for den dag, leadet blev lavet.

Samme regler som fibertælleren på Relatel-boardet:
- Kun Lead Provi HAP/VOK (med/uden Mobilevoice).
- Kun leads lavet, mens sælgeren var på Relatel-teamet (Jacob H's TDC-lead fra før skiftet tæller ikke).
- Afviste/slettede leads tæller ikke.
- Gælder både Adversus-leads og leads tastet i TDC Erhverv Fiber.

## Hvad der ikke ændres
TDC Erhverv-boards og deres 0,5/1-point, løn, provision, rapporter, og at fiber er bisalg alle andre steder. Kun visning på dette board.

## Teknisk
- `supabase/functions/tv-dashboard-data/index.ts`, `handleMonthlyGoal`: kun når klienten er Relatel hentes `sale_items` med `RELATEL_FIBER_LEAD_POINTS_EF`-produkter i perioden (pagineret), filtreret med `is_cancelled`/`validation_status` og `getRelatelEmailToEmployee` + `relatelLeadCounts`; tilføjes til `items` med quantity 1 pr. lead, agentEmail og dansk saleDate som øvrige linjer. Dublet undgås, da leads ligger på TDC-kampagner, ikke Relatel.
- Kontrollér, at lead-produkterne ikke ligger i `RELATEL_MONTHLY_GOAL_EXCLUDED_PRODUCT_IDS`/`MONTHLY_GOAL_EXCLUDED_PRODUCT_IDS`.
- Deploy `tv-dashboard-data`; read-only antal-kontrol af november-leads. Ingen migrationer, ingen klientændringer.
