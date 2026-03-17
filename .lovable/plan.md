

## Problem

Når en ansat medarbejder (som blev henvist via referral-programmet) deaktiveres inden 60 dages ansættelse, sker der **ingenting** med den tilhørende referral. Deaktiverings-triggeren (`remove_deactivated_employee_from_teams`) håndterer teams, kontrakter og league — men rører ikke `employee_referrals`.

Det betyder:
- Referral-status forbliver "Ansat" eller "Bonus klar"
- Henviseren kan fejlagtigt få udbetalt bonus
- Der er ingen automatisk registrering af at den ansatte stoppede for tidligt

## Plan

### 1. Udvid deaktiverings-triggeren

Tilføj logik i `remove_deactivated_employee_from_teams()` der:
- Finder referrals hvor `converted_to_candidate_id` matcher den deaktiverede medarbejder (via candidates-tabellen) ELLER via direkte email-match
- Tjekker om `hired_date` er sat og om ansættelsen var under 60 dage (`CURRENT_DATE - hired_date < 60`)
- Sætter status til `'rejected'` med en note om at medarbejderen stoppede før 60 dage

### 2. Tilføj link mellem referral og medarbejder

Pt. er koblingen svag (via `converted_to_candidate_id` → candidates → email match). For at gøre det robust:
- Tilføj kolonne `hired_employee_id UUID REFERENCES employee_master_data(id)` på `employee_referrals`
- Udfyld denne når status sættes til "Ansat" i UI'et
- Brug denne i triggeren til direkte lookup

### 3. Opdater UI til at sætte `hired_employee_id`

I `useUpdateReferralStatus` og hiring-dialogen: når status ændres til `'hired'`, skal brugeren kunne vælge/matche den faktiske medarbejder, så `hired_employee_id` gemmes.

### 4. Trigger-logik (pseudokode)

```sql
-- Inside remove_deactivated_employee_from_teams(), after existing logic:
UPDATE public.employee_referrals
SET status = 'rejected',
    notes = COALESCE(notes, '') || E'\nAutomatisk afvist: Medarbejder stoppede før 60 dages ansættelse.'
WHERE hired_employee_id = NEW.id
  AND status IN ('hired', 'eligible_for_bonus')
  AND hired_date IS NOT NULL
  AND (CURRENT_DATE - hired_date::date) < 60;
```

### Tekniske detaljer

- **Migration**: Tilføj `hired_employee_id` kolonne + udvid trigger-funktionen
- **Frontend**: Opdater hiring-flow til at linke medarbejder-ID
- **Eksisterende data**: Kan manuelt linkes eller efterlades som NULL (triggeren virker kun fremadrettet)

