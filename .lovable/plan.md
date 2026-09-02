# Internetfilter tælles ikke på TDC Erhverv – Overblik

## Årsag (bekræftet i data, ikke månedsmål-filteret)

Vores nye ekskludering ligger kun i `src/config/tdcMonthlyGoals.ts` +
`src/config/relatelMonthlyGoals.ts` og læses udelukkende af `useTdcMonthlyGoal.ts` og
`useRelatelMonthlyGoal.ts`. Ingen andre hooks eller edge functions kender de ID'er
(bekræftet med søgning på produkt-ID'erne i hele repoet). Overblik-boardet er altså ikke
påvirket af månedsmål-filteret.

Den faktiske årsag er et produktflag i databasen:

| Produkt-id | Navn | `counts_as_sale` | salgslinjer |
| --- | --- | --- | --- |
| `67d0440b…80cff` | `Internetfilter` | true | 0 |
| `82573835…1fd` | `Internetfilter ` (trailing mellemrum) | **false** | 122 |

Sunes salg i dag (`a58ad6c9…`, 09:43, quantity **3**, provision 105 kr) ligger på det
produkt der har `counts_as_sale = false` — sat sådan 17. dec. 2025, altså ikke af vores
ændring. Alle tællere (`calculate-kpi-incremental`, `calculate-leaderboard-incremental`,
`tv-dashboard-data`, `useSalesAggregates`) springer linjer med `counts_as_sale = false`
over, så de 3 stk. indgår ikke i "Salg i dag".

Ekstra bivirkning: i `calculate-leaderboard-incremental` droppes en sælger helt hvis
`sales === 0` (linje ~140). Sunes to salg i dag består kun af flag-false-produkter
(Internetfilter + Lead Provi HAP), så hele hans række — inkl. de 105 kr provision —
forsvinder fra leaderboard-cachen. Hans 500 kr og 0,5 fiber-point kommer alene fra
fiber-hook'en.

## Foreslået ændring

1. Migration: sæt `counts_as_sale = true` på `82573835-02d7-45d1-b7ca-376849baf1fd`, så
   den matcher sin tvilling. Effekt: Internetfilter tælles igen i overblik, dagsrapporter
   og øvrige salgstal. Månedsmål-boardene er uændrede, fordi de ekskluderer på produkt-ID.
2. `calculate-leaderboard-incremental`: skift drop-reglen til også at beholde sælgere med
   `commission > 0`, så en sælger med udelukkende ikke-tællende produkter stadig får sin
   provision vist (rammer i dag også fiber-only-dage).

## Uden for scope

- Ingen ændring af provision, pricing-regler eller historiske salgslinjer.
- De to Internetfilter-produkter sammenlægges ikke i denne opgave (kræver merge-flow og
  gennemgang af prisregler) — kun flaget rettes.
- Relatel-produkterne vi lige frasorterede rører vi ikke: de har korrekte flag og tælles
  fortsat med alle andre steder end månedsmål-boardet.

## Spørgsmål inden jeg bygger

Vil du have flaget rettet på det eksisterende (trailing-space) produkt som beskrevet, eller
skal de to Internetfilter-produkter i stedet slås sammen til ét i samme ombæring?
