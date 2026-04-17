

## Mål
Tilføj en KPI-oversigt øverst på `/recruitment/booking-flow` så man straks kan se sundheden i recruitment-flowet.

## Undersøgelse nødvendig før implementering
Jeg skal lige tjekke den eksisterende side og datamodel for at vælge de rigtige KPI'er:
- `src/pages/recruitment/BookingFlow.tsx` (eller tilsvarende route-komponent) — hvad vises i dag, og hvilke queries findes
- Tabeller: `booking_flow_enrollments` (status: active/cancelled/completed), `booking_flow_touchpoints` (status: pending/sent/failed), `candidates` (status: applied/interview_scheduled/hired/rejected/ghostet/takket_nej)
- Memory `recruitment/booking-flow-and-management` (9-trins flow) og `infra/recruitment-flow-automation-cron`

## Foreslåede KPI'er (kort visning)

**Række 1 — Flow-aktivitet (nu)**
1. **Aktive i flow** — `booking_flow_enrollments` hvor `status = 'active'`
2. **Nye sidste 7 dage** — enrollments oprettet inden for 7 dage
3. **Gennemført flow** — `status = 'completed'` (alle touchpoints sendt)
4. **Annulleret** — `status = 'cancelled'` (kandidat ghostet/rejected/takket nej undervejs)

**Række 2 — Kandidat-udfald (sidste 30 dage)**
5. **Ghostet** — candidates med status `ghostet`
6. **Takket nej** — status `takket_nej`
7. **Interview booket** — status `interview_scheduled`
8. **Hired** — status `hired` (konvertering)

**Række 3 — Touchpoint-sundhed (operationel)**
9. **Pending touchpoints** — `booking_flow_touchpoints.status = 'pending'` due nu eller før (advarsel hvis cron hænger)
10. **Failed touchpoints (24t)** — fejlede SMS/email sidste døgn
11. **Konverteringsrate** — hired / (alle der startede flow sidste 30 dage) i %

## Layout
- Genbrug eksisterende `Card`-mønster (som `vagt-flow/Index.tsx` og `Dashboard.tsx`)
- Grid: 4 kolonner på desktop, 2 på mobil — én række pr. tema (3 rækker total)
- Hver KPI-card: stort tal, label, lille subtext (fx "vs. forrige 30 dage" eller farvet trend)
- Loading-skeletons mens queries kører
- Failed-touchpoints rød hvis > 0; pending gul hvis > 20

## Filer
- `src/pages/recruitment/BookingFlow.tsx` (eller den faktiske route-fil) — tilføj `<RecruitmentKpiBar />` øverst
- `src/components/recruitment/RecruitmentKpiBar.tsx` — NY, indeholder alle queries og card-grid
- Evt. `src/hooks/useRecruitmentKpis.ts` — NY hvis vi vil samle queries i én hook

## Spørgsmål før implementering

1. **Hvilke 4-8 KPI'er er vigtigst for dig?** (Hellere færre & vigtige end 11 cards)
2. **Tidsperiode**: Skal "annulleret/ghostet/takket nej" være sidste 30 dage, indeværende måned, eller "all time"?
3. **Touchpoint-sundhed**: Skal pending/failed touchpoints med (operationelt overblik for admin), eller kun rene flow/kandidat-tal?
4. **Konverteringsrate**: Vil du have % hired-rate som en KPI, eller er det fint at se rå tal?

