# Opstart: forventningen bliver målestokken

## Sådan virker det i dag (bekræftet)
- **Status pr. sælger** beregnes i databasefunktionen `get_ramp_team_overview`: `under` hvis salg < p25, `over` hvis salg > p75, ellers `midt`. Grupperne beregnes ud fra det (`supportGroup` i `RampOverviewMatrix.tsx:16`): under + stigende = Hold fast, under + andet = Start her, midt/over = På sporet.
- **Trend** (`RampTeam.tsx:140-145`): salg i seneste uge minus salg i ugen før, giver ↑ → ↓.
- **Grafen** placerer sælgeren ved salg ÷ p50 (`RampOverviewMatrix.tsx:109-111`). Minimumskravet vises som en lilla stiplet linje.
- **Fareflag og mail**: `ramp_create_risk_flags` opretter flag på dag 10 og 15, når salg < p25. Tallet gemmes i `ramp_risk_flag.threshold_value`. `send-ramp-risk-alerts` sender mailen ud fra `ramp_risk_mail_payload`.
- **Minimumskrav**: `ramp_settings.weekly_min_targets` (5/8/11/14/17). Fordelingen pr. dag ligger i dag kun i frontend (`src/lib/rampMinTarget.ts`).
- "Din opstart" på sælgerens egen profil bruger andre funktioner (`get_my_ramp…`) og ændres ikke.

## Det bygges
**Én beregning, ét sted.** Fordelingen pr. dag flyttes ind i en databasefunktion `ramp_expected_at(day_no)`, som læser `weekly_min_targets`: ugens krav ÷ 5 pr. arbejdsdag, og sidste tal gælder for de senere uger. Både siden og fareflaget bruger den. Frontend-funktionen beholdes kun til forhåndsvisning i redigeringen og testes mod samme tal.

1. **Data til siden** (`get_ramp_team_overview`): hver sælger får også `expected_today`, `expected_pct` og `expectation_status` (`under` < 100 %, ellers `on_track`). De gamle felter (`status`, p25/p50/p75) bliver liggende, så intet andet går i stykker. Adgang og "sælgeren ser aldrig sig selv" ændres ikke.
2. **Grupper og KPI-kort** bruger `expectation_status`. Undertekster: "Under forventning og flad/faldende", "Under forventning, men stigende", "På eller over forventning".
3. **Grafen**: Y-aksen viser procent af forventningen (0–200 %+). Der er en mørk 100 %-streg med mærkatet "Forventning", grøn/rød baggrund med tekst, og X-aksen er delt i opstartsuger med "Uge N" og "X salg". Holdmarkeringer står som stiplede linjer med etiketten over grafen. Den lilla linje fjernes. "Vis typisk spænd (historik)" er slået fra som standard og viser p50 og spænd omregnet til procent af forventningen. Tooltip og fodnote bruger de tekster, du har angivet.
4. **Listen "START HER · I DAG"** står til højre for grafen og under den på smalle skærme. Hver række viser "x af y salg", en bar og "Mangler n salg".
5. **Kravrækken "Forventning · salg pr. uge"** under grafen kan ses af alle med adgang. "Ret" vises kun for ejere og bruger samme redigering som i dag.
6. **Fareflag (dag 10 og 15)**: `ramp_create_risk_flags` sammenligner med `ramp_expected_at(day)` i stedet for p25 og gemmer forventningen i `threshold_value`. Flag, der allerede findes, ændres ikke. Mailens sælgerlinje viser "x salg · forventet y (z %)". Ordet "farezone" bruges ingen steder.

## Skal du tage stilling til, før jeg bygger
- **A. Trend:** "samme trendlogik på forholdet" foreslås sådan: ugens salg ÷ ugens krav for seneste uge sammenlignet med ugen før. Ugen i gang regnes kun med de arbejdsdage, der er gået. Alternativet er at beholde den nuværende trend (rå salg uge mod uge). Den er enklere, men ligner stigning ved overgangen fra uge 1 (5 salg) til uge 2 (8 salg).
- **B. Boksen "Hvorfor ekstra støtte?" og 68 %/27 %-tallene** i siden og mailen bygger på historikken målt mod p25. De passer ikke til den nye målestok. Valg: (1) skjul dem, (2) behold dem, mærket "historik", eller (3) beregn dem om mod forventningen (ny beregning, kan give andre tal).
- **C. Åbne flag fra den gamle målestok:** de bliver liggende og vises som i dag (forslag) eller lukkes ikke automatisk. Ingen sletning.

## Afgrænsning
Løn, provision, opstartskurvens beregning (`ramp_curve`), "Din opstart", adgang og sælgerens skjulte eget flag ændres ikke. Allerede gemte flag og løndata røres ikke.

## Kontrol før jeg melder færdig
- Antal i hver gruppe = antal prikker under/over 100 %-stregen (tælles i browseren).
- Tre stikprøvesælgere regnet i hånden: salg, forventet og procent.
- Tabel over gruppefordelingen før (p25) og efter (forventning).
- Tørkørsel af flaglogikken: hvor mange nye flag, der ville blive oprettet med den nye målestok, før den aktiveres.
- Test af `ramp_expected_at` mod `minCumulativeAt`.

## Tekniske detaljer
- Migration: `ramp_expected_at(int)` (STABLE, SECURITY DEFINER, `search_path=public`), udvidelse af `get_ramp_team_overview`, ændring i `ramp_create_risk_flags` og i mailens tekst/payload.
- Filer: `RampOverviewMatrix.tsx`, `RampTeam.tsx`, `RampMinTargetsEditor.tsx`, `useRampTeam.ts` (typer), `send-ramp-risk-alerts/index.ts`, test i `rampMinTarget.test.ts`.
