

# Fix: Afmelding returnerer rå HTML i stedet for at virke

## Problem
Edge-funktionen `unsubscribe-candidate` er designet til GET-requests med `?id=...` og returnerer HTML. Men frontend'en kalder den via `supabase.functions.invoke()` som sender en POST med JSON body `{ candidateId }`. Funktionen læser `url.searchParams.get('id')` som er `null` fra POST-kaldet, og returnerer fejl-HTML som frontend'en ikke kan bruge.

## Løsning
Opdater edge-funktionen til at håndtere begge kald-typer:
1. **GET med `?id=`** → returner HTML (til direkte link-klik fra SMS/email)
2. **POST med JSON body** → udfør afmelding og returner JSON (til frontend-kald)

## Tekniske ændringer

### Fil: `supabase/functions/unsubscribe-candidate/index.ts`
- Tjek `req.method`:
  - Hvis **GET**: behold nuværende logik (læs `id` fra query params, returner HTML)
  - Hvis **POST**: læs `candidateId` fra JSON body, kør samme afmeldingslogik, returner `{ success: true }` som JSON
- Flyt den fælles afmeldingslogik (cancel enrollments, update application, send emails) til en shared funktion

### Fil: `src/pages/recruitment/PublicCandidateBooking.tsx`
- Ingen ændring nødvendig — frontend sender allerede `{ candidateId }` korrekt, den mangler bare et JSON-svar

Én fil ændres: edge-funktionen.

