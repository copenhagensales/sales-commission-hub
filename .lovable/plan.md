

## Tæl tid fra godkendelse, ikke fra ansøgning

### Problemet

På `/recruitment/booking-flow`-listen viser hver kandidat fx "for 3 dage siden". Det tal er `enrolled_at`, som sættes da kandidaten blev oprettet i flow (typisk samtidig med ansøgning/segmentering). For Tier B/C-kandidater der venter i "pending approval" betyder det, at uret tikker mens de ligger i kø — ikke fra det øjeblik recruiter trykkede "Godkend" og flowet faktisk startede.

For Tier A (auto-approved) er `enrolled_at` = godkendelsestidspunktet, så for dem er der intet problem.

### Løsning

Tilføj `approved_at` (timestamp) til `booking_flow_enrollments` og brug den som visningstid i listen. Falder tilbage til `enrolled_at` for gamle rækker uden `approved_at`.

**1. DB-migration**
- Ny kolonne: `booking_flow_enrollments.approved_at timestamptz NULL`
- Backfill:
  - For eksisterende rækker hvor `approval_status = 'auto_approved'` → sæt `approved_at = enrolled_at` (ingen ventetid)
  - For eksisterende `approval_status = 'approved'` rækker → sæt `approved_at = updated_at` (bedste tilgængelige proxy for hvornår de blev godkendt)
  - Lad `pending_approval`-rækker have `approved_at = NULL` (de er ikke godkendt endnu)

**2. `src/pages/recruitment/BookingFlow.tsx`**
- I `approveMutation` (linje 216-222): tilføj `approved_at: new Date().toISOString()` til update-objektet, så fremtidige godkendelser registrerer tidspunktet
- I `auto-segment-candidate` edge function (linje ~289 hvor enrollment oprettes): når Tier A auto-approves, sæt `approved_at = now()` direkte i insert
- I listen (linje 530): erstat `enrollment.enrolled_at` med `enrollment.approved_at ?? enrollment.enrolled_at` så vi viser godkendelsestid når det findes, ellers fallback

**3. Pending approval-sektion (uændret visning)**
Pending approval-listen (linje 91-93) viser i forvejen kandidater der venter — for dem giver "tid siden ansøgning" stadig mening (det er ventetid for recruiter). Den ændrer jeg ikke.

### Hvad jeg IKKE rør
- `enrolled_at`-kolonnen (bevares som "oprettet i flow")
- Touchpoint-scheduling (køres fra `now()` ved godkendelse — allerede korrekt)
- KPI-bar, timeline-dialog, andre faner
- Logik for pending_approval-listen

### Verificering
- Godkend en pending kandidat → tiden i listen viser "for få sekunder siden", ikke "for X dage siden"
- Eksisterende auto-approved Tier A-kandidater viser uændret tid (backfill = enrolled_at)
- Eksisterende approved Tier B/C viser approximativt godkendelsestid (backfill = updated_at)

