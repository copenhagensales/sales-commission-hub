# Faktabilag til AI-kontekst: seks kapitler bygget på virkeligheden

Formålet er én fil du kan lægge ind som project knowledge hos Claude. Derfor er kravet ikke fuldstændighed, men at Claude efter én læsning kender de faktiske navne, kan finde resten selv, og ikke gætter. Filen bliver `docs/stork-faktabilag.md`, målrettet ca. 600-900 linjer — læsbar i én kontekst, ikke et opslagsværk.

## Hvorfor ikke de eksisterende snapshots

`docs/system-snapshot.md` er 360.000 linjer og `docs/ui-snapshot.md` 33.000 linjer. De er komplette og bliver stående som opslagsværk, men de kan ikke være project knowledge. Faktabilaget er det destillerede lag: faktiske navne og strukturer, med henvisning ned i snapshots når Claude skal have detaljen.

Omfanget der destilleres: 267 tabeller, 763 RLS-politikker, 11 systemroller, 2.573 rettighedsrækker, 114 edge functions.

## Kapitlerne

**1. Databasen.** Ikke alle 267 tabeller enkeltvis. I stedet: domænegrupper (løn, salg/provision, medarbejder/HR, integration, AMO/compliance, spil, konfiguration) hvor hver gruppe har sine kernetabeller beskrevet med vigtigste kolonner og foreign keys, og de øvrige tabeller nævnt ved navn i én linje. Markering LØN / PROVISION / PERSONDATA sættes ud fra faktiske kolonner (CPR, bank, e-mail, telefon, adresse, beløb) — ikke ud fra tabelnavnet.

**2. Roller og adgang.** De faktiske rollenøgler fra `system_role_definitions` med prioritet og antal aktive brugere. Derefter hvad RLS reelt giver: de politikmønstre der bruges (`is_owner`, `has_role`, `can_view_employee`, `is_in_my_team`, scope-nøgler), og hvor `system_role`-enummet kollapser 11 roller til færre værdier i RLS-laget. Skævheder noteres, ikke glattes ud.

**3. Integrationer.** De 114 edge functions grupperet efter formål (integration, løn, GDPR, kommunikation, cron) med udløser pr. gruppe — HTTP-kald fra app, webhook eller cron. Særskilt og præcist afsnit om Adversus og Enreach: webhook vs. poll vs. upload, format, hvilken tabel rådata landes i, og hvilke normaliseringstrin der kører før løn/provision kan læse det.

**4. Løn- og provisionsberegningen.** Systemets farligste område, derfor det mest detaljerede kapitel. Hvor beregningen faktisk sker — frontend-hooks, `src/lib/calculations/`, `supabase/functions/_shared/`, databasefunktioner og triggere — med læse-/skrivetabeller pr. trin og hvornår trinnet kører (ved salg, ved rematch, ved åbning af lønside, ved cron). Hvert sted samme regel findes mere end ét sted markeres.

**5. Sider og navigation.** Rutetabel med sti, permission-nøgle og hvilke roller der har nøglen slået til ifølge `role_page_permissions`. Offentlige ruter markeres eksplicit.

**6. Eksisterende konventioner.** Navngivning der reelt bruges (filer, hooks, query keys, permission-nøgler, DB-kolonner, edge function-navne) plus design-tokens fra `index.css` og `tailwind.config.ts` — semantiske farver, skygger, gradienter, typografi. Skrevet som regler Claude kan følge, ikke som beskrivelse.

Til sidst et kort afsnit "hvor du finder resten", så Claude ved hvornår den skal slå op i snapshot-filerne frem for at gætte.

## Metode

Hvert kapitel bygges på direkte opslag: SQL mod `information_schema`, `pg_policies`, `system_role_definitions`, `role_page_permissions`, plus læsning af `src/routes/config.tsx`, `src/config/permissionKeys.ts`, `src/lib/calculations/`, `supabase/functions/`, `index.css` og `tailwind.config.ts`. Hvor virkeligheden afviger fra det CLAUDE.md antager, står afvigelsen i kapitlet.

Alt er læsning. Ingen kode, database eller konfiguration ændres — kun én ny markdown-fil.
