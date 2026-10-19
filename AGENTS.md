## Struktur og datasikkerhed (masterplanen, godkendt 19/10-2026)

Dette afsnit er fast og må ikke fjernes eller omskrives af agenten.

Stork 1.0 lægges om efter masterplanen i repoet (masterplan/masterplan.md). Indtil andet er aftalt, gælder disse regler for alle databaseændringer:

1. Hver ny tabel får RLS slået til med regler, der kun giver den adgang, rollen skal have. RLS må aldrig slås fra.
2. Ny adgang for ikke-indloggede (anon) laves ikke uden aftale. Lav aldrig regler med USING (true) eller WITH CHECK (true) på tabeller med persondata eller løn (CPR, bank, adresse, telefon, e-mail, løn).
3. SECURITY DEFINER bruges kun, når funktionen selv tjekker den indloggede bruger og dennes rettighed og har fast search_path.
4. Rør aldrig de schemas og funktioner, strukturen ejer: core_*, app_*, overgang og funktioner med præfikset stork_.
5. Medarbejdere og salg slettes aldrig. Brug status og anonymisering.
6. Databasen afviser efterhånden ændringer, der bryder punkt 1–4. Får du sådan en afvisning, så stop, forsøg ikke at omgå den, og beskriv ændringen, så den kan tages gennem ændringsproceduren.

## Øvrige regler

- EU/EØS-adgang håndhæves ved login af edge-funktionen geo-login-guard mod eea_ip_ranges og non_eea_ip_ranges (DB-IP Lite); kun IP'er der beviseligt er uden for EU/EØS afvises (session tilbagekaldes server-side), ukendt land/fejl lukkes ind. Why: login-hooks får ikke request-headers, og backend leverer kun IP, ikke land.
- Kolonner fra manuelle uploads defineres og får sletteregler i data_import_* tabellerne (MG → Data import). Gælder i dag kun Eesy TM kurv/kombineret upload. Upload fjerner udefinerede kolonner, men beholder altid dem, matchingen læser. Why: kun definerede data må opbevares, uden at matchingen ændres.

- Opstart (/opstartshold) viser kun ugemodellen fra get_ramp_team_overview: week_status normalt, last_week_status (ramp_week_status maalt pr. sidste soendag) om mandagen; kun 1-1 (coaching) taeller som ugens 1-1 paa siden. Why: én kilde til status, ingen parallel beregning i frontend.
- Opstart: etablerede saelgere (get_ramp_full_team) vises paa samme side under de nye og maales med samme ramp_week_status (krav = sidste opstartskrav); de taeller med i tal-knapper og graf (kolonne "Etableret"). 1-1-daekning og sortering ligger i src/lib/rampEstablished.ts. Why: én ugemodel for alle, ingen parallel beregning.
- Eesy Mobil-fordel: anmodninger indsendes kun via RPC submit_eesy_mobile_request (én pr. medarbejder), abonnementer defineres kun i eesy_mobile_subscriptions(), kun ejere læser listen, og CPR/ICC/adresse/telefon nulstilles af cron 30 dage efter status sendt. Why: CPR skal minimeres og kun findes ét sted.
- Én arbejdsmail = ét medarbejderkort (alle statusser, case-insensitiv) håndhæves af triggeren `prevent_duplicate_employee` ved INSERT og ved ændring af work_email; frontend oversætter fejl via `src/lib/employees/employeeSaveErrors.ts`. Why: dubletter blander salgs-/provisionsattribution, der matcher på arbejdsmail.
