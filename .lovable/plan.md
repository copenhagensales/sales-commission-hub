

## Fix: Offentlig booking-side virker ikke (RLS-problem)

### Problem

Når en kandidat åbner booking-linket (`/book/:candidateId`), er de ikke logget ind. Siden forsøger at hente kandidat-data direkte fra `candidates`-tabellen via Supabase-klienten, men RLS-politikkerne kræver at man er autentificeret (rekrutterer/teamleder). Resultatet er at kandidaten ser "Kandidat ikke fundet".

### Løsning

Flyt kandidat- og ansøgnings-data ind i `get-public-availability` edge function (som allerede bruger service role key og dermed omgår RLS). Fjern de direkte klient-queries fra `PublicCandidateBooking.tsx`.

### Ændringer

**`supabase/functions/get-public-availability/index.ts`**
- Udvid response til også at returnere `candidate` (navn, email, phone) og `application` (rolle, status) sammen med `days`
- Data hentes allerede med service role key, så det virker uden login

**`src/pages/recruitment/PublicCandidateBooking.tsx`**
- Fjern de to separate `useQuery`-kald til `candidates` og `applications` tabeller
- Brug i stedet data fra det eksisterende `availability`-query (som nu returnerer `{ days, candidate, application }`)
- Fjern `candidateLoading` og brug kun `availLoading`

### Filer

| Fil | Ændring |
|-----|---------|
| `supabase/functions/get-public-availability/index.ts` | Tilføj candidate + application data i response |
| `src/pages/recruitment/PublicCandidateBooking.tsx` | Brug data fra edge function i stedet for direkte DB-queries |

