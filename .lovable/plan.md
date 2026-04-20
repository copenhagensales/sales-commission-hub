

## Booking-flow engagement rapport

### Problem

Vi kan rapportere på 3 ud af 4 ønskede metrics ud af boksen, men **link-klik tracker vi ikke i dag**. `short_links`-tabellen har kun `code`, `target_url`, `candidate_id`, `link_type`, `created_at` — ingen klik-tæller. Redirect-funktionen (`/r/:code`) fetcher bare `target_url` og sender brugeren videre uden at logge noget.

For at få den fulde rapport skal vi først tilføje klik-tracking, derefter bygge selve rapporten.

### Plan

**1. Tilføj klik-tracking på short links** (migration)
- Tilføj kolonner til `short_links`: `click_count INTEGER DEFAULT 0`, `first_clicked_at TIMESTAMPTZ`, `last_clicked_at TIMESTAMPTZ`.
- Opret tabel `short_link_clicks` (id, short_link_id, candidate_id, clicked_at, user_agent, ip_hash) for detaljerede events (så vi kan beregne unikke klik pr. kandidat).
- RLS: public insert (logges fra redirect), authenticated read.

**2. Log klik i redirect-flow**
- Opdatér edge-funktionen `supabase/functions/r/index.ts` til at:
  - Indsætte en row i `short_link_clicks`
  - Inkrementere `click_count` og opdatere `last_clicked_at` på `short_links` (og sætte `first_clicked_at` første gang)
- Opdatér `src/pages/ShortLinkRedirect.tsx` på samme måde (fallback når brugeren rammer SPA-routen direkte).
- Fire-and-forget: redirect må ikke blokere på logging.

**3. Byg rapport-side: `/recruitment/booking-flow/engagement`**
Ny route + side `BookingFlowEngagement.tsx` med periode-filter (default: sidste 30 dage) og 3 sektioner:

**A. Funnel (top-tal):**
| Metric | Kilde |
|---|---|
| Kandidater i flow | `booking_flow_enrollments` (alle statuser) |
| Touchpoints sendt | `booking_flow_touchpoints` status=sent |
| Unikke kandidater der åbnede et booking-link | `short_link_clicks` join `short_links` (link_type='booking') |
| Kandidater der svarede på SMS | distinct candidates m. `communication_logs` direction='inbound', type='sms' |
| Selvbookede interviews | `booking_flow_enrollments` cancelled_reason ILIKE 'kandidat selv%' eller candidates.status='interview_scheduled' inden for flow-periode |
| Ghosted | candidates.status='ghostet' |
| Takket nej | candidates.status='takket_nej' |
| Afmeldt (unsubscribe-link) | `short_link_clicks` join `short_links` (link_type='unsubscribe') |

Hver række viser absolut antal + konverteringsrate ift. "Touchpoints sendt".

**B. Per-touchpoint breakdown** (tabel)
Grupperet på `template_key`:
- Sendt | SMS-svar inden for 48t | Booking-link åbnet inden for 48t | Bookede inden for 48t | Failed
- Hjælper med at se hvilke beskeder der virker bedst.

**C. Per-tier breakdown** (tabel)
A/B/C-segment × samme kolonner. Viser om vores segmentering rammer de rigtige.

**4. Tilføj link i sidebar/booking-flow page**
Knap "Engagement-rapport" på `/recruitment/booking-flow` der linker til den nye side.

### Hvad jeg IKKE rører
- Booking-flow templates / cron / send-logik
- Eksisterende `/recruitment/booking-flow` UI (kun ny knap)
- KPI-bar ovenfor (`RecruitmentKpiBar`) — den fortsætter uafhængigt

### Filer
- Ny migration: `short_links` kolonner + `short_link_clicks` tabel + RLS
- `supabase/functions/r/index.ts` (log klik)
- `src/pages/ShortLinkRedirect.tsx` (log klik)
- Ny: `src/pages/recruitment/BookingFlowEngagement.tsx`
- `src/routes/pages.ts` + `src/routes/config.tsx` (route)
- `src/pages/recruitment/BookingFlow.tsx` (knap til rapport — find rigtige filnavn under exploration)

### Verificering
- Klik et booking-shortlink → row i `short_link_clicks`, `click_count` stiger
- Åbn `/recruitment/booking-flow/engagement` → tal matcher SQL-tjek manuelt for sidste 30 dage
- Periode-filter ændrer alle tre sektioner

