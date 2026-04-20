

## Årsag
"Kronen" har **to bookinger** i uge 17:
- **Eesy FM**: mandag (`booked_days: [0]`) — 1 dag
- **Yousee**: tirs–fre (`booked_days: [1,2,3,4]`) — 4 dage

I `LocationProfitabilityContent.tsx` (linje 363-371) grupperes alle bookinger på samme `location_id` sammen, og `bookedDays` mergees til ét sæt. Resultat: `[0,1,2,3,4]` = **5 dage**, og lokationsomkostning beregnes som `dailyRate × 5`.

Derudover bliver `clientName` og `dailyRate` overskrevet/blandet mellem de to klienter (sidste booking vinder for `dailyRate` hvis der er override, ellers beholdes første) — så Kronen vises som én række med blandet data fra både Eesy og Yousee.

## Foreslået løsning
Splittet visningen så samme location vises som **separate rækker pr. klient** (én række for Eesy FM Kronen, én for Yousee Kronen). Det giver:
- Korrekt dage-tælling pr. klient (1 vs 4)
- Korrekt lokationsomkostning pr. klient
- Korrekt klient-badge og DB pr. klient
- Korrekt fordeling under Eesy/Yousee KPI-sektionerne

## Ændring (én fil)

**`src/pages/vagt-flow/LocationProfitabilityContent.tsx`** — `locationData` useMemo:

1. Skift gruppe-nøgle fra `locId` til `${locId}__${clientId}` i `locationMap`.
2. Sales-mapping (linje 374-403): map salg til `locId__clientId`-nøgler. Da `raw_payload.fm_location_id` ikke indeholder klient, bruges booking→client-mapping: hvis kun én booking findes for `(locId, clientId)`, attribueres salget direkte; ellers fordeles ud fra hvilken klient der har bookede dage på `saleDate`.
3. `hotelCostByLocation` / `dietCostByLocation`: skift til `${locId}__${clientId}` via `bookingToLocationClient`-map.
4. `placementsByLocation`: uændret — placements er per location, ikke per klient.
5. Output bevarer `locationName` til visning, men hver række har sin egen `clientName` og `bookedDays`.

## Hvad jeg IKKE rører
- KPI-summer / split-logik (`eesyLocations`, `youseeLocations`) — virker uændret når hver række har én klient.
- Database-skema, andre faner.

## Verificering
- Kronen Eesy FM: 1 dag, 2.217 kr lokation
- Kronen Yousee: 4 dage, 4× 2.217 kr lokation + hotel/diæt korrekt
- Lokationer med kun én klient: uændret visning
- Total DB i bunden: uændret (samme tal, blot opdelt)

