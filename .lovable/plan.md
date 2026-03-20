

# Duplikat-håndtering: Genkend tilbagevendende ansøgere

## Hvad bygges
Når en ansøgning kommer ind via webhook med en email der allerede findes i `candidates`-tabellen, skal den **ikke** oprette en ny kandidat. I stedet:
1. Den eksisterende kandidat opdateres: status sættes til `new`, noter tilføjes med "Har søgt igen", og `applied_position` opdateres hvis ændret
2. En ny kolonne `application_count` tracker antal ansøgninger
3. Et `is_returning_applicant`-flag sættes til `true`
4. CandidateCard viser en tydelig badge: **"HAR SØGT FØR"**

## Database-ændring
Tilføj to kolonner til `candidates`:
- `application_count` (integer, default 1) — antal gange personen har søgt
- `is_returning_applicant` (boolean, default false) — flag for genganger

## Webhook-ændring (`supabase/functions/zapier-webhook/index.ts`)
Før insert: check om email allerede findes i `candidates`-tabellen.
- **Hvis ja**: Opdater eksisterende kandidat:
  - `status` → `'new'` (så den dukker op som ny ansøgning igen)
  - `application_count` → increment med 1
  - `is_returning_applicant` → `true`
  - `applied_position` → opdater til ny rolle hvis ændret
  - `notes` → prepend "Søgte igen [dato] som [rolle]. Tidligere noter: ..."
  - `updated_at` → `now()`
  - `fbclid` → opdater hvis ny fbclid
- **Hvis nej**: Insert som normalt med `application_count: 1`

## UI-ændring (`CandidateCard.tsx`)
Vis en tydelig orange/amber badge **"HAR SØGT FØR (×2)"** ved siden af "NY ANSØGNING"-badgen, når `is_returning_applicant` er `true`. Badgen viser `application_count` så rekruttering kan se hvor mange gange personen har søgt.

## Filer der ændres
1. **Database migration** — tilføj `application_count` og `is_returning_applicant` kolonner
2. **`supabase/functions/zapier-webhook/index.ts`** — duplikat-check på email, upsert-logik
3. **`src/components/recruitment/CandidateCard.tsx`** — vis "Har søgt før"-badge

