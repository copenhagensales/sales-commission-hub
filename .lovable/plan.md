

# Ny fane: Lokationsøkonomi (FM Location Profitability)

## Hvad der bygges
En ny "Lokationsøkonomi" fane i BookingManagement, der viser rentabiliteten per lokation per uge med daglig nedbrydning.

### Overblik
For en valgt uge vises alle lokationer med bookinger, og for hver lokation beregnes:
- **Omsætning** (revenue fra salg på lokationen)
- **Sælgeromkostninger** (provision + 12,5% feriepenge)
- **Lokationsomkostning** (dagspris × antal bookede dage)
- **DB (Dækningsbidrag)** = Omsætning − Sælgeromkostninger − Lokationsomkostning

Brugeren kan klikke på en lokation for at se daglig nedbrydning med samme kolonner.

### Datakilder
- **Bookinger**: `booking` tabel med `location_id`, `booked_days`, `daily_rate_override`, `week_number`, `year`
- **Lokationer**: `location` tabel (navn, dagspris)
- **Salg**: `sales` via `raw_payload.fm_location_id` + `sale_items` for provision/omsætning — hentes via `get_sales_aggregates_v2` RPC grupperet per dato, filtreret på agent_emails fra `booking_assignment`
- **Alternativ salgskobling**: Da FM-salg har `fm_location_id` i raw_payload, kan vi direkte matche salg til lokationer via dette felt og summere `sale_items` per lokation per dag

### Tilgang til salgsdata per lokation
FM-salg gemmer `fm_location_id` i `raw_payload`. Vi henter alle FM-salg i ugen og grupperer dem per lokation_id via en direkte query mod `sales` + `sale_items` med filter på `raw_payload->>'fm_location_id'`.

## Filer

| Fil | Ændring |
|-----|---------|
| `src/pages/vagt-flow/LocationProfitabilityContent.tsx` | Ny komponent: ugeoversigt per lokation med KPI-kort og tabel |
| `src/pages/vagt-flow/BookingManagement.tsx` | Tilføj ny fane "Økonomi" med BarChart-ikon |
| `src/routes/pages.ts` | Lazy-load af ny komponent |

### Komponent-design: `LocationProfitabilityContent`

**Uge-selector** øverst (genbruger week/year fra URL params).

**KPI-kort**: Total omsætning, total omkostning, total DB, antal lokationer, DB%.

**Tabel per lokation**:
| Lokation | Dage | Omsætning | Sælgerløn | Lokationsomkostning | DB | DB% |
Klikbar → ekspanderer til daglig visning med samme kolonner.

**Daglig nedbrydning** (inline expand):
| Dato | Salg | Omsætning | Sælgerløn | Lokationsomkostning | DB |

### Datahentning
1. Hent bookinger for den valgte uge: `booking` med `week_number` + `year`, join `location` for navn/dagspris
2. Hent alle FM-salg i ugens datointerval via custom query der JOINer `sales` → `sale_items`, grupperet per `raw_payload->>'fm_location_id'` og dato
3. Match salg til lokationer og beregn provision + 12,5% feriepenge som sælgeromkostning
4. Lokationsomkostning = dagspris × antal bookede dage i ugen

### Yderligere idéer til FM-overblik
- **Trend over tid**: Tilføj en graf der viser DB per lokation over flere uger, så man kan se om en lokation bliver mere eller mindre rentabel
- **Sælger-performance per lokation**: Hvem sælger bedst på hvilke lokationer
- **Røde/grønne markeringer**: Automatisk highlighting af urentable lokationer (negativ DB)
- **Sammenligning**: Side-by-side af to uger for samme lokation

Disse kan tilføjes som udvidelser senere.

