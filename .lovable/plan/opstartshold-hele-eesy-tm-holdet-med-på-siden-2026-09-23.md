# Opstartshold: hele Eesy TM-holdet med på siden

## Hvad Kasper får

Siden får to sektioner:

1. **Opstart (dag 1-40)** — uændret, som i dag: kurve, norm (p25/p50/p75), over/midt/under-status og risikoflag på dag 10 og 15.
2. **Hele holdet** — ny sektion nedenunder med alle øvrige aktive sælgere på Eesy TM og Hiper. Ingen kurve og ingen over/under-status; her står de rene tal: produkter pr. uge for de seneste 6 uger, ugens tal, samlet anciennitet i arbejdsdage — og de samme ugentlige forløb som opstarterne: 1-1 samtale og medlyt med feedback, med fravær-markering og samme feedbackmail.

Dermed kan lederne køre ét ugentligt forløb for hele holdet fra én side, ikke kun for de nye.

## Hvem kommer med

Eesy TM og Hiper hænger allerede sammen i opstartsmodulet (Hiper Bredbånd er koblet til Eesy TM Products), så begge dækkes automatisk.

Holdet defineres som aktive medarbejdere i de teams der er knyttet til Eesy TM eller Hiper — 31 personer i dag. Derudover tages aktive medarbejdere med salg på kampagnerne de seneste 90 dage med, selv om de mangler teamtilknytning (4 personer i dag), så ingen falder ud af listen på grund af manglende opsætning. De 38 nuværende tilmeldte opstartere bliver ved med at ligge i sektion 1 indtil dag 40 og glider derefter ned i "Hele holdet".

Adgangen er uændret: kun ejere/admin og teamledere/assisterende for de relevante teams. Ingen ser sig selv.

## Én ting jeg ikke kan levere som ønsket

Du valgte "alt gælder alle", men risikoflag kan ikke gælde de erfarne: flaget udløses ved at sammenligne med kurvens p25-værdi på dag 10 og 15, og både kurve og norm slutter ved dag 40. Uden en norm findes der ingen grænse at flage imod — og du har valgt ingen norm for veteraner.

Derfor: **ugentlige forløb (1-1, medlyt, fravær) gælder alle. Risikoflag og risikostatistik forbliver kun for dag 1-40.** Vil du senere have flag på hele holdet, kræver det en grænse vi beslutter (fx holdets median eller et fast ugetal) — det er en separat beslutning.

## Teknisk

- **Ny RPC `get_ramp_full_team()`** (SECURITY DEFINER, samme adgangstjek via `can_view_ramp_team()` og samme lederfiltrering som `get_ramp_team_overview`). Returnerer pr. medarbejder: navn, team, anciennitet i arbejdsdage (`ramp_workday_no` fra `employment_start_date`), produkter pr. uge for de seneste 6 uger via den eksisterende `ramp_product_count(ramp_campaign_ids(...), email, fra, til)`, ugens forløbsstatus (`has_coaching`, `has_listen`, `has_absence`, `week_required`, `week_complete`) og handlingslog — samme felter som i dag, bare uden `p25/p50/p75`, `status` og flagfelter. Medarbejdere med `day_no <= 40` og en aktiv tilmelding udelades, så de to sektioner ikke overlapper.
- **Ingen ændring** i `compute_ramp_curve`, `compute_ramp_risk_stats`, `ramp_create_risk_flags`, `get_ramp_team_overview`, `employee_ramp_enrollment` eller `ramp_curve`. Historiske kurveversioner og flag berøres ikke.
- **`send-ramp-session-feedback`**: modtagerlogikken slår i dag op via tilmeldingen. Den udvides til også at kunne finde modtagere for en medarbejder uden tilmelding (leder/assisterende for medarbejderens team + de faste modtagere i `ramp_settings`), så forløbsmailen virker for hele holdet. `ramp_flag_action` bruges uændret med `flag_id = null`.
- **Frontend**: ny hook `useRampFullTeam()` i `src/hooks/useRampTeam.ts` og en ny sektion i `src/pages/onboarding/RampTeam.tsx` der genbruger de eksisterende kort- og forløbskomponenter uden kurvedelen. Ingen ændring i de eksisterende opstartskort.
- Rører ikke løn, provision, pricing, annullering, RLS-politikker eller GDPR. To commits: (a) migration med ny RPC + udvidet mailmodtagerlogik, (b) frontend.
