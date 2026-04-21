

## Hvorfor "Dag 0 · 4 dage siden" for Sebastian?

### Hvad de to tal betyder lige nu

På listen vises pr. kandidat to forskellige tidsmål side om side:

- **"Dag X"** = `enrollment.current_day` — hvor langt i flow-skemaet kandidaten er nået. Den tæller op hver gang `process-booking-flow`-cron'en (kører hvert 5. min) sender en touchpoint og skubber `current_day` videre.
- **"X dage siden"** = `formatDistanceToNow(approved_at ?? enrolled_at)` — hvor lang tid siden kandidaten blev godkendt (efter sidste ændring vi lavede).

### Hvorfor de er ude af sync for Sebastian

"Dag 0" + "4 dage siden" betyder at Sebastian blev godkendt for 4 dage siden, men ingen touchpoint er afsendt endnu — derfor er `current_day` stadig 0. Mulige årsager:

1. **Hans flow har Dag 0 som første touchpoint, men det er aldrig blevet sendt** — fejlet (status `failed`), springet over (`skipped`), eller cron'en har ikke kunnet sende (manglende email/telefon, template uden indhold, edge function-fejl).
2. **Flow-templaten har slet ingen Dag 0-touchpoint** — første touchpoint ligger fx Dag 5, så `current_day` rykker først når den dag rammes.
3. **Timeline-dialogen viste "Ingen touchpoints fundet"** (ses i din session) → der er overhovedet ikke planlagt touchpoints for hans enrollment. Det er anomalien — enrollment blev oprettet, men `booking_flow_touchpoints`-rækker blev aldrig genereret (typisk en bug i `auto-segment-candidate` eller approval-flow hvis template-id mangler).

Den tredje er sandsynligvis hvad der sker her: enrollment eksisterer, klokken tikker (4 dage), men der er nul touchpoints → flowet kører reelt ikke.

### Plan for at fikse det

**1. Diagnose først (hurtig DB-check)**
Tjek for Sebastians enrollment:
- `booking_flow_touchpoints` count for hans `enrollment_id` → er det 0?
- Hvilken `flow_template_id` peger enrollment på, og har den `booking_flow_steps`?
- Er der noget i `integration_logs` / edge function-logs omkring godkendelses-tidspunktet?

**2. Fix touchpoint-generering ved approval**
I `BookingFlow.tsx` `approveMutation` og i `auto-segment-candidate` edge function: efter `approved_at` sættes, skal touchpoints genereres fra `booking_flow_steps` (hvis de mangler). Tilføj sikkerhedsnet:
- Efter approval/auto-approval: query antal touchpoints for enrollment
- Hvis 0 → kald en ny shared helper `generateTouchpointsForEnrollment(enrollment_id)` som læser steps fra template og inserter scheduled rækker fra `approved_at + step.day`
- Hvis steps-array er tomt → log warning og marker enrollment som `failed` med en cancelled_reason så listen ikke bare står og tikker

**3. UI: vis tydeligt når flow er "tomt"**
I listen tilføj en lille rød indikator hvis `enrollment.status === 'active'` og enrollment har 0 touchpoints (eller `current_day === 0` og `approved_at` er > 1 dag gammel). Tekst: "⚠️ Ingen touchpoints planlagt".

**4. Backfill for eksisterende stuck enrollments**
Engangs-migration eller knap i UI ("Regenerér touchpoints") for aktive enrollments uden touchpoints, så Sebastian + andre stuck kandidater faktisk kommer i gang.

### Hvad jeg IKKE rør
- Selve `process-booking-flow`-cron'en (den er fin — der er bare ikke noget at sende)
- Template-systemet og steps-redigering
- Approval/cancellation-logik i øvrigt

### Verificering
- Sebastians enrollment får genereret touchpoints, første sendes inden for 5 min, "Dag 0" rykker til "Dag X" når næste touchpoint sendes
- Nye approvals genererer altid touchpoints (eller fejler højt med cancelled_reason)
- Stuck enrollments markeres synligt i UI

