# TDC Erhverv – Overblik: fibertal i toppen vs. sælgerlisten

## Hvad jeg fandt (kun læst, intet ændret)

Mistanken holder ikke: Relatels fiberleads tæller ikke med på TDC-tavlen i dag. De to forskellige tal skyldes, at de tæller på to forskellige måder.

Fibersalg i dag (4/11):
- 3 × Lukket salg (TDC-sælgere)
- 1 × Fuldt salg (TDC-sælger)
- 1 × Lead (TDC-sælger, leadgiver på et lukket salg)
- 2 × Lead fra Relatel-sælgere – udelukket begge steder

| Sted | Regel | Resultat |
|---|---|---|
| Kortet »Salg i dag (+4 fiber)« | Antal fibersalg; hvert lukket/fuldt salg = 1; leads tæller ikke | 3 + 1 = **4** |
| Sælgerlisten (kolonnen Fiber) | Point: Fuldt = 1, Lukket = 0,5, Lead = 0,5 | 1,5 + 1 + 0,5 = **3** |

Samme forskel ses i uge og lønperiode.

## Forslag

Lad kortet i toppen bruge samme pointregel som sælgerlisten og Månedsmål (Fuldt = 1, Lukket/Lead = 0,5, Relatel-leads udelukket). Så bliver »+N fiber« lig summen af sælgerlisten (i dag: +3).

Alternativ: behold kortet som »antal fibersalg« og omdøb teksten, fx »(+4 fibersalg)«, så det ikke ligner pointtallet.

## Teknisk

- Kun `supabase/functions/tv-dashboard-data/index.ts`, `handleFiberSalesCount` for TDC-varianten: summér `FIBER_BOARD_POINTS_EF[product_id] × quantity` og udelad Relatel-leads med samme regel som `handleFiberBoardStats`. Relatel-varianten uændret.
- Ingen ændring af salg, provision, løn eller data. Kræver kun udrulning af edge-funktionen; ingen publicering.
- Kontrol: kald endpoint for i dag og forvent 3; sammenlign uge/lønperiode med summen af sælgerlisten.
