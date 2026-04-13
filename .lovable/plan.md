

## Notifikationer-fane i Booking Flow

### Idé
En ny fane "Notifikationer" i Booking Flow, hvor man kan tilføje/fjerne email-modtagere der får besked når en kandidat booker eller afmelder en samtale. Erstatter den hardcodede `oscar@copenhagensales.dk`.

### Database
Ny tabel `booking_notification_recipients`:
```sql
CREATE TABLE booking_notification_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  name text,
  notify_on_booking boolean DEFAULT true,
  notify_on_cancel boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
```
RLS: authenticated users kan SELECT, INSERT, DELETE.

Seed med `oscar@copenhagensales.dk` så eksisterende setup bevares.

### UI: `BookingNotificationsTab.tsx`
- Liste over modtagere med navn, email, toggles for booking/afmelding
- Tilføj-formular med navn + email
- Slet-knap per modtager
- Mønster fra `ComplianceNotifications.tsx`

### Backend-ændringer

**`public-book-candidate/index.ts`**:
- Erstat hardcodet `oscar@copenhagensales.dk` med opslag i `booking_notification_recipients` (hvor `notify_on_booking = true`)
- Send til alle modtagere via Resend

**`unsubscribe-candidate/index.ts`**:
- Tilføj email-notifikation til modtagere med `notify_on_cancel = true` når en kandidat afmelder

### Fane i BookingFlow.tsx
- Tilføj `TabsTrigger value="notifications"` med `Bell`-ikon og label "Notifikationer"
- Tilføj `TabsContent` med `<BookingNotificationsTab />`

### Filer
1. Migration — ny tabel + seed
2. `src/components/recruitment/BookingNotificationsTab.tsx` — ny komponent
3. `src/pages/recruitment/BookingFlow.tsx` — tilføj fane
4. `supabase/functions/public-book-candidate/index.ts` — dynamiske modtagere
5. `supabase/functions/unsubscribe-candidate/index.ts` — afmeldings-notifikation

