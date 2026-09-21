# Plan: Besvarelse på opkald i Kampagneoversigt Tryg

## Mål
Tilføj to nye kolonner pr. rapportlinje — både på siden og i mandagsmailen:

- **Svarprocent** = besvarede opkald / alle opkaldsforsøg
- **Kontaktandel** = emner vi har talt med / emner vi har ringet til

Et opkald tæller som besvaret, når dialeren melder det besvaret (ingen krav til samtalelængde). De to nye kolonner påvirker ikke lukkede emner, bookede møder eller mødebook-hitraten.

## Hvad der er bekræftet i dag
- Opkaldsforsøg findes allerede i systemet for hovedkontoen: for ugen 14.–20. september fx FDM (104520) 2.295 opkald / 1.078 besvarede, Finansforbundet (80333) 607/174, Kræftens Bekæmpelse (104837) 277/146. Status-værdierne er besvaret, intet svar, optaget, andet, mislykket.
- Der er **ingen** opkald gemt for Lederne-kampagnerne (118971/118972), og Enreach-opkald stopper i februar 2026. Kanvas og Lederne kan derfor ikke få svarprocent ud af de data vi allerede har.
- Adversus har et opkaldsendepunkt (`/cdr`) som kan filtreres på tidsrum, og som den eksisterende integration allerede bruger for hovedkontoen.

## Fremgangsmåde

### Trin 1 — afklar adgang (læsning, ingen ændringer)
Kontroller pr. kilde om opkaldsforsøg kan hentes for ugen: hovedkonto, Lederne-konto og Enreach. Lederne-kontoen har afvist adgang til kampagnelisten, så adgangen til opkald skal bekræftes før vi bygger på den. Resultatet afgør hvilke linjer der kan vise tal.

### Trin 2 — gem kun tællinger
Ny tabel til aggregerede opkaldstal pr. uge, konto og kampagne: antal opkaldsforsøg, antal besvarede, antal ringede emner, antal emner talt med. Ingen telefonnumre, navne eller opkaldsdetaljer gemmes — helt som på emnesiden i dag. Adgang som de øvrige rapporttabeller (teamleder og opefter).

### Trin 3 — hent tallene i den eksisterende kø
Hver opgave i kørslen (konto + kampagne + uge) henter også ugens opkald for netop den kampagne, tæller forsøg og besvarede, tæller unikke emner undervejs i hukommelsen og skriver kun totalerne. Samme sideopdeling og genoptagning som i dag, så et kald aldrig løber tørt for tid. Fejler opkaldsdelen for en kampagne, fortsætter emnedelen uændret, og linjen viser "–" i stedet for et forkert tal.

### Trin 4 — vis tallene
Siden og mailen får to nye kolonner til højre for hitraten, under en fælles overskrift "Opkald": Svarprocent og Kontaktandel, begge med én decimal som de øvrige procenter. Linjer uden opkaldsdata viser "–", og en note under tabellen forklarer hvilke kilder der ikke leverer opkaldstal. "Tryg i alt" regner samlet svarprocent og kontaktandel af summerne.

### Trin 5 — kør og kontrollér
Genkør de sidste 8 uger, og kontroller for sidste hele uge at antal forsøg og besvarede pr. kampagne stemmer med dialerens egne tal.

## Afgrænsning
- Emnelogik, statusklassificering, mapping, hitrate og mailens øvrige indhold ændres ikke.
- Lederne-synken og webhook-flowet røres ikke.
- Cron-planen (mandag 07:00) ændres ikke.

## Teknisk
- Migration: `weekly_lead_call_stats` (week_start, account, campaign_id, attempts, answered, leads_dialed, leads_answered, tidsstempler) med UNIQUE (week_start, account, campaign_id), GRANT til `authenticated`/`service_role`, RLS via `effective_is_teamleder_or_above()`, plus en SECURITY DEFINER-upsert så genkørsel er idempotent. Tilsvarende felter i `weekly_lead_closure_tasks` til sideposition for opkaldsdelen.
- `weekly-lead-closure-report/index.ts`: opkaldshentning pr. task (Adversus `/cdr` filtreret på `campaignId` + `insertedTime` inden for ugen; Enreach efter samme mønster som emnehentningen, hvis trin 1 viser at det er muligt), `assertFieldsAllowed` udvides med de felter opkaldene kræver (kampagne, status, tidspunkt, emne-id), og felterne registreres som BEHOLD i `ingestion_known_fields`.
- Frontend: `useWeeklyLeadClosureReport.ts` får en hook til opkaldstallene; `WeeklyLeadClosureReport.tsx` og `_shared/weekly-lead-closure-mail.ts` får de to kolonner ens.
