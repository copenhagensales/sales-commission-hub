

## Kandidat-booking: selvbetjeningsside + dynamisk første besked

### Overblik

Kandidater skal i den første SMS og email kunne se:
1. **Hvornår vi ringer dem** (baseret på ansøgningstidspunkt: før kl. 14 → vi ringer i dag kl. 15–16:15, efter kl. 14 → vi ringer i morgen kl. 11–12)
2. **Hvilket nummer vi ringer fra**
3. **Et link til selv at booke en tid** hvis det ikke passer
4. **Et link til at afmelde sig helt**

Derudover oprettes en offentlig booking-side (inspireret af dit billede) hvor kandidaten kan vælge en ledig tid i en kalender.

---

### 1. Ny public booking-side: `/book/:candidateId`

En ny side `src/pages/recruitment/PublicCandidateBooking.tsx` — ingen login krævet.

Visuelt baseret på dit billede:
- Kandidatens navn, rolle og tier-badge i toppen
- Kalender med måneds-visning (Ma–Sø), weekender nedtonet
- "LEDIGE TIDER" sektion med tidspunkter som pills
- Info-boks i bunden: "Mødet oprettes direkte i Outlook — ingen dobbeltbooking", "Kandidaten får automatisk bekræftelse via SMS + email", "Kandidaten rykkes til Booked i Pipeline"
- "Vælg et tidspunkt" + "Book møde" knap

**Data-flow:** Siden henter ledige tider via en ny edge function `get-public-availability` (ingen auth krævet) som gør free/busy lookup via Microsoft Graph med service credentials. Ved booking kalder den en ny edge function `public-book-candidate` som opretter Outlook-event, sender bekræftelses-SMS, opdaterer status til `interview_scheduled`, og stopper det aktive flow.

### 2. Ny edge function: `get-public-availability`

- Modtager `candidateId` som query param
- Slår recruiter-email op (fra konfiguration eller en `recruitment_settings`-tabel)
- Bruger M365 client credentials til at lave free/busy lookup på recruiterens kalender
- Returnerer ledige 30-min slots for de næste 14 hverdage (kl. 8–17)
- Ingen auth krævet — men validerer at candidateId eksisterer og har aktivt flow

### 3. Ny edge function: `public-book-candidate`

- Modtager `{ candidateId, date, startTime, endTime }`
- Opretter Outlook-event via M365 Graph (client credentials)
- Sender bekræftelses-SMS til kandidaten
- Opdaterer `applications.status` → `interview_scheduled`
- Annullerer alle pending booking_flow_touchpoints + enrollment
- Returnerer success/error

### 4. Dynamisk første besked med ringetidspunkt

Opdater `auto-segment-candidate/index.ts`:
- Ved Tier A SMS (linje 332): Beregn ringetidspunkt baseret på `new Date()`:
  - Hvis time < 14 (dansk tid) → "Vi ringer dig i dag mellem kl. 15:00 og 16:15"
  - Hvis time >= 14 → "Vi ringer dig i morgen mellem kl. 11:00 og 12:00"
- Inkludér telefonnummer: "Vi ringer fra +45 XX XX XX XX" (hentes fra env var `RECRUITMENT_PHONE_NUMBER` eller hardcodes)
- Inkludér booking-link: `{{booking_link}}`
- Inkludér afmeldings-link: `{{afmeld_link}}`

Ny SMS-tekst eksempel:
> "Hej {{fornavn}}, tak for din ansøgning til {{rolle}}! Vi ringer dig i dag mellem kl. 15:00–16:15 fra +45 XX XX XX XX. Passer det ikke? Book selv en tid her: {{booking_link}} — eller afmeld dig her: {{afmeld_link}}"

Opdater også `flow_a_dag0_email` og `flow_a_dag0_sms` i `process-booking-flow` med nye merge-tags `{{booking_link}}` og `{{ringetidspunkt}}`.

### 5. Nye merge-tags i process-booking-flow

Tilføj til merge-tag replacement (linje 170–177):
- `{{booking_link}}` → `https://provision.copenhagensales.dk/book/{candidateId}`
- `{{ringetidspunkt}}` → beregnet dynamisk baseret på touchpoint scheduled_at
- `{{telefonnummer}}` → rekrutteringsnummeret

### 6. Opdater default templates

Opdater `FLOW_TEMPLATES` i både `FlowTemplatesTab.tsx` og `process-booking-flow/index.ts`:
- `flow_a_dag0_email`: Tilføj ringetidspunkt, telefonnummer, booking-link, og afmeldings-link
- `flow_a_dag0_sms`: Samme info i kort format
- `flow_a_dag1_followup_sms`: Tilføj booking-link ("Book selv en ny tid her: {{booking_link}}")

### 7. Route registrering

Tilføj i `src/routes/config.tsx`:
```
{ path: "/book/:candidateId", component: PublicCandidateBooking, access: "public" }
```

### Filer der oprettes/ændres

| Fil | Ændring |
|-----|---------|
| `src/pages/recruitment/PublicCandidateBooking.tsx` | **Ny** — offentlig booking-side |
| `src/routes/config.tsx` | Tilføj public route |
| `src/routes/pages.ts` | Lazy import |
| `supabase/functions/get-public-availability/index.ts` | **Ny** — hent ledige tider |
| `supabase/functions/public-book-candidate/index.ts` | **Ny** — opret booking |
| `supabase/functions/auto-segment-candidate/index.ts` | Dynamisk ringetidspunkt i første SMS |
| `supabase/functions/process-booking-flow/index.ts` | Nye merge-tags |
| `src/components/recruitment/FlowTemplatesTab.tsx` | Opdater default-tekster + nye merge-tag badges |

### Forbedringer og idéer

1. **Bekræftelses-side efter booking**: Vis en pæn "Du er booket!" side med dato/tid + "Tilføj til kalender" (.ics download)
2. **SMS-påmindelse 1 time før**: Automatisk SMS "Vi ringer dig om 1 time — sørg for at være tilgængelig"
3. **Omlæg-link i bekræftelse**: Kandidaten kan ændre tiden selv via booking-linket (viser "Du har allerede en tid kl. X — vil du omlægge?")
4. **Recruiter-notifikation**: Push-notifikation/email til rekruttereren når en kandidat selv booker en tid
5. **Smart ringetidspunkt**: Hvis ansøgningen modtages i weekenden, sæt ringetidspunkt til mandag kl. 11–12

