

## Send booking-notifikation til oscar@copenhagensales.dk

### Ændring
Opdater `supabase/functions/public-book-candidate/index.ts` til at sende en email med `.ics` kalenderinvitation til `oscar@copenhagensales.dk` hver gang en kandidat booker en tid. Ingen secret nødvendig — emailen hardcodes direkte.

### Hvad tilføjes (efter eksisterende Outlook-event blok)

1. **Generer ICS-kalenderstreng** med `VEVENT` (dato, tid, kandidatnavn, rolle, telefon, timezone Europe/Copenhagen)
2. **Send email via Graph API** (`/users/${msUserEmail}/sendMail`) med:
   - Modtager: `oscar@copenhagensales.dk`
   - Emne: `Ny booking: [kandidatnavn] — [dato] kl. [tid]`
   - HTML body med kandidatinfo
   - `.ics` fil som base64 `fileAttachment`
3. **Fejlhåndtering**: Logges men stopper ikke resten af flowet

### Fil
- `supabase/functions/public-book-candidate/index.ts`

