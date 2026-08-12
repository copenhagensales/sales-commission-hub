# Fix: Stork loader i det uendelige for flere brugere

## Hvad der sker
Alle opslag i medarbejder-stamdata fejler med HTTP 500 ("infinite recursion detected in policy for relation employee_master_data"). Fordi login-flowet slår brugerens egen medarbejderrække op (bl.a. for at se om koden skal skiftes), bliver appen aldrig færdig med at indlæse — deraf "Indlæser..." for evigt. Det rammer alle brugere, ikke kun én.

## Årsag (verificeret)
Adgangsreglen `Employees can view active colleagues` på stamdata-tabellen slår op i **samme tabel** i sin egen betingelse:

```text
is_active = true AND EXISTS (
  SELECT 1 FROM employee_master_data me
  WHERE me.auth_user_id = auth.uid() AND me.is_active = true
)
```

Postgres evaluerer reglen for at læse tabellen, hvilket kræver at læse tabellen → rekursion → 500 på hver forespørgsel.

## Løsning
1. Opret hjælpefunktion `public.is_active_employee(uuid)` som `SECURITY DEFINER` med fast `search_path`. Den svarer "er denne auth-bruger en aktiv medarbejder?" uden at trigge adgangsreglerne, og dermed uden rekursion.
2. Erstat reglen `Employees can view active colleagues` med samme regel, hvor subquery'en udskiftes med `public.is_active_employee(auth.uid())`. Adgangsniveauet er uændret: aktive medarbejdere kan fortsat se aktive kollegaer.
3. Giv kun `authenticated` ret til at kalde funktionen (ikke anonyme).
4. Verificér: kør et opslag mod stamdata og bekræft 200 i stedet for 500, og at "Alle medarbejdere"/"Personale" viser rækker igen.

## Bemærkning om følsomme felter
Den eksisterende kollega-regel giver adgang til hele rækken (også CPR/bank-felter). Det er et kendt, tidligere accepteret punkt. Denne opgave retter kun rekursionen — jeg foreslår ikke at ændre feltadgangen nu, men kan lave et separat forslag om at begrænse kollega-visning til et view med kun ikke-følsomme felter.

## Teknisk
- Én migration: `CREATE OR REPLACE FUNCTION public.is_active_employee(_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public`, `DROP POLICY` + `CREATE POLICY` på `public.employee_master_data`, `REVOKE ALL ... FROM anon` / `GRANT EXECUTE ... TO authenticated`.
- Ingen frontend-ændringer nødvendige.
