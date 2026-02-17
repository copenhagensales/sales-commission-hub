
# Fix: Integration-engine salgssynkronisering (20-70 min forsinkelse)

## Problem
Integration-engine koerer hvert 5. minut som planlagt, men salg lander forsinket i databasen (20-70 min). Eesy rammer `maxRecords=50` loftet ved HVER koersel og processerer de samme 50 nyeste salg igen og igen uden at indhente backlog.

## Rod-aarsag
Tre samvirkende faktorer:

1. **maxRecords = 50 er for lavt** - Eesy har konsekvent 46-50 salg per koersel, hvilket betyder backlog aldrig indhentes
2. **3-dages vindue + 50-records cap** - API'et henter 3 dages data (hundredvis af salg), men kun 50 processeres. Nye salg fra i dag skal "kaempe" om plads i top-50
3. **Upsert-cyklus spild** - De samme 50 nyeste salg upsert'es igen og igen, da de allerede eksisterer. CPU-tid bruges paa at re-processere uaendrede data

## Loesning
Oeg `maxRecords` fra 50 til 200 og reducer synkroniseringsvinduet fra 3 dage til 1 dag for planlagte koersler. Dette giver 4x flere salg per koersel og reducerer datamaengden fra API'et.

## Tekniske aendringer

### Fil 1: `supabase/functions/integration-engine/index.ts`
- AEndr `effectiveMaxRecords` default fra 50 til 200
- Tilfoej intelligent vindue: brug `days = 1` for planlagte synk (cron), behold `days = 3` for manuelle koersler

### Fil 2: `supabase/functions/update-cron-schedule/index.ts`  
- AEndr cron payload til `days: 1` i stedet for `days: 2`, saa planlagte koersler kun henter 1 dags data
- Dette reducerer API-load og sikrer at de 200 records daekker alle dagens salg

### Valgfri fremtidig optimering
- Tilfoej et "last_synced_sale_datetime" felt paa integrationen saa der kun hentes salg EFTER sidste synkroniserede tidspunkt (inkrementel synk)
- Dette ville eliminere re-processing af allerede synkroniserede salg helt

## Forventet effekt
- Eesy: Fra 50 salg/koersel (med backlog) til op til 200 salg/koersel
- Nye salg vises indenfor 5-10 minutter i stedet for 20-70 minutter
- Reduceret API-belastning da kun 1 dags data hentes ved planlagte koersler
