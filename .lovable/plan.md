# Push-notifikationer (ordre 2 af 2) – plan og fund før byggeri

## Fund (evidens)

| Type | Eksisterende alarm i dag | Kan kobles på uden ny regel? |
|---|---|---|
| c) team_afvist_salg | `quality-mails` action `rejected_review` (mail til TL/ATL) | Funktionen findes, men **intet kalder den**: ingen kald i `src/`, ingen DB-trigger på `quality_reviews` (kun immutabilitets-triggere). Teamleder-kassen på forsiden er en læsning, ikke en hændelse. |
| a) kvalitet_feedback | Ingen mail til sælger. Kun kassen på forsiden (læsning). | Nej – der findes ingen hændelse at koble på. |
| b) klub_milepael | `pulsen-milestones` (cron hvert 15. min) skriver Klub-milepæle | Ja – push sendes, når en ny Klub-milepæl skrives (ikke "live", op til 15 min forsinkelse). |
| d) opstart_flag | `send-ramp-risk-alerts` (cron/ejer) | Ja – samme modtagere som mailen; sælgeren er ikke modtager i dag. |
| e+f) manglende_1_1 | `send-ramp-weekly-alerts` (fredag, `ramp_weekly_missing_payload()`) | Ja – samme modtagere (TL/ATL og ledelse). |
| g) compliance_kritisk | `send-compliance-alert` (sendes kun ved kritisk) | Ja – samme modtagere som mailen. |

Databasens regler: nye SECURITY DEFINER-funktioner og ny anon-adgang afvises. En DB-trigger, der kalder `send-push` direkte ved hver registrering, kræver en af delene. Derfor sendes push kun fra edge functions (service role), ikke fra DB-triggere.

## Beslutninger før byggeri

1. **a) og c):** Der er ingen eksisterende live-hændelse. Valg:
   - A) Kvalitetskontrollens gem-flow kalder `quality-mails` `rejected_review` efter gem (genbruger eksisterende mail-funktion, som i dag ikke kaldes – betyder at TL/ATL-mailen også begynder at blive sendt). Feedback til sælger (a) sendes fra samme kald.
   - B) Udskyd a) og c) til v2; byg b, d, e, f, g nu.
2. **VAPID-nøgler:** Kan ikke genereres som tilfældig streng (det skal være et gyldigt nøglepar). Jeg genererer parret lokalt og gemmer begge som secrets uden at vise dem i chatten. Mail-subject: `mailto:it@copenhagensales.dk` – bekræft adressen.

## Byg (når ovenstående er besluttet)

- Migration: `push_subscriptions`, `push_preferences`, `push_log` med RLS (egne rækker; ejer læser alle via eksisterende `effective_is_owner()`), retention-politik 30 dage på `push_log` i eksisterende motor (dry_run som de øvrige).
- Edge: `push-public-key` (returnerer kun offentlig nøgle, kræver login), `send-push` (kun service role; 404/410 → `disabled_at`; fejl logges, kaster aldrig til kalderen), delt helper `_shared/push.ts` med faste tekster uden tal/navne.
- Kobling: ét ekstra kald efter eksisterende mailafsendelse i de valgte funktioner, pakket i try/catch. Mailflow uændret.
- Service worker: `importScripts` af `/push-sw.js` via `workbox.importScripts` – precache- og NetworkOnly-regler uændrede.
- Frontend: `PushOptInCard` på Mit hjem (standalone, logget ind, 14 dages "Ikke nu"), sektion "Notifikationer" i "Stork på telefon" med status, til/fra pr. relevant type og testknap, sletning af enhedens subscription ved logout.
- Compliance: nyt art. 30-udkast "Push-notifikationer til medarbejdere", afventer superadmin.
- Tests: preferences respekteres, sælger får aldrig opstart_flag, tekster uden tal/navne, 410 deaktiverer.

## Manuelt før test
Udgiv, installér på iPhone (iOS 16.4+), tryk "Ja tak", brug "Send testnotifikation".
