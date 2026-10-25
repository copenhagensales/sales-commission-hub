# InvoiceFlow fase 1 – trin 1 (plan til godkendelse)

Kasper bad om, at trin 1 blev bygget med det samme. Ordren rører adgangsregler, gemte logins og et nyt cron-job. Det er rød zone i Stork. Derfor ligger planen her først med de fund, der ændrer designet. Ingenting er bygget endnu.

## Fund i den eksisterende kode, der påvirker designet

1. **Databasen afviser nye SECURITY DEFINER-funktioner** (projektreglerne, punkt 7). Adgangskontrollen bygges derfor som en almindelig SECURITY INVOKER-funktion med RLS. Hver bruger må kun læse sin egen række i adgangstabellen. Det svarer til `superadmins` og `am_i_superadmin`.
2. **Stork kan i dag kun sende mail via M365 og kan ikke læse indbakken.** `_shared/m365-mail.ts` sender og kan vedhæfte filer. Det er godt nok til levering, så Resend er ikke nødvendig. Ingen edge-funktion læser mails i dag. Søgningen fandt hverken `mailFolders` eller `/messages`. Mail-regel-metoden kræver derfor, at Stork-appen i Microsoft får tilladelsen **Mail.Read (Application)**. Den skal helst begrænses til én indbakke med en Application Access Policy. Det skal Kasper eller IT gøre i Microsoft. Indtil da kan mail-regel-metoden kun testes med en tør kørsel.
3. **Ejer-adgang må ikke være en rollenøgle** (CLAUDE.md §5.10). Ejerne lægges som rækker i en adgangstabel. Rollen `ejer` bruges ikke i koden.
4. **Ledelse-menuen** findes i `AppSidebar.tsx` bag `menu_section_ledelse`. Den nye fane får sin egen nøgle, `menu_invoiceflow`, i `permissionKeys.ts`. Den nøgle styrer kun, om fanen vises. Databasen afgør den reelle adgang. Ændringen i `permissionKeys.ts` er rød zone og er omfattet af denne godkendelse.

## Hvad trin 1 bygger

**Database (én migration, kun nye `invoiceflow_*`-tabeller):**
- `invoiceflow_access` har felterne `user_id`, `scope` (`owner`, `own_automations` eller `bookkeeping`), `granted_by` og `granted_at`. Det er første gang, rækker lægges ind. Dine ejere lægges ind efter e-mail, ligesom i `superadmins`.
- Funktionerne `invoiceflow_has_access(scope)` og `am_i_invoiceflow_user()` er INVOKER-funktioner.
- `suppliers`, `sources`, `credentials`, `credential_use_log`, `jobs`, `runs`, `invoices`, `deliveries`, `settings` og `portal_requests` oprettes som beskrevet i ordren. Jobstatus kan også være `afventer_kode`. `invoices` får et felt til opbevaringsfristen, `retention_until`, som standard fakturadato + 5 år. `portal_catalog` oprettes først i trin 2.
- **RLS:** Kun brugere med scopet `owner` kan læse og skrive. Tabellen `credentials` har ingen læseregel for brugere i appen. Appen kan kun læse en metadata-visning (`security_invoker`) uden den krypterede værdi. Alle grants gives kun til `authenticated` og `service_role`. Ingen tabeller får adgang for ikke-indloggede (`anon`).
- **To private buckets:** `invoiceflow-pdf` og `invoiceflow-debug`. Kun funktionerne på serveren (`service_role`) skriver i dem. Brugere med adgang læser via en signeret URL fra en edge-funktion.
- **Offboarding:** Når et medarbejderkort deaktiveres, pauses medarbejderens sources. Det sker i en INVOKER-trigger på `invoiceflow_sources`, eller i workeren, hvis en trigger på `employee_master_data` bliver afvist. Fallback-løsningen er, at workeren tjekker `is_active` før hver kørsel.

**Vault:**
- Serveren krypterer logins med AES-GCM og nøglen `INVOICEFLOW_VAULT_KEY`. Nøglen genereres som en secret på serveren og vises aldrig.
- `invoiceflow-credentials` kan kun gemme, overskrive og slette, og kun ejeren af loginnet kan bruge den. Ingen kode læser og returnerer værdien.
- Kun workeren dekrypterer. Hver dekryptering logges med `run_id`.
- Compliance-overvågningen får en ny linje: dekryptering uden et tilhørende run giver en alarm. Den tilføjes til den eksisterende `compliance_run_checks`. Hvis funktionen er ejet af strukturen, stopper jeg og beskriver ændringen i stedet.

**Edge-funktioner:**
- `invoiceflow-scheduler`: opretter jobs den 2. kl. 06:00, kører opsamlingen den 10. og forventningskontrollen den 15. Dagene læses fra indstillingerne.
- `invoiceflow-worker`: maks. 3 samtidige kørsler. Den forsøger igen efter 10 minutter, 1 time og 6 timer. Ved fejl i login pauses kørslen, og ejeren får en mail.
- `invoiceflow-deliver`: sender én mail pr. faktura via M365 med PDF'en vedhæftet. Den forsøger 3 gange, og bagefter vises "ikke leveret".
- `invoiceflow-admin`: genkør, Godkend og send, signerede URL'er og Test nu.
- **Dubletter:** to unikke indekser, (leverandør, fakturanr.) og PDF-hash.

**Cron:** Ét dagligt job kl. 06:00 kalder scheduleren, som selv afgør, om det er en kørselsdag. Workeren vækkes, når der er nye jobs i køen, så der er ingen fast polling hvert minut. Det giver 1 kørsel om dagen.

**Brugerflade:** Ledelse → InvoiceFlow har fire faner: Leverandører, Kørsler, Fakturaer og Indstillinger. Data hentes via hooks med React Query, og siden følger Mobilstandard. Feltet til bogholderiets mail er tomt, og intet sendes, før en adresse er sat.

**Test:** SQL-test af RLS: ejeren har adgang, andre brugere afvises, og ingen kan læse værdien i `credentials`. Vitest for krypteringen og for reglerne om dubletter og retries. En tør kørsel med én leverandør via mail-regel.

## Secrets, som Kasper selv skal sørge for
- `INVOICEFLOW_VAULT_KEY` genererer jeg på serveren. Kasper skal ikke gøre noget.
- Mail.Read i Microsoft til M365-appen, som beskrevet ovenfor.
- Bogholderiets mailadresse sættes i appen og er ikke en secret.

## Åbne punkter (feltet bygges, beslutningen tages senere)
Bogholderiets mailadresse, de tre første portaler, slettepolitikken (5 år eller 12 måneder) og regionen hos Browserbase. Browserbase og Resend skal i DPA-oversigten og art. 30-fortegnelsen før den første rigtige portalkørsel i trin 2. Resend er sandsynligvis ikke nødvendig.
