# Antal ansatte-grafen viser for lavt tal

## Hvad tallene faktisk er (verificeret i databasen i dag)

- Aktive medarbejdere ekskl. Stab: **109**
- Af dem har **15** en opstartsdato i fremtiden (18.–25. aug 2026) — de tælles derfor ikke med pr. i dag
- Grafens beregning i dag giver **98**: 97 fra `employee_master_data` (startdato ≤ i dag og ingen slutdato før i dag) + 1 fra `historical_employment`
- Blandt de 97 er der **3 inaktive** medarbejdere, der fejlagtigt tælles med, fordi de mangler en slutdato eller har slutdato = i dag

Siden er altså ikke forældet (den hentes live ved hvert besøg — 95 i skærmbilledet er et ældre render), men opgørelsen er skæv af to grunde: fremtidige opstarter er ikke synlige, og inaktive uden slutdato tælles med.

## Løsning

1. **Ret optællingen for nuværende måned**: en medarbejder tælles kun med, hvis rækken er aktiv (`is_active = true`) eller har en slutdato efter skæringsdatoen. Det fjerner de 3 falske positiver. Historiske måneder beregnes uændret ud fra start-/slutdatoer.
2. **Gør fremtidige opstarter synlige** i undertekst i stedet for at skjule dem: "Nu: 95 · 15 kommende opstarter (til 25. aug) · Ændring: …". Grafen ændres ikke — den viser stadig reelt antal pr. månedsslut.
3. **Præcisér teksten** så det er klart, at nuværende måned opgøres pr. dags dato, ikke pr. månedsslut.

## Teknisk

- Kun én fil: `src/components/company-overview/HeadcountTrendChart.tsx` (grøn/gul zone — ren præsentation, ingen løn- eller pricing-logik).
- Tilføj `is_active` til select i `headcount-trend-current`, og brug det i filteret for skæringsdatoen for nuværende måned.
- Nyt afledt tal (kommende opstarter) beregnes i samme `useMemo` ud fra rækker med `employment_start_date > i dag` og `is_active = true`.
- Ingen DB-ændringer, ingen RLS-ændringer.
