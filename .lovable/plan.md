

## Problem: "Nej tak" viser fejl og popup'en forsvinder ikke

### Root Cause

Knappen virker faktisk — deltagerstatus (`not_attending`) **bliver** gemt korrekt i `event_attendees`. Men umiddelbart efter fejler `markSeenMutation`, som forsøger at indsætte i `event_invitation_views`.

**Årsagen**: `event_invitation_views.employee_id` har en foreign key til `employee`-tabellen, men brugeren (William Krogh Bornak, ID: `89e43ed9`) eksisterer kun i `employee_master_data` — IKKE i `employee`-tabellen. Dermed fejler FK-constraint, og popup'en vises igen og igen fordi "set" aldrig registreres.

`event_attendees` derimod refererer til `employee_master_data`, og derfor virker selve svar-registreringen fint.

### Fix

**Database migration**: Ændre foreign key på `event_invitation_views.employee_id` fra `employee(id)` til `employee_master_data(id)`:

```sql
ALTER TABLE public.event_invitation_views
  DROP CONSTRAINT event_invitation_views_employee_id_fkey;

ALTER TABLE public.event_invitation_views
  ADD CONSTRAINT event_invitation_views_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES public.employee_master_data(id) ON DELETE CASCADE;
```

### Effekt
- Popup'en vil korrekt registrere at brugeren har set invitationen
- Fejltoast forsvinder
- Alle medarbejdere i `employee_master_data` (som er den primære medarbejdertabel) kan nu bruge funktionen korrekt
- Ingen kodeændringer nødvendige — kun database-fix

