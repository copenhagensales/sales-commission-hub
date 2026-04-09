

## Plan: Split DB-oversigt per klient + team-badge på lokationer

### Hvad ændres

**Fil: `src/pages/vagt-flow/LocationProfitabilityContent.tsx`**

### 1. Hent `client_id` og klientnavn fra bookings

Udvid booking-queryen (linje 84-91) til også at selecte `client_id` og joine klientnavnet:

```
.select("id, location_id, booked_days, daily_rate_override, placement_id, start_date, end_date, client_id, client:clients!client_id(name), location!inner(id, name, daily_rate)")
```

### 2. Tilføj klientnavn til `LocationSalesData` interface

Tilføj `clientName: string` til interfacet, og sæt det fra booking-data i `locationMap`-opbygningen.

### 3. Vis team-badge på hver lokationsrække

I tabellen (linje 502-506) tilføj en farvekodet badge ved siden af lokationsnavnet:
- **Eesy FM** → grøn/teal badge
- **Yousee** → blå badge

### 4. Split KPI-kort per klient

Over den samlede KPI-sektion (eller som erstatning), tilføj to sektioner med per-klient totaler:
- Beregn `eesyLocations` og `youseeLocations` ved at filtrere `locationData` på `clientName`
- Vis separate KPI-kort (Omsætning, Sælgerløn, Lokation, Hotel, Diæt, DB, DB%) for hver klient
- Behold den samlede total som et samlet overblik

### 5. Gruppér lokationstabellen per klient

Tilføj en visuel separator/header-række i tabellen der grupperer lokationer under "Eesy FM" og "Yousee", med subtotaler for hver gruppe.

---

### Hvad ændres IKKE
- Ingen ændring i beregningslogik (DB, provision, omsætning)
- Ingen ændring i data — kun visuel gruppering
- Ingen ændring i placement/diet/hotel logik
- Kun én fil ændres: `LocationProfitabilityContent.tsx`

