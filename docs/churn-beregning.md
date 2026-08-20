# Sådan beregnes churn på Virksomhedsoverblik i Stork (status 20. aug 2026)

Dette dokument kan kopieres 1:1 ind i en anden AI-chat til verificering.

## 1. Datakilder

- `employee_master_data` — nuværende medarbejdere. Felter brugt: `is_active`, `employment_start_date`.
- `historical_employment` — tidligere medarbejdere (én række pr. afsluttet ansættelse). Felter brugt: `team_name`, `start_date`, `end_date`, `tenure_days` (forudberegnet anciennitet i dage).
- `team_members` + `teams` — holdtilknytning for nuværende medarbejdere (bruges kun til at filtrere hold).

Teams "Stab" og "Ukendt" (ingen holdtilknytning) ekskluderes overalt i churn-tallene.

## 2. Nuværende formel (kortet "60-dages Churn")

Kode: `src/pages/CompanyOverview.tsx` (query `company-overview-all-employees-churn-stats`) og
`src/components/company-overview/NewHireChurnKpi.tsx` (samme logik pr. hold).

```
tæller  = antal rækker i historical_employment hvor tenure_days <= 60   (ekskl. Stab/Ukendt)
nævner  = antal aktive medarbejdere (ekskl. Stab/Ukendt)
        + antal rækker i historical_employment (ekskl. Stab/Ukendt)
churn % = tæller / nævner * 100
```

Faktiske tal i dag:

| Størrelse | Værdi |
|---|---|
| Aktive medarbejdere (ekskl. Stab/Ukendt) | 97 |
| Historiske ansættelser (ekskl. Stab/Ukendt) | 370 |
| Nævner (97 + 370) | 467 |
| Stoppede med tenure_days <= 60 | 212 |
| **Resultat** | **45,4 %** |

Der er ingen tidsafgrænsning: alle historiske ansættelser nogensinde indgår, uanset om de startede i 2023 eller i 2026.

## 3. Statistiske problemer med den nuværende formel

1. **Blandet nævner (survivorship / censurering).**
   Nævneren indeholder 97 aktive medarbejdere, hvoraf 43 har mindre end 60 dages anciennitet.
   De kan pr. definition ikke ligge i tælleren endnu, men de trækker nævneren op.
   Effekt: churn undervurderes systematisk, og tallet falder kunstigt hver gang der ansættes nye.

2. **Ingen kohorte-afgrænsning.**
   Tælleren er "alle 60-dages afgange nogensinde", nævneren er "alle ansættelser nogensinde + nuværende".
   Det er ikke en rate for en veldefineret periode; den kan ikke bruges til at se udvikling.

3. **Ingen periodefiltrering.**
   Et tal der dækker hele virksomhedens historie reagerer meget langsomt på forbedringer.
   Ledelsen kan gøre alt rigtigt i 6 måneder uden at tallet flytter sig nævneværdigt.

4. **Datakvalitet.** 1 række i `historical_employment` har negativ `tenure_days`
   (filtreres i `NewHireChurnKpi.tsx`, men **ikke** i KPI-kortet på `CompanyOverview.tsx` — lille inkonsistens).
   2 aktive medarbejdere mangler startdato; 7 har startdato i fremtiden og tælles alligevel som aktive i nævneren.

5. **Tenure-definition.** `tenure_days` er forudberegnet i `historical_employment`; kortet stoler på feltet
   uden at genberegne `end_date - start_date`. Grænsen er `<= 60` (inklusiv dag 60).

## 4. Alternative beregninger (samme rådata, kohorte-korrekt)

**A. Kohorte-baseret, al historik.** Kun personer der har haft *mulighed* for at nå 60 dage:

```
nævner = historiske ansættelser (370) + aktive med anciennitet >= 60 dage (57) = 427
tæller = 212
=> 49,6 %
```

**B. Rullende 12 måneder (anbefalet styringstal).** Kun ansættelser startet mellem for 365 dage siden og for 60 dage siden:

```
nævner = 142 historiske + 27 aktive = 169
tæller = 97 af dem stoppede inden 60 dage
=> 57,4 %
```

Forskellen 45,4 % → 49,6 % → 57,4 % viser både censurerings-biasen og at churn for nyere ansættelser
faktisk er **højere** end det viste tal.

## 5. Konkret spørgsmål til verificering

> Er 45,4 % en gyldig 60-dages churn-rate, når nævneren indeholder 43 personer med under 60 dages
> anciennitet, som umuligt kan optræde i tælleren? Og er kohorte-formlen i afsnit 4 (kun ansættelser
> med mindst 60 dages observationstid, afgrænset til rullende 12 måneder) den korrekte erstatning?

## 6. Øvrige tal på siden (kontekst, ikke churn)

- **Nuværende ansatte (183):** unikke `team_members`-rækker ekskl. "Ukendt" — inkluderer Stab og fremtidige opstarter, og er derfor et andet tal end de 97 i churn-nævneren.
- **Gns. anciennitet (9,6 mdr):** gennemsnit af `current_date - employment_start_date` for aktive ekskl. Stab, divideret med 30.
- **Churn-kalkulator:** bruger samme 45,4 % som udgangspunkt; `annualHires = historicalCount * 0.8` er et skøn uden datagrundlag.
