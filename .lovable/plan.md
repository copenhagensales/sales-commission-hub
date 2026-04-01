

## Tilføj oversigt over planlagte emails med mulighed for annullering

### Baggrund
Brugeren har indrapporteret at der mangler en funktion til at se og annullere planlagte emails. Når man planlægger en email til afsendelse på en bestemt dato, er der ingen måde at se eller annullere den efterfølgende.

### Løsning
Tilføj en ny sektion i rekrutteringsområdet (eller i CandidateDetailDialog) der viser alle ventende planlagte emails med mulighed for at annullere dem.

### Ændringer

**1. Ny komponent: `src/components/recruitment/ScheduledEmailsList.tsx`**
- Henter alle `scheduled_emails` med `status = 'pending'` fra databasen
- Viser en liste med: modtager, emne, planlagt tidspunkt, og en "Annuller"-knap
- Annullering opdaterer `status` til `'cancelled'` i databasen
- Sorteret efter planlagt dato (nærmeste først)
- Viser tom-tilstand hvis ingen ventende emails

**2. Opdater `src/components/recruitment/CandidateDetailDialog.tsx`**
- Tilføj en sektion eller fane der viser planlagte emails for den specifikke kandidat
- Filtrer på `candidate_id` så kun relevante emails vises
- Inkluder annulleringsknap per email

**3. Tilføj også en global oversigt**
- Tilføj `ScheduledEmailsList` et sted i rekrutterings-flowet (f.eks. som en fane eller sektion på rekrutteringssiden) så man kan se ALLE ventende planlagte emails på tværs af kandidater

### Tekniske detaljer
- `scheduled_emails`-tabellen har allerede `status`-kolonne — annullering sætter den til `'cancelled'`
- RLS-policies tillader allerede teamledere og rekruttering at administrere planlagte emails
- Ingen databaseændringer nødvendige

