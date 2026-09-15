# Hvorfor de nye ikke kan logge ind i Stork

## Konklusion (bekræftet)

Microsoft-login kan **kun** lukke folk ind, hvis de allerede findes som bruger i Stork med **præcis den samme mailadresse**, som de logger ind med. Ny-oprettelse ved login er slået fra.

Evidens fra logbogen over fejlede logins (`failed_login_attempts`, senest 15/9 kl. 10:13): 20 forsøg i dag med samme årsag:

```text
sso: access_denied — sign ups are disabled for this website
```

Derfor virker Ella og Gaia:

| Person | Login-mail i Stork | Kan logge ind |
|---|---|---|
| Ella Novotny | elno@copenhagensales.dk (oprettet 8/9) | Ja |
| Gaia Vestergaard Lambert | gaiavlambert@gmail.com (oprettet 31/8) | Ja |
| Oliver Lyng Christensen (start 15/9) | ingen bruger oprettet | Nej |
| Sophus Aunstrup Rich (start 15/9) | ingen bruger oprettet | Nej |
| Silke, Storm, Frederik, Dicte | kun privat gmail/icloud, ingen arbejdsmail | Nej med Microsoft-login |

## Simon Sejer

Simon Sejer Linddal Sørensen findes i Stork med login-mailen `sise@copenhagensales.dk`. Han logger nu ind fra Relatel som `simo@cph-relatel.dk` — den adresse findes slet ikke i Stork (0 brugere med `simo@`), så han bliver afvist med samme fejl. Til sammenligning har 12 andre Relatel-medarbejdere en `@cph-relatel.dk`-login, og de kommer ind.

Hans nuværende Stork-profil hedder stadig "Simon Sejer Linddal Sørensen".

## Hvad jeg foreslår vi gør

1. **Simon:** flyt hans login-mail fra `sise@copenhagensales.dk` til `simo@cph-relatel.dk`, så den matcher hans Relatel-konto. Han beholder sin profil, historik, salg og løn — kun adressen ændres. Skal navnet også rettes til "Simon Mørkhøj", gør jeg det samme sted.
2. **De nye:** opret dem som brugere med præcis den arbejdsmail, de bruger til Microsoft-login, og send dem invitationen. Jeg skal have deres endelige arbejdsmails, hvis de ikke står i Stork endnu (Oliver og Sophus mangler helt).
3. **Silke, Storm, Frederik, Dicte:** de er kun oprettet med privat mail. De skal have arbejdsmail på, hvis de skal bruge Microsoft-login.

## Beslutning jeg mangler fra dig

Skal jeg holde ny-oprettelse ved login slået **fra** (sikrest — kun folk vi selv har oprettet kan komme ind), eller vil du have, at alle med en Copenhagen Sales-/Relatel-konto automatisk kan komme ind første gang de logger ind? Jeg anbefaler at lade det være slået fra og i stedet oprette folk på forhånd.

## Teknisk

- Fejlen kommer fra Auth-laget: SSO-login mod en mail uden eksisterende `auth.users`-række giver `access_denied` fordi signups er disabled. `src/pages/Auth.tsx:105` bruger `lovable.auth.signInWithOAuth("microsoft", ...)` og logger fejlen via `logFailedLogin`.
- Simon: `employee_master_data.id = d858fee9-3dfb-4526-80f0-eac2d6ee6028`, `auth_user_id = 3df2b4df-a0e7-4789-9371-5b1bfede6246`, auth-mail `sise@copenhagensales.dk`, sidste login 8/9. Rettelsen er en betinget opdatering af auth-mail + `work_email`, kun for netop dette id, uden hardkodning af navne i koden.
- Ingen ændringer i løn, provision, pricing, RLS eller historiske tabeller. Kobling sker via `auth_user_id`, så mailskift bryder ikke attribution.
- Oprettelse af nye brugere sker gennem det eksisterende invitationsflow (`employee_invitations`), ikke ved manuelle auth-indgreb.
