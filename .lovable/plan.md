

## Send booking-notifikation med kalenderinvitation til rekrutteringsansvarlig

### Idé
Når en kandidat booker en tid, sender systemet en email til rekrutteringsansvarlig med en `.ics` kalenderinvitation som vedhæftet fil. Modtageren klikker "Accepter" i sin mailklient, og mødet ryger ind i deres personlige kalender — uanset om det er Outlook, Gmail eller andet.

### Fil: `supabase/functions/public-book-candidate/index.ts`

1. **Tilføj ny env-variabel `RECRUITER_NOTIFY_EMAIL`** — den email der skal modtage notifikationen. Kan være en anden end `MS_USER_EMAIL`.

2. **Generer en ICS-kalenderstreng** efter booking er oprettet:
   - Standard iCalendar format med `VEVENT` blok
   - Inkluderer dato, tid, kandidatnavn, rolle, telefon
   - Timezone: Europe/Copenhagen

3. **Send email via Graph API** (genbruger det eksisterende token) med:
   - Modtager: `RECRUITER_NOTIFY_EMAIL`
   - Emne: "Ny booking: [kandidatnavn] — [dato] kl. [tid]"
   - Body: Kort oversigt med kandidatinfo
   - Vedhæftet `.ics` fil som base64 attachment via Graph API

4. **Fallback**: Hvis `RECRUITER_NOTIFY_EMAIL` ikke er sat, springes notifikationen over (ingen breaking change)

### Teknisk detalje

Graph API understøtter attachments direkte i `/sendMail`:
```
POST /users/{msUserEmail}/sendMail
{
  message: {
    subject: "Ny booking: ...",
    toRecipients: [{ emailAddress: { address: recruiterNotifyEmail } }],
    body: { contentType: "HTML", content: "..." },
    attachments: [{
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: "interview.ics",
      contentType: "text/calendar",
      contentBytes: base64EncodedIcs
    }]
  }
}
```

### Ny secret
- `RECRUITER_NOTIFY_EMAIL` — e-mailadressen der skal modtage booking-notifikationer

### Ingen andre filer ændres
Alt sker i `public-book-candidate/index.ts` som et ekstra trin efter den eksisterende Outlook-event oprettelse.

