# Pulsen – godkendt plan med Kaspers beslutninger (22/10-2026)

Grundplan: `.lovable/plan/pulsen-plan-ingen-kode-før-godkendelse-2026-10-22.md`. Dette dokument erstatter den, hvor de er uenige.

## Beslutninger
1. `useFeedReactions` ændres ikke; Pulsen genbruger den uændret.
2. RLS på `feed_reactions`/`feed_comments` udvides kun additivt (RESTRICTIVE-regler) for `pulsen_post`, `milestone`, `event`: læs/skriv kræver synligt mål. birthday/anniversary/league_round er uændrede (bevist med før/efter-optælling).
3. Slettepolitik: indlæg, kommentarer på indlæg og billeder anonymiseres/slettes 24 mdr. efter oprettelse og 30 dage efter fratræden via eksisterende retention-motor (`data_retention_policies` + `gdpr_cleanup_log`). Art. 30-udkast "Intern kommunikation – Pulsen" lægges i compliance-fanen som afventende superadmin-godkendelse. Fast tekst under skrivefeltet: "Del aldrig kundeoplysninger".
4. Klub 50/100/200: én milepæl pr. medarbejder pr. lønperiode pr. niveau. "Første gang" kun når det kan bevises.
5. Grænser: Huset 10/dag, Mit team 25/dag i `pulsen_config`.

## Rettelser
- Rekorder (provision i kr) kræver historik: dag ≥ 20 salgsdage, uge ≥ 8 uger, lønperiode ≥ 3 perioder (`pulsen_config`).
- Første salg kun hvis ansættelsesdato ligger i Storks historik og højst 60 dage før salget.
- Toplinje: Storks rigtige teams med ≥ 1 salg seneste 30 dage; husets total tæller aldrig en sælger dobbelt.
- Teammålrettede events: Pulsen håndhæver invitationsreglen i databasen (`pulsen_event_visible`); forsidens hul rapporteres, rettes ikke uden ordre.
- Trin 0 stopper før trin 3, hvis en forudsætning vælter.
- Trin 1: `menu_pulsen` synlig for alle roller, styres på /permissions, tom tilstand "Pulsen åbner snart".
- Trin 2: forsiden skal opføre sig identisk efter flytning til `useCompanyEvents`.
- Trin 3: genkørbar RLS-test (`supabase/tests/pulsen_rls_test.sql`).

## Status
- Trin 0–3: færdige (se færdigrapport).
- Trin 4–8: afventer.
