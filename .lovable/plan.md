

## Fix dobbelt SMS + fejlagtig booking-bekræftelse

### Problemer identificeret

1. **`booking_confirmation_sms`** har `phase = 'active'` i databasen, så den medtages i touchpoint-oprettelsen og sendes som outreach — selvom den kun bør sendes ved faktisk booking. Merge-tags `{{dato}}` og `{{tidspunkt}}` er tomme fordi der ingen booking er.

2. **`flow_a_dag0_sms`** sendes umiddelbart af `auto-segment-candidate` (linje 391) OG oprettes som touchpoint (linje 318-338), som `process-booking-flow` derefter også sender. Resultat: to identiske SMS'er.

### Løsning

**1. Database: Flyt `booking_confirmation_sms` til phase `confirmation`**

Opdater `booking_confirmation_sms` i `booking_flow_steps`: sæt `phase = 'confirmation'`. Denne phase bruges aldrig af outreach-flowet.

**2. Edge function: Filtrer touchpoints på phase**

I `auto-segment-candidate/index.ts` (linje 306-310): tilføj `.in('phase', ['active', 'reengagement'])` til flowSteps-query, så `confirmation`-steps aldrig oprettes som touchpoints.

**3. Edge function: Skip dag 0 SMS i touchpoints**

I `auto-segment-candidate/index.ts`: filtrer `flow_a_dag0_sms` fra touchpoint-listen, da den allerede sendes umiddelbart. Dette forhindrer dobbelt-afsendelse.

### Filer der ændres

| Fil | Ændring |
|-----|---------|
| **Database** | `UPDATE booking_flow_steps SET phase = 'confirmation' WHERE template_key = 'booking_confirmation_sms'` |
| `supabase/functions/auto-segment-candidate/index.ts` | Filtrer flowSteps query + skip dag 0 SMS fra touchpoints |

### Resultat efter fix

- Kandidaten modtager præcis 1 SMS på dag 0 (den umiddelbare)
- Booking-bekræftelse sendes KUN når kandidaten faktisk booker en tid
- Alle øvrige touchpoints (dag 1, 3, 6, 10, 45, 120) fungerer uændret

