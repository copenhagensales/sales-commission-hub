

# Tilføj kampagne-vælger til opstartshold-dialogen

## Oversigt
Når man opretter et forecast-opstartshold, kan man i dag ikke vælge kampagne. Det betyder at `client_campaign_id` altid er `null`, og systemet falder tilbage til en generisk profil. Vi tilføjer en kampagne-dropdown så det rigtige ramp- og survival-profil automatisk matches.

## Ændringer

### 1. `CreateCohortDialog.tsx` — Tilføj kampagne-selector
- Acceptér en ny prop: `campaigns: { id: string; name: string; clientName: string }[]`
- Tilføj state for `selectedCampaignId`
- Rendér en `Select`-dropdown med kampagner (grupperet/vist med kundenavn)
- Send `client_campaign_id: selectedCampaignId` i `onSubmit` i stedet for `null`

### 2. `EditForecastCohortDialog.tsx` — Tilføj kampagne-selector
- Samme prop og dropdown som CreateCohortDialog
- Pre-udfyld fra `cohort.client_campaign_id`
- Udvid `onSubmit` data-typen til at inkludere `client_campaign_id`

### 3. `ForecastCohortManager.tsx` — Videregivelse
- Acceptér `campaigns` prop og videregiv til begge dialoger
- Vis kampagnenavn i kohort-rækken (badge)
- Udvid `onEdit` callback-typen til at inkludere `client_campaign_id`

### 4. `Forecast.tsx` — Hent kampagner og videregiv
- Hent `client_campaigns` med `clients(name)` join
- Videregiv listen til `ForecastCohortManager`
- Opdatér `editCohort` mutation til at inkludere `client_campaign_id`

### 5. Kohort-visning — Vis kampagnenavn
I kohort-rækken vises et badge med kampagnenavn, så det er tydeligt hvilken profil der bruges.

## Berørte filer
- `src/components/forecast/CreateCohortDialog.tsx`
- `src/components/forecast/EditForecastCohortDialog.tsx`
- `src/components/forecast/ForecastCohortManager.tsx`
- `src/pages/Forecast.tsx`

## Effekt
Nye opstartshold kan nu tilknyttes en specifik kampagne. `useClientForecast` henter allerede kampagne-specifikke ramp- og survival-profiler, så det korrekte profil automatisk bruges når `client_campaign_id` er sat.

