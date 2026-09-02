# Internetfilter skal ikke tælle med i månedsmål

## Hvad der er fundet

Der findes to produkter med navnet "Internetfilter":

| Produkt-id | Navn | Kampagne |
| --- | --- | --- |
| `67d0440b-032f-4e09-a348-ff61b8980cff` | Internetfilter | TDC Erhverv Products |
| `82573835-02d7-45d1-b7ca-376849baf1fd` | "Internetfilter " (trailing mellemrum) | ingen kampagne |

I september 2026 er der 3 stk. registreret — alle på det andet (kampagneløse) produkt. Det er derfor
begge id'er skal ekskluderes, ellers tælles de 3 stk. fortsat med.

Boardet tæller i dag alle salgslinjer på TDC Erhverv-klienten (`useTdcMonthlyGoal.ts` linje 98-106),
så Internetfilter indgår både i teamtotal, sælgerrækker og dagsbokse.

## Ændring

1. Ny konstant i `src/config/tdcMonthlyGoals.ts`: `MONTHLY_GOAL_EXCLUDED_PRODUCT_IDS` med de to
   Internetfilter-id'er (kommentar om hvorfor).
2. `src/hooks/useTdcMonthlyGoal.ts`: spring salgslinjer over hvis `productId` findes i listen —
   før vægtning, så det gælder teamtotal, sælgertotal og dagsbokse på én gang.
3. Samme filter i `src/hooks/useRelatelMonthlyGoal.ts`, så de to boards ikke kan drifte fra hinanden
   (ingen praktisk effekt på Relatel i dag, da produktet er et TDC-produkt).

Effekt på boardet i dag: teamtotal for september går fra 49 til 46, og de sælgere der har
Internetfilter-linjer får tilsvarende færre.

## Uden for scope

Ingen ændringer i provision, pricing, edge functionen eller andre rapporter — kun tælleregler på de
to månedsmål-boards. Salgene slettes ikke og indgår fortsat i løn og øvrig rapportering.
