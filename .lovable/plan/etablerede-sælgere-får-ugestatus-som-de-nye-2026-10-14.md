# Etablerede sælgere får ugestatus som de nye

## Beslutninger (fra dine svar)
- Målet er de nyes sidste opstartskrav, i dag 17 salg pr. uge. Det står ét sted i Opstart-indstillingerne og følger automatisk med, hvis kravet ændres.
- Etablerede får ugens salg mod krav og statusfarve: Start her / Hold fast / På sporet.
- De tæller med overalt: tal-knapper, graf, "Mangler ugens 1-1", alarmer og mails. Alarmpausen forbliver slået til.

## Hvordan det virker
- Der bruges samme regel som for de nye: kun indeværende uge, til og med i går, med fradrag for helligdage og fravær. Mandag vises sidste uges slutresultat, og "bedre end sidste uge" måles på salg pr. arbejdsdag. Der kommer ingen ny beregning, kun den eksisterende fælles ugeberegning.
- Kravet for opstartsuger efter den sidste er allerede i dag det sidste krav (17). Derfor får de etablerede samme krav, uden at der skal bygges noget særligt.

## Ændringer på siden
1. **Tal-knapperne** (Start her / Hold fast / På sporet / Mangler 1-1) tæller både nye og etablerede.
2. **Grafen** får en ekstra kolonne yderst til højre, "Etableret", efter uge 1–8. Etablerede vises som prikker der på samme måde, med tooltip og klik.
3. **Sektionen "Etablerede sælgere"**: Undertekst ændres til "Efter de første 40 arbejdsdage. Mål: {17} salg pr. uge." Hver række får en kolonne "Ugens salg" med {x}/{krav}, procent og statusfarve. 1-1, sidste 4 uger, feedback, "Skal ikke have feedback", søgning og sidepanel virker som nu. Sidepanelet viser også ugens salg og krav.
4. **Diskret visning** skjuler nu også salgstal for de etablerede, som for de nye.
5. **Ikke startet endnu**: Sælgere med startdato i fremtiden (fx Anton Krogsgaard Kristensen) får ingen status eller krav, før de er startet. De viser "Ikke startet endnu" som i dag.

## Alarmer og mails
- Alarmerne bruger samme ugeberegning og omfatter også de etablerede. Pausen er stadig slået til, så der oprettes ingen alarmer, før du selv ophæver den.
- Ugentlig påmindelse og ekstra-støtte-mail omfatter de etablerede. Feedbackmails er uændrede.

## Uændret
Løn, provision, adgang, ramp-kurveberegningen, sælgerens egen profil og at sælgeren aldrig ser sit eget flag.

## Kontrol før færdig
- Gruppetal på knapperne = prikker i grafen = rækker på tavlen og i Etablerede, uden dubletter.
- Tre etablerede sælgere håndregnes: salg i ugen ÷ (17 × arbejdsdage ÷ 5).
- Tørkørsel af alarmkandidater: vis hvor mange der ville blive oprettet. Ingen oprettes, fordi pausen er slået til.
- Kontrol i browser ved 1440 og 390 px.

## Teknisk
- Migration: `get_ramp_full_team` returnerer `week_status`/`last_week_status` via `ramp_week_status(start_date, campaign_ids, email, end_date, as_of)` for etablerede med startdato ≤ i dag. Flagkandidat-funktion og mail-edge-functions udvides fra kun enrollments til også etablerede. Pause-check uændret.
- Frontend: `RampTeam.tsx` (KPI-tælling), `RampOverviewMatrix.tsx` (kolonnen "Etableret"), `RampEstablished.tsx` og `RampSellerPanel.tsx` (salg/status), `src/lib/rampEstablished.ts` + tests.
- AGENTS.md: reglen "ingen salgsstatus for etablerede" erstattes af "etablerede måles med sidste opstartskrav via samme `ramp_week_status`".
- Zone: gul/rød (alarmlogik), derfor plan først.
