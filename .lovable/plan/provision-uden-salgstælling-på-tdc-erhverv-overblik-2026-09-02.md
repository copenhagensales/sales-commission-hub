# Provision uden salgstælling på TDC Erhverv – Overblik

## Årsag (bekræftet i data)

Månedsmål-filteret er ikke skyld i noget her: ekskluderings-ID'erne findes kun i
`src/config/tdcMonthlyGoals.ts` / `relatelMonthlyGoals.ts` og læses udelukkende af
`useTdcMonthlyGoal.ts` og `useRelatelMonthlyGoal.ts` (bekræftet med søgning i hele repoet).

Sunes salg i dag (`a58ad6c9…`, 09:43, quantity 3, provision 105 kr) ligger på produktet
`82573835…1fd` ("Internetfilter " med trailing mellemrum), som har `counts_as_sale = false`
(sat 17. dec. 2025 — ikke af vores ændringer). Det er korrekt ift. dit ønske: det skal ikke
tælle som salg.

Problemet er `calculate-leaderboard-incremental` (linje ~140):

```text
if (stats.sales === 0 && stats.crossSales === 0) continue;
```

Sunes to salg i dag består udelukkende af produkter med `counts_as_sale = false`
(Internetfilter + Lead Provi HAP), så hans hele række — inkl. 105 kr provision — droppes
fra leaderboard-cachen. De 500 kr og 0,5 fiber-point han vises med i dag kommer alene fra
fiber-hook'en, ikke fra leaderboardet.

## Ændring

1. `supabase/functions/calculate-leaderboard-incremental/index.ts`: behold sælgeren hvis
   `commission > 0`, selv når `sales === 0` og `crossSales === 0`. Provisionen vises
   dermed på overblikket med `Salg = 0` for de produkter der ikke tæller som salg.
2. Deploy funktionen, så cachen genberegnes ved næste kørsel (hvert 2. minut), og verificér
   at Sune står med 605 kr provision og 0 salg i dag på TDC Erhverv – Overblik.

Ingen ændring af `counts_as_sale`: Internetfilter og fiber-produkter tælles fortsat ikke
som salg nogen steder.

## Uden for scope

- Ingen ændring i provisionssatser, pricing-regler eller salgslinjer.
- De to Internetfilter-produkter (dublet med trailing mellemrum) sammenlægges ikke her.
- Månedsmål-boardene (TDC + Relatel) er uændrede.
