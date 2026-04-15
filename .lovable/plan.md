

# Tilføj stillingsvælger til anbefalingsformularen

## Problem
Når nogen anbefales via det offentlige henvisningslink, bliver der ikke registreret hvilken stilling de søger. Denne information mangler derfor også når de konverteres til kandidat og videre til personale.

## Løsning
Tilføj et `applied_position` felt hele vejen gennem flowet: offentlig formular → edge function → `employee_referrals` tabel → kandidat-konvertering.

## Ændringer

### 1. Database: Tilføj kolonne til `employee_referrals`
Migration der tilføjer `applied_position TEXT` til `employee_referrals`.

### 2. Edge function: `submit-referral/index.ts`
- Tilføj `applied_position?: string` til `ReferralRequest` interface
- Inkludér feltet i INSERT

### 3. Offentlig formular: `PublicReferralForm.tsx`
- Tilføj `appliedPosition` til `FormData` interface
- Tilføj en Select dropdown med stillingerne: Salgskonsulent, Fieldmarketing, Teamleder, Backoffice (samme som `NewCandidateDialog`)
- Send `applied_position` med i `submitReferral.mutateAsync()`

### 4. Hook: `useReferrals.ts`
- Tilføj `applied_position` til `useSubmitReferral` mutation data og body
- Tilføj `applied_position` til `Referral` interface
- I `useConvertReferralToCandidate`: sæt `applied_position` fra referral ved kandidat-oprettelse

### 5. Notifikation: `notify-referral-received/index.ts`
- Inkludér `appliedPosition` i email-body så rekruttering kan se det

## Berørte filer
- `supabase/functions/submit-referral/index.ts`
- `supabase/functions/notify-referral-received/index.ts`
- `src/pages/PublicReferralForm.tsx`
- `src/hooks/useReferrals.ts`
- 1 migration (ny kolonne)

