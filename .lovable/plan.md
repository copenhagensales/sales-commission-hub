# Medarbejdertal stemmer ikke på tværs af siderne

## Hvad de tre tal faktisk er (verificeret i databasen kl. 13:20)

Sandheden i `employee_master_data` lige nu:

- Aktive i alt: **125** (heraf **16** Stab)
- Aktive ekskl. Stab: **109** — heraf **15** med opstart i fremtiden (18.–25. aug), altså **94** som er startet
- `historical_employment` (tidligere ansatte): 1 række uden slutdato tælles fejlagtigt som stadig ansat

Derfor viser siderne forskellige tal:

- **Medarbejdere-siden (106 + 15 starter senere):** tallet kommer fra en cachet KPI (`active_employees` = 121, beregnet kl. 12:30) minus de 15 fremtidige opstarter. To fejl: cachen **inkluderer Stab** (så 106 er ikke sammenlignelig med grafen, som er ekskl. Stab), og cachen er forældet (121 mod 125 reelt).
- **"Antal ansatte"-grafen (95/98):** ekskl. Stab og ekskl. fremtidige opstarter, altså 94 — men den lægger fejlagtigt 3 inaktive medarbejdere uden slutdato + 1 historisk række oveni, og tallet i skærmbilledet (95) var et ældre render.

Ingen af de to visninger er direkte forkerte i intention — de måler blot forskellige ting og har hver sin fejlkilde.

## Løsning

1. **Medarbejdere-siden**: beregn "Aktive medarbejdere" direkte fra de indlæste medarbejderrækker i stedet for den cachede KPI, og hold Stab ude af tallet (Stab har sit eget kort). Sublinjen "+15 starter senere" bevares. Så bliver kortet: 94 aktive (ekskl. Stab) + 15 starter senere + 16 Stab = 125 aktive i alt.
2. **"Antal ansatte"-grafen**: tæl kun medarbejdere med, der er aktive eller har slutdato efter skæringsdatoen — det fjerner de 3 falske positiver. Historiske rækker uden slutdato behandles som ophørte (de er pr. definition tidligere ansatte), så den sidste måned ikke tælles for højt.
3. **Gør definitionerne synlige** i grafens undertekst: "ekskl. Stab · nuværende måned pr. dags dato · 15 kommende opstarter ikke medregnet", så tallet kan afstemmes mod Medarbejdere-siden uden gætværk.

Efter rettelsen viser begge sider 94 som "startet og aktiv ekskl. Stab", med 15 kommende opstarter og 16 Stab oplyst separat.

## Teknisk

- `src/pages/EmployeeMasterData.tsx`: erstat `cachedActiveCount`-baseret `activeCount` med lokal optælling `is_active && !is_staff_employee && (ingen startdato || startdato <= i dag)`. Cachen bruges ikke længere til dette kort (den er både forældet og inkluderer Stab).
- `src/components/company-overview/HeadcountTrendChart.tsx`: medtag `is_active` i select og i filteret; behandl `historical_employment`-rækker uden `end_date` som ophørte; udvid undertekst.
- Zone: præsentation/rapportering (grøn/gul). Ingen løn-, pricing- eller DB-ændringer. Ingen ændringer i selve KPI-cachen — hvis den skal rettes til at ekskludere Stab, er det en separat opgave i `calculate-kpi-incremental`.
