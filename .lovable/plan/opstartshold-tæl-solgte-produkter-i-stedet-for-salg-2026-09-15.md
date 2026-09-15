# Opstartshold: tæl solgte produkter i stedet for salg

I dag tæller opstartsmodulet antal salg (ordrer). Et salg med to mobilabonnementer tæller derfor som 1, selv om der er solgt 2 produkter. Dagsrapporterne tæller produkter. Det skal ensrettes, så opstartsholdet tæller produkter — og normalen (kurven) beregnes på præcis samme måde.

## Beslutninger (bekræftet)

- Der tælles kun produkter der er markeret "tæller som salg". Krydssalg (fx Hiper Lukning) og skjulte produkter tælles ikke — hverken for sælgeren eller i normalen.
- Alle aktive opstartere flyttes over på den nye produktbaserede norm, så deres tal og norm matcher med det samme. Tidligere kurveversioner bevares uændret.

## Hvad ændres

1. Alle steder i opstartsmodulet hvor der tælles, skifter fra "antal salg" til "antal solgte produkter":
   - ugekasserne på opstartsholdet
   - den samlede optælling siden opstart
   - den enkelte sælgers kurve på profilen
   - risikoflag (dag 10 og 15) og risikostatistikken
2. Normalen (p25/p50/p75) genberegnes med samme produkttælling, som en ny kurveversion pr. kampagne med opstart aktiveret.
3. Aktive opstartere (dag 1-40) peges på den nye kurveversion.
4. Etiketter i UI opdateres fra "salg" til "produkter", så det er tydeligt hvad tallet er.

## Forventet effekt

Volkan Efe Kayhan får højere tal, fordi hans salg 2/9 og 4/9 hver indeholder 2 mobilabonnementer. Normalen stiger tilsvarende, fordi den historiske gruppe måles på samme måde — så det er ikke en kunstig forbedring.

## Teknisk

- Optællingen skifter fra `count(*)` på `sales` til `sum(sale_items.quantity)` (fratrukket `cancelled_quantity`) joinet til `products` med `counts_as_sale = true` og `is_hidden = false`, stadig afgrænset til `ramp_campaign_ids(...)`, agent-mail og Copenhagen-dato.
- Funktioner der opdateres: `compute_ramp_curve`, `compute_ramp_risk_stats`, `get_ramp_for_employee`, `get_ramp_team_overview`, `ramp_create_risk_flags`.
- Datakørsel efter migration: ny kurveversion + risikostatistik pr. kampagne med `ramp_enabled = true`, derefter opdatering af `employee_ramp_enrollment.curve_version` for aktive opstartere (dag 1-40). Gamle rækker i `ramp_curve` slettes ikke.
- Frontend: kun labels i `src/pages/onboarding/RampTeam.tsx` og `src/components/ramp/RampCurveCard.tsx`. Feltnavne i data (`cum_sales`, `sales`) bevares for at undgå bredere ændringer.
- Rører ikke løn, provision, pricing eller annullering. Historiske kurveversioner og risikoflag bevares.
