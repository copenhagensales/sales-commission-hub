# Ekskludér produkter fra Relatel Månedsmål

## Navnematch (bekræftet i databasen)

Dine navne står lidt anderledes i `products`. Mapping jeg bruger — 23 produkter, kun BTL/#-varianter
for Switch Professionel:

| Din liste | Produkt i systemet |
| --- | --- |
| SW Professionel BTL / #2 / #3 | Switch Professionel #1 / #2 / #3 |
| Omstillingsbruger ATL | Omstillingsbruger ATL |
| Omstillingsbruger BTL / #2 / #3 / #4 | Omstillingsbruger #1 / #2 / #3 / #4 |
| M2M Basis, M2M Medium DK, M2M Medium, M2M Stor | samme navne (uden "(36 mdr.)") |
| Datadeling ATL | Datadeling ATL |
| Datadeling BTL / #2 | Datadeling Trin 1 / Trin 2 |
| Mobilfeatures ATL | Mobilfeatures ATL |
| Mobilfeatures BTL / #2 / #3 / #4 | Mobilfeatures Trin 1 / 2 / 3 / 4 |
| Smartwatch e-sim ATL | Smartwatch e-sim ATL |
| Smartwatch e-sim BTL / #2 | Smartwatch e-sim Trin 1 / Trin 2 |

Følgende ligner listen men er IKKE med (præcis-match, som du valgte):
`Switch Professionel ATL`, `Switch Professionel ` (unummereret), `Omstillingsbruger` (unummereret),
`Mobilfeatures Trin 5` og `Trin 6`, `Mobilfeatures (36 mdr.)`, `M2M ... (36 mdr.)`-varianterne og
`ATL FULD PRIS - Mobilfeatures (ingen binding)`. Sig til hvis nogle af dem også skal ud.

## Ændring

1. Ny konstant `RELATEL_MONTHLY_GOAL_EXCLUDED_PRODUCT_IDS` i `src/config/relatelMonthlyGoals.ts`
   med de 23 produkt-id'er (navne som kommentar, så listen kan læses).
2. `src/hooks/useRelatelMonthlyGoal.ts`: spring salgslinjer over hvis `productId` findes i den nye
   liste — samme sted som den nuværende Internetfilter-ekskludering, altså før al optælling, så det
   gælder teamtotal, sælgerrækker og dagsbokse på én gang.

TDC-boardet ændres ikke. Internetfilter-ekskluderingen bevares uændret på begge boards.

## Effekt i dag (september 2026)

To salgslinjer på Relatel rammes: `Datadeling Trin 1` (1 stk.) og `Omstillingsbruger #3` (1 stk.).
Teamtotal går fra 41 til 39, og de to sælgere med linjerne tælles tilsvarende ned.

## Uden for scope

Ingen ændringer i pricing, provision, løn, edge functionen eller andre rapporter — kun tælleregler på
Relatel-månedsmålsboardet. Salgene slettes ikke.
