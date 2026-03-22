
Jeg har fundet den konkrete fejl.

## Hvad der faktisk sker
- Ligaens data er ikke tomme i kilden.
- Den centrale salgs-RPC returnerer rigtige tal for kvalifikationsperioden.
- Men `league_qualification_standings` er blevet overskrevet med **0 på alle 69 rækker**.
- Edge logs viser årsagen tydeligt:
  ```text
  invalid input syntax for type timestamp with time zone:
  "2026-03-22T00:00:00+00:00T23:59:59"
  ```
- Så problemet er ikke dagsrapporterne eller salgsdataene. Problemet er, at liga-beregneren bygger en ugyldig slutdato, får RPC-fejl, og gemmer 0’er bagefter.

## Plan
### 1. Ret kvalifikations-beregneren, så den bruger en gyldig datoperiode
I `supabase/functions/league-calculate-standings/index.ts`:
- normalisér `qualification_source_start` / `qualification_source_end` korrekt
- stop med at concatenere `T23:59:59` på en værdi, der allerede er en timestamp
- brug én tydelig helper til at lave:
  - start = start på dagen
  - slut = slut på dagen for league-perioden

### 2. Brug én samlet RPC pr. periode i stedet for 1 kald pr. medarbejder
I stedet for mange per-player RPC-kald:
- kald `get_sales_aggregates_v2` **én gang** med `p_group_by: "employee"`
- filtrér resultatet ned til tilmeldte spillere
- map `group_key -> employee_id`
- skriv standings ud fra den samlede RPC

Det giver:
- samme sandhed som dagsrapporter
- færre fejlmuligheder
- hurtigere og mere stabil beregning

### 3. Fail-safe: gem aldrig 0’er hvis beregningen fejler
Tilføj guard i samme funktion:
- hvis RPC fejler, eller hvis alle spillere ender med 0 trods fejl i loggen, så **abortér uden upsert**
- returnér fejlstatus i stedet for at overskrive eksisterende standings

Det er vigtigt, så ligaen aldrig igen “ser tom ud” på grund af en beregningsfejl.

### 4. Kør en genberegning med det samme efter fix
Når funktionen er rettet:
- trig `league-calculate-standings` igen for den aktive sæson
- så de nuværende 0-rækker bliver erstattet af de rigtige provisions-tal

### 5. Fremtidssikring
Gennemgå `supabase/functions/league-process-round/index.ts` for samme datonormalisering, så runde-beregninger ikke får samme fejl senere, når sæsonen går i aktiv fase.

## Hvad jeg forventer efter fix
- Ligaens kvalifikationstal matcher dagsrapporter for samme periode
- spillere som Theo, Matias, Noa osv. får deres rigtige provision tilbage i ligaen
- ligaen overskriver ikke længere med 0 ved RPC-fejl

## Filer
- `supabase/functions/league-calculate-standings/index.ts`
- evt. `supabase/functions/league-process-round/index.ts`

## Validering efter implementering
Jeg vil validere sådan:
1. kalde beregneren manuelt for aktiv sæson
2. kontrollere at `league_qualification_standings.current_provision` ikke længere er 0 for alle
3. sammenligne top 5 i ligaen mod `get_sales_aggregates_v2` for præcis samme kvalifikationsperiode
4. bekræfte at logs ikke længere viser timestamp-fejlen
