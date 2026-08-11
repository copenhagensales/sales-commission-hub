# Fix: "112 tilmeldte" i kvalifikationsrunden

## Symptom
Tilmeldte i Sæson 4 er reelt 58, men UI viser 112.

## Evidens
- `league_enrollments` (sæson 4, aktive): **58** rækker.
- `league_qualification_standings` (sæson 4): **112** rækker, hvoraf **55** ikke har nogen aktiv tilmelding.
- UI tæller stillingerne, ikke tilmeldingerne: `src/pages/CommissionLeague.tsx:703` → `{standings?.length || 0} tilmeldte`.
- Oprydningen i `supabase/functions/league-calculate-standings/index.ts:359-379` sletter kun stillinger for medarbejdere der har en tilmelding med `is_active = false`. Ved oprydningen blev tilmeldingsrækkerne **slettet**, så de 55 forældede stillinger blev aldrig fjernet.

## Rod-årsag
Stillingstabellen ryddes ud fra "inaktive tilmeldinger" i stedet for "ingen aktiv tilmelding". Slettede tilmeldinger efterlader derfor spøgelsesrækker, som UI tæller som tilmeldte.

## Løsning
1. Ret oprydningen i `league-calculate-standings` til at slette alle stillinger i sæsonen hvis `employee_id` ikke er blandt de aktive tilmeldte (`.not("employee_id", "in", (...aktive ids))`), i stedet for kun de eksplicit inaktive. Samme rettelse anvendes for runde-stillinger hvis samme mønster findes der.
2. Genudrul funktionen og kør den én gang manuelt, så de 55 spøgelsesrækker forsvinder → visningen bliver 58.
3. Verificér: antal rækker i `league_qualification_standings` = antal aktive tilmeldinger, og UI viser samme tal.

Ingen ændring af tilmeldingslogikken (trigger + salgs-opsamling) og ingen UI-tekstændringer.

## Teknisk detalje
- Fil: `supabase/functions/league-calculate-standings/index.ts` (trin 8, linje 359-379).
- Fil (visning, uændret): `src/pages/CommissionLeague.tsx:703`.
- Zone: gul (liga/dashboard-lag, ingen løn- eller pricing-logik).
- Én commit.
