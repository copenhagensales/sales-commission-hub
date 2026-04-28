## Problemet

I dag er der **kun ét felt** på `candidates`: `status='interview_scheduled'` + `interview_date`. Det bruges til to forskellige ting:

1. **Booking** — kandidat selvbooker en tid via den offentlige booking-side (`public-book-candidate`). Det er bare en aftalt opkaldstid — ikke nødvendigvis en jobsamtale.
2. **Jobsamtale** — intern booker manuelt via `CandidateDetail` ("Planlæg samtale") fordi I reelt vil holde en jobsamtale.

Begge ender i `status='interview_scheduled'` og dukker op samme sted ("Planlagte jobsamtaler", "Kommende samtaler"). Derfor ser alle public bookings ud som om det er jobsamtaler.

## Løsning — to spor i datamodel + UI

### Datamodel

Tilføj to nye felter til `candidates`:

- `booking_type` enum: `'phone_screening'` (default for public booking) | `'job_interview'` (intern beslutning)
- Behold `interview_date` som tidspunktet, men omdøb begrebsligt til "booket tid"

Migration:
- Tilføj enum `candidate_booking_type`
- Tilføj kolonne `candidates.booking_type candidate_booking_type` (nullable, default null)
- Backfill: alle eksisterende `interview_scheduled` der kommer fra `public-book-candidate` → `'phone_screening'`. Dem der er sat manuelt fra `CandidateDetail` → `'job_interview'`. Vi kan ikke skelne historisk, så **alle eksisterende sættes til `phone_screening`** (det er det hyppigste) og I kan opgradere relevante manuelt.

### Edge functions

- `public-book-candidate`: sætter `booking_type='phone_screening'` ved oprettelse
- Ny intern action i `CandidateDetail` ("Planlæg jobsamtale"): sætter `booking_type='job_interview'`

### UI-ændringer

**1. `BookingFlow.tsx` — fanen "Planlagte jobsamtaler"**
- Filtrer kun `booking_type='job_interview'` (ikke alle `interview_scheduled`)
- Tilføj separat fane: **"Bookede opkald"** der viser `booking_type='phone_screening'` (det er det Simon, Hugo m.fl. selvbooker)

**2. `BookingCalendarTab.tsx` (det er det du ser på screenshottet)**
- Vis to visuelt adskilte spor: blå prik = booket opkald, grøn prik = jobsamtale
- Header per dag: "X bookede opkald · Y jobsamtaler"
- Knap "Konvertér til jobsamtale" på et booket opkald (hvis screening gik godt)

**3. `UpcomingInterviews.tsx` ("Kommende samtaler" i sidebar)**
- Skift til kun at vise `booking_type='job_interview'`
- Omdøb evt. til "Kommende jobsamtaler"

**4. `Candidates.tsx` filter**
- Status-filter "Samtale planlagt" splittes til to: "Booket opkald" og "Jobsamtale planlagt"

**5. `CandidateDetail.tsx`**
- Vis tydeligt hvilken type booking kandidaten har
- To knapper: "Planlæg opkald" vs "Planlæg jobsamtale"

### Begrebsafklaring i sproget

Konsekvent terminologi gennem appen:
- **Booket opkald / screening** = kandidat selvbooker via offentlig side
- **Jobsamtale** = intern beslutning, manuelt planlagt af jer

## Tekniske detaljer

**Filer der ændres:**
- Migration: ny enum + kolonne + backfill
- `supabase/functions/public-book-candidate/index.ts` (sætter `phone_screening`)
- `src/pages/recruitment/BookingFlow.tsx` (ny fane + filtrering)
- `src/components/recruitment/BookingCalendarTab.tsx` (to spor visuelt)
- `src/pages/recruitment/UpcomingInterviews.tsx` (filter + label)
- `src/pages/recruitment/CandidateDetail.tsx` (to actions)
- `src/pages/recruitment/Candidates.tsx` (status-filter split)

**Zone:** Gul (rekruttering/booking_flow). Ingen rød zone berøres.

**Ingen breaking changes:** `status='interview_scheduled'` består — vi tilføjer kun en dimension oveni.

## Spørgsmål før jeg implementerer

1. **Backfill-strategi:** Sætter vi alle eksisterende `interview_scheduled` til `'phone_screening'` (default), eller `'job_interview'` (det "gamle" begreb)? Mit forslag: `phone_screening`, fordi det er det Simon/Hugo-flow rammer flest.
2. **Skal "Planlagte jobsamtaler"-fanen i BookingFlow forsvinde helt** og flyttes til sidebar-punktet "Kommende samtaler" (så det er ét sted) — eller beholde begge?
