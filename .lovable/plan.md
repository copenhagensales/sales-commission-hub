

## Adskil "Samtaler"-fanen i to: Booking samtaler + Planlagte jobsamtaler

### Mål
Den nuværende "Samtaler"-fane i Booking Flow (`/recruitment/booking-flow`) blander kandidater fra booking-flowet med planlagte jobsamtaler. Den splittes i to separate faner med tydelige formål.

### Ændring i `src/pages/recruitment/BookingFlow.tsx`

1. **Erstat** den nuværende `<TabsTrigger value="samtaler">` med to nye triggers:
   - `value="booking-samtaler"` — label: "Booking samtaler", ikon: `MessageSquare` (eller behold `PhoneCall`).
   - `value="planlagte-samtaler"` — label: "Planlagte jobsamtaler", ikon: `CalendarDays`.

2. **Erstat** den eksisterende `<TabsContent value="samtaler">` med to TabsContent-blokke:
   - `value="booking-samtaler"` → ny komponent `<BookingFlowConversationsTab />` der viser kandidater aktivt i booking-flowet (status: `contacted`, `booking_pending` eller aktive `booking_flow_enrollments`, men IKKE `interview_scheduled`).
   - `value="planlagte-samtaler"` → eksisterende `<BookingCalendarTab />` (uændret).

### Ny komponent `src/components/recruitment/BookingFlowConversationsTab.tsx`

- Henter kandidater via Supabase med aktive `booking_flow_enrollments` (`status="active"`) joinet med candidates — eksluderer kandidater hvis status er `interview_scheduled`, `hired`, `rejected`, `ghostet`, `takket_nej`.
- Viser liste/kort med:
  - Kandidatnavn + kontaktinfo.
  - Nuværende status badge (Ny / Kontaktet / I booking-flow).
  - Hvor langt i flowet (current_day / total dage) — fra `booking_flow_enrollments`.
  - Sidste touchpoint sendt + næste planlagte touchpoint (fra `booking_flow_touchpoints`).
  - Quick-actions: "Åbn kandidat" (åbner `CandidateDetailDialog`), "Annullér flow".
- Tom-state: "Ingen aktive booking-samtaler".
- Loading-state: spinner.

### Funktionel adskillelse
- **Booking samtaler** = kandidater under aktiv outreach (før de har booket tid).
- **Planlagte jobsamtaler** = kandidater der har en `interview_date` sat (kalender-visningen i `BookingCalendarTab`).

### Ikke berørt
- `BookingCalendarTab.tsx` (uændret — bare flyttet under ny tab-label).
- Sidebar-link "Kommende samtaler" → `/recruitment/upcoming-interviews` (uændret).
- Øvrige tabs (Dashboard, Flow-skabeloner, Booking-side, Preview, Notifikationer, Sider).
- Datamodel, RLS, edge functions.

### Filer berørt
- `src/pages/recruitment/BookingFlow.tsx` (tab-split)
- `src/components/recruitment/BookingFlowConversationsTab.tsx` (ny)

