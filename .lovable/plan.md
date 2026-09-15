# Kvalitetsfeedback direkte til sælger + live-orientering til teamledelsen

## Hvad findes allerede (bekræftet i kode og database)

- `quality_reviews` (immutable) indeholder allerede alt en tilbagemelding kræver: `sale_id`, `sale_datetime`, `sale_date`, `client_campaign_id`, `employee_id`, `seller_name`, `team_id`, `team_name`, `team_leader_id`, `assistant_team_leader_id`, `reviewer_employee_id`, `result`, `comment`, `search_key`, `completed_at`.
- De to typer findes allerede som `result`: `afvist` (store fejl) og `godkendt_med_bemaerkning` (små ting = feedback-tag). `godkendt` er ren godkendelse uden tilbagemelding.
- Fejltyper ligger i `quality_error_codes` + `quality_review_error_codes`; manglende tjeklistepunkter i `quality_review_items`.
- Fortrudte kontroller ligger i `quality_review_voids` og skal ignoreres.
- Adgangsfunktioner findes: `quality_can_view_all()`, `quality_my_leader_team_ids()`, `is_quality_controller()`, `get_current_employee_id()`.
- Mails: `save_quality_review` + `quality-mails` edge function + `quality_mail_log`. **Rører jeg ikke.**

Derfor bygges der ingen parallel datastruktur — kun én ny kvitteringstabel oven på `quality_reviews`.

## Database (én migration)

1. Ny tabel `quality_feedback_acknowledgements`
   - `review_id` (FK → `quality_reviews`), `employee_id` (FK → `employee_master_data`), `role` (`saelger` | `teamleder` | `assisterende_teamleder`), `created_at`.
   - `UNIQUE (review_id, employee_id)` — én kvittering pr. person pr. sag.
   - Kun INSERT og SELECT tillades; trigger blokerer UPDATE/DELETE (samme mønster som resten af kvalitetsmodulet), så historikken er uforanderlig.
   - GRANT til `authenticated` (select/insert) + `service_role`.
   - RLS: man kan kun indsætte og se sin egen kvittering; kvalitetskontrollant/superadmin kan se alt; teamleder/assisterende teamleder kan se kvitteringer på deres eget team.
2. RLS på læsning af tilbagemeldinger håndhæves i databasen via nye RPC'er (SECURITY DEFINER med eksplicit adgangstjek), samt en SELECT-politik på `quality_reviews` så sælgeren kan læse sine egne rækker, teamledere deres teams (via `quality_my_leader_team_ids()`), og kontrollant/superadmin alt.
3. Nye funktioner:
   - `get_my_quality_feedback()` → ukvitterede sager for den aktuelle bruger, både som sælger (`role = saelger`) og som teamleder/assisterende teamleder for eget team. Returnerer tidspunkt (opkaldsstart hvor det findes, ellers salgstidspunkt), kampagnenavn, søgenøgle (telefonnummer, ellers OPP-nr./Sales ID som i kvalitetskøen), type, fejltyper og kommentar — plus sælgerens navn til ledervisningen.
   - `acknowledge_quality_feedback(p_review_id, p_role)` → logger kvitteringen med hvem, hvilken rolle og hvornår. Validerer at brugeren faktisk har den rolle på sagen. Idempotent.
   - `get_quality_feedback_history(p_employee_id)` → permanent historik til profilen, med samme adgangsregler.
   - Kun sager med `result` i (`afvist`, `godkendt_med_bemaerkning`) og uden void kommer med.

Ingen ændring i løn, provision, pricing, afregning eller annullering. Resultatet er fortsat kun internt kvalitetsoverblik.

## Frontend

**Ny hook** `src/hooks/useQualityFeedback.ts` (React Query, ingen direkte kald i komponenter):
- `useMyQualityFeedback()` — henter køen, `refetchInterval` 60 sek. **og** en realtime-subscription på `quality_reviews` (sælger: egne rækker, leder: eget team), så nye sager drypper ind løbende uden reload.
- `useAcknowledgeQualityFeedback()` — kvitterer og opdaterer køen.
- `useQualityFeedbackHistory(employeeId)` — historik til profilen.

**Ny komponent** `src/components/quality/QualityFeedbackInbox.tsx` — samme komponent til sælger og ledere:
- Ligger fast i toppen af forsiden med reserveret højde, så intet hopper når en sag kommer ind. Ingen modal, intet overlay, ingen lyd, ingen opmærksomhedskrævende animation.
- Kø, ikke stak: én kasse med "1 af 3" og pile mellem sagerne.
- Indhold: tidspunkt stort ("kl. 09:42"), kampagne, søgenøgle (telefonnummer, ellers OPP-nr./Sales ID), type, fejltype(r) og kontrollantens kommentar. `Afvist` får tydelig rød ramme/badge; feedback vises som dæmpet gult tag.
- Sælger: "OK". Leder: "Set" (kvitteret) og sælgerens navn vises. Ledernes og sælgerens kvitteringer er helt uafhængige — hver logges med sin rolle.
- Er køen tom, vises ingen kasse.

**Forsiden** `src/pages/Home.tsx`: komponenten indsættes øverst. Den viser automatisk sælgersager og/eller ledersager alt efter hvad brugeren har adgang til.

**Profil**: permanent liste (tidspunkt, kampagne, type, fejltype, kommentar) på `src/pages/MyProfile.tsx` (egen historik) og `src/pages/EmployeeDetail.tsx` (leder/kontrollant ser medarbejderens historik) — til brug i den ugentlige 1-1 medlyt.

## Bevares uændret

Straks-mail til teamleder ved afvist salg, daglig sammenfatning og ledelsesmail. Ingen anke-flow, ingen eskalering, ingen kobling til opstarts-fareflag, ingen daglig opsamling.

## Verifikation

Typecheck, databasekontrol af RLS (sælger kan ikke se andres sager), og browserkontrol af forsiden: ingen layout-hop, kø-navigation virker, kvittering fjerner sagen for den ene rolle uden at påvirke den anden.
