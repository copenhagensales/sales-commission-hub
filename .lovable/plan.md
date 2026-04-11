

## Ny "Skabeloner"-fane + auto-stop ved svar + afmeldingslink

### 1. Ny fane: "Flow-skabeloner" på BookingFlow-siden

Tilføj en `Tabs`-komponent til `BookingFlow.tsx` med to faner:
- **Dashboard** (eksisterende indhold — stats, pending, enrollments)
- **Flow-skabeloner** (ny fane)

Skabelon-fanen viser alle beskeder grupperet per tier (A/B/C) og sorteret efter dag/tidspunkt. Hver besked viser: dag, kanal-ikon (email/sms/call), template_key, og den aktuelle tekst. Der er en "Rediger"-knap på hver, som åbner en dialog med subject + content-felter. Ved gem: upsert til `email_templates`-tabellen (som `process-booking-flow` allerede tjekker for custom overrides). Merge-tags `{{fornavn}}` og `{{rolle}}` vises som highlighted badges i editoren.

Data hentes fra `FLOW_TEMPLATES` i `process-booking-flow` (hardcoded defaults) + overrides fra `email_templates`-tabellen. Frontenden har en kopi af default-teksterne og viser dem som placeholder/fallback.

### 2. Auto-stop flow ved indgående SMS

Opdater `receive-sms` edge function: Når en indgående SMS modtages fra en kandidat, tjek om kandidaten har en aktiv `booking_flow_enrollment`. Hvis ja:
- Annuller alle pending touchpoints
- Opdater enrollment status til `paused` (nyt) eller `cancelled` med reason "Kandidat svarede på SMS"
- Log en note så recruiteren kan se det i dashboardet

### 3. Auto-stop flow ved kalender-booking

Allerede delvist implementeret: `process-booking-flow` tjekker `applications.status` for `interview_scheduled`. Bekræft at `useCalendarBooking.executePostBookingActions` sætter denne status korrekt — og at det dermed stopper flowet automatisk.

### 4. Afmeldingslink i SMS/email

Tilføj en ny edge function `unsubscribe-candidate` der:
- Modtager et token (candidate_id encoded)
- Annullerer alle aktive enrollments for kandidaten
- Opdater candidates.status til `trukket_ansøgning` (nyt status)
- Returnerer en simpel "Du er afmeldt"-HTML side

Tilføj merge-tag `{{afmeld_link}}` til alle SMS/email-templates. `process-booking-flow` erstatter den med URL til unsubscribe-funktionen.

### Database-ændringer

1. Migration: Tilføj `trukket_ansøgning` som mulig status på candidates (ingen schema-ændring — status er allerede text)
2. Ingen nye tabeller — bruger eksisterende `email_templates` til overrides

### Filer der oprettes/ændres

| Fil | Ændring |
|-----|---------|
| `src/pages/recruitment/BookingFlow.tsx` | Wrap i Tabs, tilføj "Flow-skabeloner" fane |
| `src/components/recruitment/FlowTemplatesTab.tsx` | **Ny** — viser og redigerer alle flow-beskeder per tier |
| `supabase/functions/receive-sms/index.ts` | Tilføj auto-stop logik ved indgående kandidat-SMS |
| `supabase/functions/unsubscribe-candidate/index.ts` | **Ny** — afmeldings-endpoint |
| `supabase/functions/process-booking-flow/index.ts` | Tilføj `{{afmeld_link}}` merge-tag |

