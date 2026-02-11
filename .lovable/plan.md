

## Udvid API-koden til at hente manglende data fra HeroBase

### Analyse af HeroBase API

Jeg har gennemgaaet den fulde API-dokumentation for HeroBase (Enreach). Her er de vigtigste endpoints vi kan bruge:

### Nuvaerende situation
- Vi bruger KUN `/simpleleads?Projects=*&ModifiedFrom=...&AllClosedStatuses=true`
- `Projects=*` bruger glob-syntax og BURDE matche alle projekter
- Men telefonnummer 51806520 fra "TRP - Recycling" kampagnen dukker IKKE op i de 5.053 leads der returneres

### Nye muligheder fra API-dokumentationen

HeroBase API'en har flere endpoints vi IKKE bruger i dag:

1. **`/projects`** - Returnerer alle projekter API-brugeren har adgang til (uniqueId, name, active). Dette kan bekraefte om "TRP - Recycling" overhovedet er tilgaengeligt.

2. **`/campaigns?Project=TRP*`** - Kan filtrere kampagner efter projekt med glob-syntax. Viser om TRP-kampagner er synlige.

3. **`/leads`** - Et alternativt endpoint til `/simpleleads` med flere filtermuligheder, bl.a. `searchName` (gemte soegninger) og `ModifiedFrom`. Returnerer muligvis andre data end simpleleads.

4. **`/leads/{uniqueId}`** - Kan hente et specifikt lead hvis vi kender dets ID.

5. **`/calls`** - Har `leadPhoneNumber` felt og kan filtreres paa tid. Kan bruges til at finde opkaldet og dermed leadets `uniqueLeadId`.

### Plan: Tilfoej diagnostisk projekt- og kampagne-tjek

**Fil: `supabase/functions/enreach-diagnostics/index.ts`**

Udvid den eksisterende diagnostics-funktion med tre nye tests:

- **TEST 8: Hent alle projekter** (`/projects`) - Logger alle projekter API-brugeren har adgang til, saa vi kan verificere om "TRP - Recycling" (eller lignende) er paa listen.

- **TEST 9: Hent TRP-kampagner** (`/campaigns?Project=TRP*&Active=All`) - Soeger specifikt efter kampagner under TRP-projektet.

- **TEST 10: Soeg via /calls efter telefonnummer** (`/calls?StartTime=2026-01-27&TimeSpan=3.00:00:00&Include=campaign,user`) - Soeger efter opkald i tidsperioden omkring 28. januar og filtrerer paa telefonnummer 51806520 i resultaterne. Calls-endpointet har `leadPhoneNumber` og `leadClosure` felter, saa vi kan finde salget den vej.

- **TEST 11: Proev /leads endpoint** (`/leads?ModifiedFrom=2026-01-27&PageSize=500`) - Proever det alternative leads-endpoint som muligvis returnerer data som simpleleads ikke goer.

**Fil: `supabase/functions/integration-engine/adapters/enreach.ts`**

Tilfoej en ny metode `fetchAccessibleProjects()` der kalder `/projects` og returnerer listen. Denne kan bruges til at logge hvilke projekter der er tilgaengelige under sync, og give en advarsel hvis forventede projekter mangler.

### Tekniske detaljer

```text
Nye API-kald:
  GET /projects                              -> Liste af {uniqueId, name, active}
  GET /campaigns?Project=TRP*&Active=All     -> TRP-kampagner
  GET /calls?StartTime=...&TimeSpan=...      -> Opkald med leadPhoneNumber
  GET /leads?ModifiedFrom=...                -> Alternativt lead-endpoint
```

Strategien er:
1. Foerst koer diagnostics for at bekraefte om TRP-projektet er synligt
2. Hvis det er synligt: proev `/leads` endpoint som alternativ datakilde
3. Hvis det IKKE er synligt: problemet er API-brugerens projektrettigheder (skal fixes i HeroBase admin)
4. Brug `/calls` som fallback til at finde salget via telefonnummer

### Forventet resultat
Vi faar et klart svar paa om problemet er:
- A) API-brugeren mangler adgang til TRP-projektet (skal fixes i HeroBase)
- B) `/simpleleads` returnerer ikke alle leads (skal skifte til `/leads` endpoint)
- C) Leadet kan findes via `/calls` og vi kan tilfoeje en alternativ sync-sti
