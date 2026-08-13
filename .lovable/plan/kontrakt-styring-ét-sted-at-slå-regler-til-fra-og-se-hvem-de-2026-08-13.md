# Kontrakt-styring: ét sted at slå regler til/fra og se hvem der mangler

I dag ligger alle kontraktregler hardkodet i fem forskellige filer og et cron-job. Ingen kan se dem, ingen kan ændre dem uden en udvikler, og ingen regel fanger den vigtigste fejl: en medarbejder der starter uden at der nogensinde er sendt en kontrakt.

Løsningen er to nye faner under Kontrakter: **Overvågning** (hvem mangler hvad, lige nu) og **Regler** (slå til/fra, sæt antal dage). Alle eksisterende regler læser derefter fra samme sted.

## Fane 1: Overvågning

Øverst fire tal, der altid summerer til virkeligheden:

- **Ansat uden kontrakt** (rød) — aktiv medarbejder med opstartsdato, ingen kontrakt findes
- **Startet uden underskrift** (orange) — opstartsdato er nået, kontrakt sendt men ikke underskrevet
- **Afventer underskrift** (gul) — sendt, endnu ikke startet
- **I orden** (grøn) — underskrevet kontrakt

Under tallene en liste med navn, team, opstartsdato, dage siden opstart, kontraktstatus, antal påmindelser sendt og seneste påmindelse. Kan filtreres på kategori og team, og eksporteres til Excel. Knap pr. række: "Send kontrakt" (åbner det eksisterende send-vindue med medarbejderen forudvalgt).

Samme tal vises som et rødt banner på Medarbejdere-siden når kategori 1 eller 2 er over nul, så det ikke kun opdages af den der åbner Kontrakter.

## Fane 2: Regler

Hver regel er et kort med til/fra-kontakt og de tal der styrer den. Ingen regel er hardkodet længere:

| Regel | Kan styres |
|---|---|
| Mail-påmindelse til medarbejder | til/fra, dage før første påmindelse (nu 3), dage mellem (nu 3), maks antal (nu 3) |
| Systemlås ved manglende underskrift | til/fra, antal dage (nu 5) |
| Spærring ved afvist kontrakt | til/fra |
| Ledelses-notifikation | til/fra, modtagere, ugedage/dagligt — mail med listen over "ansat uden kontrakt" og "startet uden underskrift" |
| Advarsel i UI | til/fra, hvor mange dage før opstart en manglende kontrakt begynder at lyse rødt |

Ændringer logges (hvem, hvad, hvornår) og vises nederst på fanen, så en ændret låsegrænse altid kan spores.

## Sikkerhedsnet — det løsningen bevidst ikke gør

Systemlåse kan spærre folk ude af hele Stork, så de får bremseklodser:

- Låse-reglerne kan slås **fra** af alle med adgang, men grænsen kan ikke sættes lavere end 1 dag — ingen kan ved et uheld låse hele huset ude med "0 dage".
- Hvis indstillingerne ikke kan læses (netværksfejl, tom tabel), gælder **dagens værdier** (3/3/3 og 5 dage) — systemet opfører sig nøjagtigt som i dag i stedet for at låse alle eller slippe alle fri.
- Ejer rammes aldrig af låsene, så der altid er en vej ind.
- Overvågningen tæller kun **aktive** medarbejdere med opstartsdato, bruger samme kilde som medarbejdertallet, og springer den dokumenterede stab-/testdata over — så tallene stemmer med Virksomhedsoversigt.
- Ingen automatisk blokering af vagtplan eller løn i denne omgang. Det er markering + påmindelse. Blokering kan slås til senere, når tallene har vist sig at være rigtige.

## Adgang

Fanerne styres af rettighedssystemet som de nuværende faner (`tab_contracts_all`, `tab_contracts_templates`): to nye nøgler, hvor Overvågning gives til ejer, rekruttering og teamledere (kun eget team i listen), og Regler kun til ejer.

## Teknisk

**Database**
- `contract_policy_settings` — én række pr. regelnøgle: `key`, `enabled`, `config` (jsonb med dage/antal), `updated_by`, `updated_at`. GRANT: `authenticated` SELECT, ejer UPDATE via RLS, `service_role` ALL.
- `contract_policy_audit` — append-only log over ændringer (immutable, ingen UPDATE/DELETE-policy).
- `get_contract_compliance()` — SECURITY DEFINER, `search_path = public`. Returnerer én række pr. aktiv medarbejder med opstartsdato: `employee_id`, navn, team, `employment_start_date`, `contract_id`, `contract_status`, `sent_at`, `reminder_count`, `last_reminder_at`, og en beregnet `compliance_state` (`missing`, `started_unsigned`, `pending`, `ok`). Håndhæver selv scope via `is_owner`/`is_manager_or_above`/`is_in_my_teams`, så teamledere kun ser eget team.

**Frontend**
- `src/hooks/useContractPolicy.ts` — læser/skriver indstillinger, med hardkodede defaults som fallback.
- `src/hooks/useContractCompliance.ts` — kalder RPC'en, React Query.
- `usePendingContractLock.ts` og `useRejectedContractLock.ts` læser dage/til-fra fra `useContractPolicy` i stedet for hardkodede tal. `LockOverlays.tsx` prioritering ændres ikke.
- Nye komponenter under `src/components/contracts/`: `ContractComplianceTab.tsx`, `ContractPolicyTab.tsx`, plus advarselsbanner i medarbejderlisten.
- Rettighedsnøgler tilføjes `src/config/permissionKeys.ts`.

**Edge functions**
- `send-contract-reminders` læser dage/maks fra `contract_policy_settings` i stedet for hardkodet 3/3/3, og springer helt over hvis reglen er slået fra.
- Ny `send-contract-compliance-digest` (cron, samme mønster som FM-checklisten) sender ledelses-mailen via M365. Kaldes kun når reglen er slået til.

**Zoner**: `usePendingContractLock.ts`, `useRejectedContractLock.ts` og `send-contract-reminders` er adgangs-/persondatanære — ændringerne holdes til at læse værdier fra ét sted, ikke at ændre logikken. `permissionKeys.ts` er rød zone og rører kun to nye nøgler.

## Verifikation før det kaldes færdigt

1. RPC'en køres direkte mod databasen, og tallene sammenholdes manuelt med `employee_master_data` + `contracts` — de fire kategorier skal summere til antal aktive med opstartsdato.
2. Låsen testes med reglen slået fra, med grænsen sat højt, og med tom indstillingstabel — i alle tre tilfælde må ingen låses ude utilsigtet.
3. Påmindelses-funktionen kaldes i tørløb (uden afsendelse) og logger hvilke kontrakter den ville ramme, sammenholdt med den nuværende 3-dages-regel.
4. Teamleder-scope verificeres: en teamleder må kun se sit eget team i listen.
5. Playwright-gennemgang af de to faner for at bekræfte, at tal, filtre og banner vises som beskrevet.
