

## Booking Flow — Automatiseret outreach med A/B/C-segmentering

### Koncept
Et automatiseret multi-dag outreach-system der tager nye kandidater og kører dem igennem et struktureret flow af emails, SMS og opkaldspåmindelser — med det formål at booke en samtale. Kandidater segmenteres i A/B/C-tiers baseret på kvalifikationskriterier, og hver tier får sit eget flow med forskellig intensitet.

### Tilpasning til jeres nuværende setup
I har allerede: M365-email (edge function), Twilio SMS (edge function), email-skabeloner, scheduled_emails-tabel og kandidat-statusser. Booking flow bygges oven på dette fundament:

- **Eksisterende edge functions genbruges** — `send-recruitment-email` og `send-recruitment-sms` bruges som afsendere
- **Eksisterende kandidat-statusser udvides** — ny status `i_flow` tilføjes
- **Scheduled emails-tabellen udvides** — bruges til at planlægge alle touchpoints i flowet

### Flows per tier

| Tier | Dag 0 | Dag 1 | Dag 2 | Dag 3 |
|------|-------|-------|-------|-------|
| **A** (4-5 kriterier) | Email + SMS inden 10 min | Pre-call SMS + opkaldspåmindelse + follow-up SMS | Reminder email + 2. opkaldspåmindelse | Sidste kontaktforsøg |
| **B** (2-3 kriterier) | Email med booking-link | SMS hvis ingen booking | Opkaldspåmindelse | — |
| **C** (0-1 kriterier) | Bekræftelsesmail | — | — | Venligt afslag dag 3-5 |

### Database-ændringer

1. **Ny tabel: `booking_flow_enrollments`**
   - `candidate_id`, `tier` (A/B/C), `enrolled_at`, `current_day`, `status` (active/completed/cancelled)
   - Knytter en kandidat til et aktivt flow

2. **Ny tabel: `booking_flow_touchpoints`**
   - `enrollment_id`, `day`, `channel` (email/sms/call_reminder), `scheduled_at`, `status` (pending/sent/skipped), `template_key`
   - Alle planlagte touchpoints for en kandidat

3. **Ny tabel: `booking_flow_criteria`**
   - `id`, `name`, `description`, `active`
   - De 5 konfigurerbare must-have kriterier brugt til segmentering

4. **Tilføj `tier` kolonne** på `candidates`-tabellen (A/B/C/null)

### Nye sider og UI

1. **Booking Flow side** (`/recruitment/booking-flow`)
   - Oversigt over aktive flows: hvor mange kandidater i hvert tier, status-distribution
   - Liste med kandidater i flow — navn, tier-badge, dag i flow, sidste touchpoint, næste planlagte aktion
   - Mulighed for manuelt at tilføje en kandidat til flow / fjerne fra flow

2. **Segmenteringsmodal**
   - Vises når en kandidat enrolles i flowet
   - 5 ja/nej toggles for must-have kriterier
   - Auto-beregning af tier (4-5 = A, 2-3 = B, 0-1 = C)
   - Preview af hvilket flow der trigges

3. **Flow-skabeloner side** (ny tab på EmailTemplates)
   - Skabeloner organiseret per tier og dag
   - Redigerbare med merge tags: `{{fornavn}}`, `{{rolle}}`, `{{booking_link}}`

### Edge function: `process-booking-flow`

- Cron-job der kører hver time i arbejdstiden (8-17)
- Finder touchpoints der er forfaldne (`scheduled_at <= now()` og `status = pending`)
- Sender via eksisterende `send-recruitment-email` / `send-recruitment-sms`
- Opdaterer touchpoint-status
- Tjekker om kandidaten allerede er booket (status ændret til `interview_scheduled`) → stopper flowet

### Enrollment-flow

Når en ny kandidat oprettes eller manuelt tilføjes:
1. Segmenteringsmodal åbnes → tier beregnes
2. Alle touchpoints for det relevante tier-flow oprettes i `booking_flow_touchpoints` med korrekte `scheduled_at`-tider
3. Kandidatens status sættes til `i_flow`
4. Første touchpoint (dag 0) sendes med det samme

### Integration med eksisterende kandidat-flow

- Hvis kandidaten manuelt flyttes til `interview_scheduled` eller `hired` → flowet annulleres automatisk
- Hvis kandidaten markeres som `rejected` eller `ghostet` → flowet annulleres
- Booking flow-historik vises i kandidat-detail som en timeline

### Filer der oprettes/ændres

| Fil | Ændring |
|-----|---------|
| `src/pages/recruitment/BookingFlow.tsx` | **Ny** — hovedside med oversigt |
| `src/components/recruitment/SegmentationModal.tsx` | **Ny** — tier-beregning |
| `src/components/recruitment/BookingFlowTimeline.tsx` | **Ny** — touchpoint-timeline |
| `src/pages/recruitment/EmailTemplates.tsx` | Tilføj flow-skabeloner (dag 0-3 per tier) |
| `src/pages/recruitment/CandidateDetail.tsx` | Vis flow-status + timeline-tab |
| `src/routes/config.tsx` + `pages.ts` | Tilføj route |
| `supabase/functions/process-booking-flow/index.ts` | **Ny** — cron-processor |
| 4 migrationer | Tabeller + tier-kolonne + cron-job |

### Design
Clean, Premium SaaS-feel (Pipeline-stil): hvide overflader, subtle borders, generøs whitespace. Tier-badges: A = grøn (#1D9E75), B = lilla (#7F77DD), C = grå (#888780).

