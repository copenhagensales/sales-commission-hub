# Opstart: ugemodel i stedet for samlet forventning

## Pause af alarmerne (laves først, med det samme efter godkendelse)
- Flagene oprettes af natjobbet `ramp-curve-nightly` kl. 03:50 UTC (05:50 dansk tid). Det kalder `ramp_nightly_maintenance()`, som kalder `ramp_create_risk_flags()`. Næste kørsel er i nat (15. okt) og ville oprette de to dag 15-flag efter den samlede model.
- Pausen: en ny indstilling `ramp_settings.risk_flags_paused` (sand/falsk, standard falsk). Den sættes til sand. Når den er sand, opretter `ramp_create_risk_flags()` ingen flag og returnerer 0. Tilmelding af nye sælgere og resten af natjobbet kører videre som normalt.
- Mailjobbet `ramp-risk-alert-mail` (06:10 UTC, hverdage) sender kun om åbne flag. Når der ikke kommer nye flag, kommer der heller ingen nye mails. Gamle åbne flag bliver liggende.
- Pausen ophæves (sættes til falsk) som sidste trin, når ugemodellen er live og tørkørslen er godkendt af dig. Det fortæller jeg dig, når det sker.

## Ugemodellen: én beregning i databasen
Ny databasefunktion `ramp_week_status(employee, dato)`. Den er den eneste kilde og bruges af siden, grupperne, kortene, flagene og mailen. Pr. sælger regner den:
- **Kalenderuge** for datoen, og **opstartsuge** = antal kalenderuger fra startugen (startugen er uge 1).
- **Arbejdsdage i ugen** = hverdage fra og med startdatoen, minus `danish_holiday` (bruger den eksisterende `ramp_week_workdays`).
- **Ugens krav** = `weekly_min_targets[opstartsuge]` × arbejdsdage ÷ 5. Det sidste tal gælder for senere uger.
- **Afsluttede dage** = arbejdsdage i ugen til og med i går.
- **Forventet nu** = ugens krav × afsluttede dage ÷ arbejdsdage i ugen.
- **Ugens salg til og med i går** (bruges til status) og **ugens salg inkl. i dag** (vises kun i "X af Y salg"). Salg tælles som i dag (`ramp_product_count`).
- **Sidste uges resultat** = sidste uges salg ÷ sidste uges krav. Findes kun fra opstartsuge 2.
- **Status:**
  - Ingen afsluttede dage (mandag eller første dag) → `ny_uge`. Indgår ikke i grupperne. Ingen flag.
  - Salg ≥ forventet nu → På sporet.
  - Under, og opstartsuge 1 (ingen forrige uge) → **Hold fast**.
  - Under, og ugens tempo (salg ÷ forventet nu) > sidste uges resultat → Hold fast.
  - Ellers → Start her.
- **Historik:** de sidste op til 4 hele kalenderuger med opfyldt (salg ≥ krav) eller ikke opfyldt. Påvirker aldrig status.
- Den gamle trendlogik og den samlede forventning bruges ikke længere til status.

"Opdateres kun om morgenen" opnås ved, at status altid regnes til og med i går. Den ændrer sig derfor ikke i løbet af dagen. Kun "X af Y salg" er live.

## Siden ("Ugetavle")
- Overskrift "Uge 42 · hvem er på sporet?", undertekst "Målt til og med i går (tirsdag) · 2 af 5 arbejdsdage gået · 3 dage tilbage" og en lille bar "Ugen er 40 % gået". Mandag: "Ny uge · første status i morgen", og grupperne viser 0.
- De tre kort beholder opbygningen og får de nye undertekster, som du har angivet.
- Spredningsdiagrammet og listen "Start her · i dag" fjernes. De erstattes af ugetavlen med grupperne START HER (vises altid helt), HOLD FAST og PÅ SPORET (2–3 vises, derefter "Vis N flere"). Antallet står ved hver gruppe.
- Kolonnerne SÆLGER, UGENS SALG MOD KRAV (bar = krav, fyld i gruppens farve, mørk markør ved forventet nu), RESTEN AF UGEN og SIDSTE UGER (firkanter med tooltip, "Ny" uden hele uger) følger dine tekster. Tabellen scroller vandret i sin egen boks på smalle skærme.
- Forklaring over tavlen, kravrækken "Krav · salg pr. kalenderuge" ("Ret" kun for ejere) og fodnoten som angivet.
- 68 %/27 %-boksen (mærket historik), filterknapper, søgning, sælgerkort og diskret visning er uændrede.

## Alarmer og mails
- `ramp_create_risk_flags()` opretter flag på dag 10 og 15, hvis sælgeren har status Start her efter `ramp_week_status` for i går. `threshold_value` gemmer "forventet nu". Mandag og "ny uge" giver aldrig flag. Flag fra tidligere modeller ændres ikke.
- Mailen (`ramp_risk_mail_payload` + `send-ramp-risk-alerts`) viser kolonnen "Ugens salg mod krav", fx "3 af 8 · burde have 3 · mangler 5". Ordet "farezone" bruges ikke.

## Afgrænsning
Løn, provision, opstartskurven (`ramp_curve`), "Din opstart", adgangen til siden og at sælgeren aldrig ser sit eget flag ændres ikke. Gemte flag og løndata røres ikke. De gamle felter i `get_ramp_team_overview` bliver liggende, så intet andet går i stykker.

## Kontrol før jeg melder færdig
- Gruppefordeling før (samlet model) og efter (ugemodel).
- Tre sælgere regnet i hånden med alle mellemtal.
- SQL-test af tilfældene: start tirsdag, uge med helligdag, mandag uden status, opstartsuge 1 = Hold fast, to gode uger + dårlig indeværende uge (aldrig På sporet).
- Spejlet frontendberegning (kun til visning og forhåndsvisning i redigeringen) testes mod de samme tal i `rampMinTarget.test.ts`.
- Tørkørsel: hvilke flag ville blive oprettet i morgen. Først derefter ophæves pausen, efter din godkendelse.
- Antal i grupperne kontrolleres i browseren mod rækkerne i tavlen.

## Tekniske detaljer
- Migration 1 (straks): `ramp_settings.risk_flags_paused boolean default false`, guard i `ramp_create_risk_flags`, og flaget sættes til sand.
- Migration 2: `ramp_week_status(uuid, date)` (STABLE, SECURITY DEFINER, `search_path=public`), udvidelse af `get_ramp_team_overview` med ugefelter + historik, ny logik i `ramp_create_risk_flags`, ny payload i `ramp_risk_mail_payload`.
- Filer: `RampTeam.tsx`, `RampOverviewMatrix.tsx` (erstattes af ugetavle-komponent), `RampMinTargetsEditor.tsx` (tekst), `useRampTeam.ts` (typer), `rampMinTarget.ts` + test, `send-ramp-risk-alerts/index.ts`.
- Mandagslogik er ens i databasen og frontend, da begge bruger "afsluttede dage = 0".
