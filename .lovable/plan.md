# Pulsen – godkendt plan med Kaspers beslutninger (22/10-2026, rettet 11:32)

Grundplan: `.lovable/plan/pulsen-plan-ingen-kode-før-godkendelse-2026-10-22.md`. Dette dokument erstatter den, hvor de er uenige.

## Beslutninger (gældende)
1. `useFeedReactions` ændres ikke; reaktionsskift sletter fortsat egne ældre rækker.
2. Ingen ændring af RLS på `feed_reactions`/`feed_comments` i v1. Team-indlæg og team-milepæle har ingen reaktioner/kommentarer; kun Huset-indlæg og milepæle i Huset har dem.
3. Begivenheder vises præcis som på forsiden (ingen ekstra invitationsfilter i Pulsen).
4. FM-leder beholder `action_pulsen_moderate` for sit eget team.
5. Slettepolitik (udkast): indlæg, kommentarer på indlæg og billeder anonymiseres/slettes 24 mdr. efter oprettelse og 30 dage efter fratræden via eksisterende retention-motor (`data_retention_policies` + `gdpr_cleanup_log`). Art. 30-udkast "Intern kommunikation – Pulsen" kræver superadmin-godkendelse. Fast tekst under skrivefeltet: "Del aldrig kundeoplysninger".
6. Klub 50/100/200 (kr provision): én milepæl pr. medarbejder pr. lønperiode pr. niveau, alle steder. "Første gang" kun når det kan bevises.
7. Grænser i `pulsen_config`: Huset 10/dag, Mit team 25/dag.
8. Rekorder (provision i kr) kræver historik: dag ≥ 20 salgsdage, uge ≥ 8 uger, lønperiode ≥ 3 perioder.
9. Første salg kun hvis ansættelsesdato ligger i Storks historik og højst 60 dage før salget.
10. Toplinje: Storks rigtige teams med ≥ 1 salg seneste 30 dage; husets total tæller aldrig en sælger dobbelt.

## Åbne punkter (rettes ikke nu)
- `company_events` kan læses uden login (SELECT-regel for public med `true`).
- Alle indloggede kan oprette/ændre/slette `event_team_invitations` (`true`/`true`).
- Teammålretning af begivenheder styrer kun invitations-popup'en; forsiden viser alle events for alle.
- Trin 4: For at Huset-indlæg og Huset-milepæle kan få reaktioner, skal de nye måltyper tillades i `feed_reactions`/`feed_comments` (i dag kun birthday/anniversary/league_round). Uden RLS-ændring kan databasen ikke selv forhindre en reaktion på et team-indlæg – kun appen. Kræver beslutning før trin 4.

## Status
- Trin 0–3: færdige.
- Trin 4–8: afventer.
