# Pulsen – godkendt plan med Kaspers beslutninger (22/10-2026, rettet 11:32)

Grundplan: `.lovable/plan/pulsen-plan-ingen-kode-før-godkendelse-2026-10-22.md`. Dette dokument erstatter den, hvor de er uenige.

## Beslutninger (gældende)
1. `useFeedReactions` ændres ikke; reaktionsskift sletter fortsat egne ældre rækker.
2. Løsning B (22/10): snæver restrictive regel på `feed_reactions`/`feed_comments` kun for `pulsen_post` (Huset, ikke slettet/skjult, synligt) og `milestone` (shown_in_house). Team-indhold har ingen reaktioner/kommentarer; bedste svar og Ubesvarede kun for Huset.
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
- Billeder: slettepolitikken (24 mdr./30 dage) skal også fjerne filer i `pulsen-images`, når retention-motoren bygges.

## Status
- Trin 0–5: færdige.
- Trin 6–8: afventer.
