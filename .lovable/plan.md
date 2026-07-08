## Diagnose

Carl (`employee_master_data.id = a62fb220…`, `auth_user_id = 581875a3…`) har:
- `is_active = false` ❌
- `team_id` sat til Eesy TM, men ingen `team_members`-række
- Ingen `candidates`-record — oprettet manuelt direkte som employee EFTER "Start hold og send invitationer"

**Hvorfor blank skærm:** `usePositionPermissions` og `useAuth` slår employee op med `.eq("is_active", true)`. Da is_active=false returneres ingen employee → tomme permissions, ingen `default_landing_page`, ingen menu → blank skærm. Loginnet lykkes (auth-logs viser 200), men appen har intet at rendere.

Din mistanke er korrekt: efter-tilføjede deltagere kører ikke det aktiverings-/team-flow som cohort-starten gør.

## Ændringer

### 1. Straks-fix for Carl (data)

```sql
UPDATE employee_master_data
SET is_active = true, invitation_status = 'accepted'
WHERE id = 'a62fb220-0062-4910-bc95-4af4983c310c';

INSERT INTO team_members (team_id, employee_id)
VALUES ('0cb1b854-e7b5-4f49-8fdf-30e54e7d2f95', 'a62fb220-0062-4910-bc95-4af4983c310c')
ON CONFLICT DO NOTHING;
```

Kører via insert-tool.

### 2. Rod-årsagen (kode)

Find den funktion "Start hold og send invitationer" allerede kalder for at aktivere medarbejdere + oprette `team_members`. Genbrug den fra `AddMemberDialog.tsx` (og evt. UpcomingStarts hvis der er en efter-tilføj-vej der), så efter-tilføjede deltagere til et allerede-startet hold får:

- `is_active = true`
- Ny række i `team_members`
- Samme invitation-flow som de oprindelige (SMS/email registreringslink) — men KUN hvis holdet allerede er startet; ellers venter det som i dag

Bevarer §8 (én sandhed) — ingen duplikeret logik. Én commit til data-fix, én til kode-fix.

## Filer

- Data: 1 UPDATE + 1 INSERT via insert-tool
- Kode (gul zone): `src/components/personnel/AddMemberDialog.tsx` + evt. hjælper i samme mappe. Rører ikke pricing/løn/RLS.
