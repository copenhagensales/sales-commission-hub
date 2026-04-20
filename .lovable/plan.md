
Ret samme `location_id`-kun gruppering i to filer med composite key `${locId}__${clientId}`.

## Ændringer

**1. `src/pages/vagt-flow/Billing.tsx`** — `bookingsByLocation`:
- Skift gruppe-nøgle til `${locationId}__${clientId}`
- Bevar `locationName` til visning, men hver række får egen `clientName` + egne `bookedDays`
- Sales/hotel/diæt-mapping flyttes til composite key (samme attribuerings-logik som LocationProfitabilityContent: 1 klient → direkte; flere → match på `saleDate`s ugedag mod `bookedDays`)

**2. `src/pages/vagt-flow/LocationHistoryContent.tsx`** — `locAgg`:
- Skift aggregerings-nøgle fra `location_id` til `${location_id}__${client_id}`
- Vis klient-badge ved siden af lokationsnavn så Eesy/Yousee Kronen står som to historik-rækker
- Costs (hotel/diæt) og sales fordeles pr. (location, client) pr. uge

## Hvad jeg IKKE rører
- `ClientDBDailyBreakdown.tsx` — allerede korrekt (filtrerer på clientId)
- KPI-summer — uændrede totaler, blot opsplittet
- DB-skema

## Verificering
- Billing: Kronen vises som to rækker (Eesy 1 dag / Yousee 4 dage) med korrekte kostpriser
- Location History: ugehistorik viser Kronen-Eesy og Kronen-Yousee separat
- Lokationer med kun én klient: uændret
