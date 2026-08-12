# Medarbejdertal: én sandhed for headcount

## Hvorfor tallene ikke stemmer (alt verificeret i databasen i dag, 12. aug 2026)

Tre visninger måler tre forskellige ting, og to af dem er direkte fejlbehæftede.

**Sandheden i `employee_master_data` lige nu:**

| Mål | Antal |
|---|---|
| Aktive i alt | 125 |
| — heraf Stab/Backoffice | 16 |
| Aktive ekskl. Stab | 109 |
| — heraf opstart i fremtiden (18.–25. aug) | 15 |
| Aktive ekskl. Stab, faktisk startet | **94** |

**Fejl 1 — Medarbejdere-siden viser 106 ud af en løn-KPI, ikke headcount.**
`EmployeeMasterData.tsx:757-764` bruger den cachede KPI `active_employees` og trækker fremtidige opstarter fra. Men den KPI er ikke et headcount: `calculate-kpi-values/index.ts:2011-2079` beregner *aktive ikke-Stab (109) + inaktive med salg i den igangværende lønperiode (12)* = 121. 121 − 15 = 106. Tallet blander altså løn-population med personale-population, og cachen er samtidig 1 time gammel.

**Fejl 2 — "Antal ansatte"-grafen dobbelttæller historikken.**
`HeadcountTrendChart.tsx:66-67` antager eksplicit "ingen overlap" mellem `employee_master_data` og `historical_employment`. Det holder ikke: **115 af 360** historiske rækker er tidsmæssigt overlappende med en master-data-række for en person med samme navn. Det er derfor kurven starter omkring 160 i dec 2025 og "falder" −49 — faldet er i praksis en oprydningsartefakt, ikke virkelighed. Oveni tælles **3 inaktive** medarbejdere uden slutdato med i nuværende måned.

Dertil: `historical_employment` har ingen nøgle til `employee_master_data` (kun `employee_name`), 9 master-rækker mangler startdato, og 2 navne findes to gange i master data. Enhver navnebaseret sammenkobling skal derfor være eksplicit og målbar — ikke implicit.

## Løsning: én kilde til headcount i databasen

Headcount skal ikke beregnes tre steder i frontend. Det defineres én gang i databasen, med samme definition for både nuværende tal og historik.

**1. Ny funktion `public.get_headcount_current()`** (SECURITY DEFINER, læseadgang for indloggede) returnerer i én række:
- `active_started_excl_staff` (94), `pending_starts` (15), `staff_active` (16), `active_total` (125)
- Regel: aktiv = `is_active = true`; startet = `employment_start_date <= i dag` (manglende startdato regnes som startet, så de 9 rækker ikke forsvinder lydløst, men rapporteres i datakvalitetsfeltet)
- Returnerer også `data_quality`: antal aktive uden startdato, antal inaktive uden slutdato

**2. Ny funktion `public.get_headcount_monthly(p_from date)`** returnerer én række pr. måned med `month_end`, `headcount_excl_staff`, `headcount_incl_staff`:
- Bygger et samlet sæt ansættelsesperioder af master data + historik
- **Dedupliker**: en historisk periode udelades, hvis der findes en master-data-række med samme normaliserede navn (trim, lower, kollapset whitespace) og tidsmæssigt overlap. Master data vinder altid, fordi den er den løbende vedligeholdte kilde
- En medarbejder tælles i en måned, hvis perioden dækker skæringsdatoen; nuværende måned skæres pr. dags dato
- Inaktive rækker uden slutdato tælles ikke som ansatte efter deres deaktivering

**3. Frontend læser kun funktionerne** (via nye hooks `useHeadcountCurrent` / `useHeadcountMonthly`, jf. reglen om at komponenter ikke kalder Supabase direkte):
- `EmployeeMasterData.tsx`: kortet viser 94 aktive (ekskl. Stab) + "+15 starter senere"; Stab-kortet 16. Løn-KPI'en `active_employees` bruges ikke længere her (den bevares uændret, hvor lønpopulationen faktisk er meningen)
- `HeadcountTrendChart.tsx`: al beregning fjernes fra klienten; grafen tegner funktionens output
- Begge steder vises definitionen eksplicit ("aktive, startet, ekskl. Stab") plus tidsstempel, så tal kan afstemmes uden gætværk

**4. Datakvalitet gøres synlig, ikke skjult:** hvis der findes aktive uden startdato eller inaktive uden slutdato, vises en diskret note med antal på Medarbejdere-siden, så fejlene bliver rettet i stamdata i stedet for at blive kompenseret i kode.

## Verifikationsjob (kører før noget kaldes færdigt)

1. **Afstemning**: `get_headcount_current()` skal give præcis 94 / 15 / 16 / 125, og 94 + 15 + 16 = 125 skal holde som invariant.
2. **Historik-integritet**: for hver måned skal `headcount_excl_staff` ≤ antal unikke normaliserede navne med aktiv periode i måneden; ingen måned må tælle samme normaliserede navn to gange (kontrol-SQL, forventet 0 dubletter — i dag fejler denne kontrol for 115 rækker).
3. **Kontinuitet**: månedskurven må ikke ændre sig med mere end det faktiske antal opstarter/afgange i måneden (afstemmes mod `start_date`/`end_date`-tællinger pr. måned). Det fanger fremtidige oprydningsartefakter.
4. **Krydstjek mod uafhængig kilde**: nuværende måneds tal sammenholdes med antal aktive rækker i medarbejdertabellens egen liste (samme filter i UI), og med Stab-kortet.
5. **UI-verifikation**: siderne åbnes i preview og tallene læses af på både Medarbejdere og Virksomhedsoverblik — de skal være identiske for samme definition.
6. **Regressionstest**: enhedstest for normaliserings- og overlap-reglen i `src/lib/` (samme regel som funktionen bruger), så dedupe-logikken er dækket.

Resultatet rapporteres med faktiske tal fra hver kontrol. Fejler én kontrol, rettes den før levering.

## Teknisk

- Migration: `get_headcount_current()` og `get_headcount_monthly(date)` som `SECURITY DEFINER`, `SET search_path = public`, `GRANT EXECUTE TO authenticated`. Ingen tabelændringer, ingen sletning af data, `historical_employment` røres ikke (immutabel historik).
- Nye hooks: `src/hooks/useHeadcount.ts` (React Query, query-keys `headcount-current` / `headcount-monthly`).
- Ændrede filer: `src/pages/EmployeeMasterData.tsx` (kun KPI-kort-optælling), `src/components/company-overview/HeadcountTrendChart.tsx` (læser RPC), ny hook, ny test.
- Rører ikke: løn, pricing, `calculate-kpi-values` (løn-KPI'en `active_employees` bevares som den er), RLS på tabeller.
- Zone: DB-migration + rapportering (gul). Ingen rød zone berøres.
