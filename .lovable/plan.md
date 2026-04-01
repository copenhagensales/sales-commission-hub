

## Send notifikation til indrapportør når status ændres

### Problem
Når en admin markerer en system-indrapportering som "løst" eller ændrer status, får den medarbejder der oprettede den ingen besked. De skal selv tjekke siden manuelt.

### Løsning
Opret en ny edge function `notify-feedback-status-change` der sender en email til indrapportørens email, når status opdateres. Kald den fra `updateMutation.onSuccess` i `SystemFeedback.tsx`.

### Ændringer

**1. Ny edge function: `supabase/functions/notify-feedback-status-change/index.ts`**
- Modtager: `feedbackTitle`, `newStatus`, `adminNotes`, `employeeEmail`, `employeeName`
- Sender en formateret HTML-email via M365 (samme mønster som `notify-system-feedback`)
- Modtager er den medarbejder der oprettede indrapporteringen (via `work_email` eller `private_email` fra `employee_master_data`)
- Emailen indeholder: titel på indrapporteringen, ny status (oversat til dansk), eventuelle admin-noter

**2. Opdater `src/pages/SystemFeedback.tsx`**
- I `updateMutation`: hent indrapportørens email fra feedback-data + employee_master_data
- I `onSuccess`: kald `supabase.functions.invoke("notify-feedback-status-change", { body: { ... } })` fire-and-forget
- Oversæt statusværdier til dansk i emailen (open → Åben, in_progress → Under behandling, resolved → Løst, closed → Lukket)

**3. Opdater `supabase/config.toml`**
- Tilføj `[functions.notify-feedback-status-change]` med `verify_jwt = false`

### Email-indhold (eksempel)
- **Emne:** "Din indrapportering er blevet opdateret"
- **Indhold:** "Status på '{titel}' er ændret til: Løst" + eventuelle admin-noter

