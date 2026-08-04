# Fix: "Unauthorized" på Tast selv salg (Eesy TM)

## Diagnose (verificeret)

David og Thomas har hver **to auth-konti** — en på privat-email og en på arbejds-email — og `employee_master_data.auth_user_id` peger på den forkerte:

| Medarbejder | auth_user_id i master | Konto de faktisk logger ind med |
|---|---|---|
| David Krygier | `47a1119c…` (davidbergmankrygier@hotmail.com, sidst logget ind 24/7) | `76731f77…` (dakr@copenhagensales.dk, logget ind 4/8 11:40) |
| Thomas Wehage | `cb0eb55a…` (thomaswehage@hotmail.com, sidst 1/6) | `596f3dac…` (thwe@copenhagensales.dk, logget ind 4/8 09:25) |

`supabase/functions/manual-sales/index.ts:72-78` slår kun medarbejderen op på `auth_user_id` og returnerer `null` → `401 Unauthorized`, når der ikke er match. Begge er aktive og medlem af Eesy TM (`0cb1b854…`), som er Hiper-kanalens team — så adgangen er reelt korrekt, opslaget fejler blot.

Frontend har allerede fallback-mønstret for præcis dette problem: `src/lib/employeeLookup.ts` (auth_user_id → work_email/private_email). Edge-funktionen mangler det.

## Løsning

**1. Fallback-opslag i `manual-sales` (kodefix, dækker alle nuværende og fremtidige tilfælde)**

I `getCallerContext`: hvis opslag på `auth_user_id` ikke giver en række, slå op på token-brugerens email mod `work_email` / `private_email` (case-insensitivt, kun `is_active = true`). Fejler stadig med 401 hvis intet match. Samme semantik som `employeeLookup.ts`, så ét mønster i hele systemet.

**2. Datarettelse (én migration, kun disse to rækker)**

Peg `auth_user_id` på den konto de faktisk bruger:
- David: `ca295579…` → `76731f77…`
- Thomas: `cb135e08…` → `596f3dac…`

Dette retter samtidig alle *andre* steder i systemet der kun matcher på `auth_user_id` (rettigheder, mine sider, tidsregistrering), hvor de kan have samme problem uden at have rapporteret det.

## Ikke i scope

- Ingen sletning eller sammenlægning af de dobbelte auth-konti (separat beslutning).
- Ingen ændring af kanal-/team-logik i `manual-sales`.
- Ingen ændring af eksisterende salg.

## Verifikation

- Kald `manual-sales?action=channels` med David's arbejds-email-session → forventet `{ channels: [Hiper] }`, ikke 401.
- Bekræft at én-konto-medarbejdere fortsat rammer det primære `auth_user_id`-opslag (uændret sti).
- Tjek at ingen anden medarbejder har `auth_user_id` peget på en konto med nyere login på en anden konto (rapportér fund, ret ikke).
