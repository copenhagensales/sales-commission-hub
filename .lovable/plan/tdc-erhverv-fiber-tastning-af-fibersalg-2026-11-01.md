# TDC Erhverv Fiber – tastning af fibersalg

## Formål
Fibersalg tastes direkte på fanen TDC Erhverv Fiber i stedet for kun at komme fra Adversus. Adversus kører videre parallelt en periode (besluttet).

## Hvad sælgeren ser
1. Vælg salgstype:
   - **Fuldt salg** – HAP eller VOK, med/uden Mobilevoice. Ingen leadgiver.
   - **Lukket salg** – HAP eller VOK, med/uden Mobilevoice. Leadgiver skal vælges.
2. **CVR-nummer** (8 cifre, taltastatur). Gemmes som salgets OPP-nummer.
3. **Leadgiver** (kun ved lukket salg): liste med alle aktive i Relatel og TDC Erhverv, grupperet pr. team, med søgning.
4. Salgsdato er altid i dag. Den der taster står altid som sælger på sin del.
5. Liste over egne tastede salg i dag.

## Provision og omsætning
Satserne findes allerede på de 12 fiberprodukter og genbruges uændret:
- Fuldt salg X → ét salg til sælgeren med »Fuldt salg X«.
- Lukket salg X → to salg med samme CVR: »Lukket salg X« til sælgeren og »Lead Provi X« til leadgiveren (samme opdeling som Adversus-salgene har i dag).
- Leadgiverens del skal tælle som bisalg, ikke salg.

## Adgang
- Ny lille »Admin«-boks på fanen: Ejere, Rasmus Hansen og Johannes Hedebrink kan tilføje/fjerne sælgere på listen.
- Kun personer på listen kan se fanen og taste salg. Leadgivere skal ikke være på listen.
- Rasmus og Johannes gives admin via en adgangsliste i databasen (ikke navne i koden).

## Skal afklares/bekræftes før byg
- **Bisalg-markeringen er fælles for produktet.** I dag har »Lead Provi HAP/VOK« hverken »tæller som salg« eller »bisalg«; kun Mobilevoice-varianterne er bisalg. Sætter vi bisalg på alle fire Lead Provi-produkter, ændres det også for leads fra Adversus og for TDC-leadgivere. Provision ændres ikke, kun hvordan det tælles på tavler.
- **Dobbelttælling:** Når Adversus og tastning kører samtidig, kan samme salg give dobbelt provision. Fanen viser en advarsel, hvis CVR allerede findes på et fibersalg de sidste 30 dage, men blokerer ikke.

## Teknisk (rød zone: salg/provision/rettigheder – kræver godkendelse)
- Migration: tabel `tdc_fiber_access(employee_id, rolle 'saelger'|'admin', created_by, created_at)` med RLS: alle indloggede må læse egen række; ejere og admin-rækker må tilføje/fjerne sælgere. Ingen SECURITY DEFINER, ingen anon.
- Indsæt Rasmus Hansen og Johannes Hedebrink som admin (efter opslag og bekræftelse af korrekt medarbejder).
- Salg oprettes via en almindelig databasefunktion (SECURITY INVOKER) `tdc_fiber_opret_salg(type, produkt, cvr, leadgiver_id)`, som tjekker adgangslisten, CVR-format, at leadgiver er aktiv i Relatel/TDC Erhverv, og at leadgiver ≠ sælger; skriver `sales` + `sale_items` i én transaktion med `source = 'tdc_fiber_manual'`, kunde-/OPP-felt = CVR og stabil klient-UUID mod dobbeltregistrering. Kræver RLS-tilladelse til indsætning på `sales`/`sale_items` for listens sælgere – undersøges i første trin; afvises den, stopper jeg og beskriver ændringen.
- Fanens synlighed flyttes fra »Salg«-rettigheden til adgangslisten via `useMitArbejdeSynlighed`.
- Hooks i `src/hooks/useTdcFiberSales.ts` (React Query, `retry: 0` på oprettelse). Mobilstandard følges; audit ved 360/393/430 px.
- Prøver: regel for lukket salg kræver leadgiver, fuldt salg afviser leadgiver, CVR-validering.
- Ingen ændring af prisregler, lønberegning, Adversus-integration eller boards.
