# Faktabilag til AI-kontekst: seks kapitler bygget på virkeligheden

Du vil erstatte de konceptuelle afsnit i AI-kontekst-dokumentet med faktiske forhold. Resultatet bliver ét nyt dokument, `docs/stork-faktabilag.md`, som besvarer dine seks spørgsmål og kan læses af enhver AI-session uden at åbne 11 MB snapshot.

## Hvorfor et nyt dokument og ikke de eksisterende snapshots

`docs/system-snapshot.md` er 360.000 linjer og `docs/ui-snapshot.md` 33.000 linjer. De er komplette, men ubrugelige som startkontekst — ingen AI kan holde dem i hovedet. Faktabilaget bliver det destillerede lag ovenpå: 6 kapitler, ca. 1.500-2.500 linjer i alt, med henvisning ned i snapshots for detaljer.

Omfang der skal dækkes: 267 tabeller, 763 RLS-politikker, 11 systemroller, 2.573 rettighedsrækker, 114 edge functions, ca. 495 linjer rutekonfiguration.

## Kapitlerne

**1. Databasen.** Alle tabeller i `public` grupperet efter domæne (løn, salg/provision, medarbejder/HR, integration, AMO/compliance, spil/gamification, konfiguration). Pr. tabel: formål i én linje, de vigtigste kolonner, foreign keys. Tre markeringer sat direkte i tabellen: LØN, PROVISION, PERSONDATA — udledt af faktiske kolonner (CPR, bank, e-mail, telefon, adresse, beløbsfelter), ikke af navnet alene.

**2. Roller og adgang.** De faktiske rollenøgler fra `system_role_definitions` med prioritet og antal aktive brugere. Derefter hvad RLS reelt giver hver rolle: politikmønstrene på tabellerne (`is_owner`, `has_role`, `can_view_employee`, `is_in_my_team`, scope-nøgler) og hvor `system_role`-enummet kollapser roller i RLS-laget. Inkluderer den kendte skævhed mellem 11 definerede roller og de 5 enum-værdier.

**3. Integrationer.** Alle 114 edge functions listet med formål, udløser (HTTP-kald fra app, webhook, cron) og hvilke tabeller de skriver til. Særskilt afsnit om Adversus og Enreach: om data kommer via webhook, poll/API eller upload, hvilket format der modtages, hvor rådata landes, og hvilke normaliseringstrin der kører før løn/provision kan læse det.

**4. Løn- og provisionsberegningen.** Kortet over hvor beregningen faktisk sker — frontend-hooks, `src/lib/calculations/`, `supabase/functions/_shared/`, databasefunktioner og triggere — med læse- og skrivetabeller pr. trin, og hvornår hvert trin kører (ved salg, ved rematch, ved åbning af lønside, ved cron). Markering af hvert sted samme regel findes mere end ét sted.

**5. Sider og navigation.** Alle ruter fra `src/routes/config.tsx` med den permission-nøgle der gater dem, og hvilke roller der faktisk har nøglen slået til ifølge `role_page_permissions`. Åbne/offentlige ruter markeres eksplicit.

**6. Eksisterende konventioner.** Navngivning der reelt bruges (filer, hooks, query keys, permission-nøgler, DB-kolonner, edge function-navne) og de design-tokens der findes i `index.css` og `tailwind.config.ts` — semantiske farver, skygger, gradienter, typografi.

## Metode

Hvert kapitel bygges på direkte opslag, ikke hukommelse: SQL mod `information_schema`, `pg_policies`, `system_role_definitions`, `role_page_permissions`, plus læsning af `src/routes/config.tsx`, `src/config/permissionKeys.ts`, `src/lib/calculations/`, `supabase/functions/`, `index.css` og `tailwind.config.ts`. Hvor virkeligheden afviger fra det, CLAUDE.md antager, noteres afvigelsen i kapitlet frem for at blive glattet ud.

Alt er læsning. Ingen kode, database eller konfiguration ændres — kun én ny markdown-fil.

## Levering

Ét dokument, `docs/stork-faktabilag.md`, med indholdsfortegnelse og de seks kapitler. Derefter kan CLAUDE.md's konceptuelle afsnit 2 og 3 henvise hertil i stedet for at beskrive antagelser.
