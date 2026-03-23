

# Tilføj hotel- og diætomkostninger til Lokationsøkonomi

## Problem
Beregningen inkluderer kun sælgerløn og lokationsomkostning. Hotel og diæt mangler, så DB er højere end reelt.

## Datakilder
- **`booking_diet`**: `booking_id`, `employee_id`, `date`, `amount` — summér `amount` per booking_id
- **`booking_hotel`**: `booking_id`, `price_per_night`, `rooms`, `check_in`, `check_out` — beregn antal nætter × pris × rum per booking_id

## Ændringer i `src/pages/vagt-flow/LocationProfitabilityContent.tsx`

### 1. Hent hotel- og diætdata (2 nye queries)
- `booking_diet` filtreret på booking_ids for ugen → summér amount per booking_id
- `booking_hotel` filtreret på booking_ids for ugen → beregn total hotelomkostning per booking_id (nætter × pris_per_nat × rum)

### 2. Tilføj til beregningen
- Map hotel- og diæt-totaler til lokationer via booking_id
- Ny beregning: `DB = Omsætning − Sælgerløn − Lokationsomkostning − Hotel − Diæt`

### 3. Nye kolonner i tabellen
- Tilføj **"Hotel"** og **"Diæt"** kolonner mellem "Lokation" og "DB"
- Samme kolonner i daglig nedbrydning (expanderet visning)

### 4. KPI-kort
- Tilføj 2 nye KPI-kort: Total hotel og total diæt
- Opdatér DB-beregning i totals

| Fil | Ændring |
|-----|---------|
| `src/pages/vagt-flow/LocationProfitabilityContent.tsx` | 2 nye queries, 2 nye kolonner, opdateret DB-beregning |

