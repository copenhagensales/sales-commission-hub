

## Flyt booking-bekræftelses-SMS til flow-skabeloner

### Problem
Når en kandidat booker en tid via den offentlige bookingside, sendes en bekræftelses-SMS med hardkodet tekst i `public-book-candidate` edge function. Denne besked kan ikke redigeres via Skabeloner-fanen.

### Løsning

**1. Tilføj bekræftelsesskabelon i databasen**

Indsæt ny `booking_flow_steps`-post:
- `template_key`: `booking_confirmation_sms`
- `day`: 0, `channel`: sms, `phase`: confirmation
- `subject`: `Booking bekræftelse`
- `content`: `Hej {{fornavn}}! Din samtale er booket til {{dato}} kl. {{tidspunkt}}. Vi ringer dig op. Glæder os! 📞 — Copenhagen Sales`

**2. Opdater `public-book-candidate` edge function**

Erstat hardkodet SMS (linje 170) med opslag i `booking_flow_steps` via `template_key = 'booking_confirmation_sms'`. Erstat merge-tags `{{fornavn}}`, `{{dato}}`, `{{tidspunkt}}`.

**3. Tilføj `{{dato}}` og `{{tidspunkt}}` som merge-tags i UI**

Opdater `FlowTemplatesTab.tsx` så de nye tags vises i dokumentationen.

### Filer der ændres

| Fil | Ændring |
|-----|---------|
| **Database insert** | Tilføj `booking_confirmation_sms` til `booking_flow_steps` |
| `supabase/functions/public-book-candidate/index.ts` | Læs bekræftelses-SMS fra DB, merge tags |
| `src/components/recruitment/FlowTemplatesTab.tsx` | Tilføj `{{dato}}` og `{{tidspunkt}}` til merge-tag liste |

