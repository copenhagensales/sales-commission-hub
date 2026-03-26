

## Simpelt Kundeforecast-modul — Dynamisk Intra-Month Justering

### Kerneidé: Forecast der lever med måneden

Forecast opdeles i **faktisk salg** (allerede sket) + **projected salg** (resterende vagter). Jo flere dage der er gået, jo mere fylder faktisk data og jo mindre fylder projektionen — forecast regulerer sig automatisk.

```text
Dag 1:   Forecast = 0 faktisk + 20 dage projected
Dag 10:  Forecast = 150 faktisk + 10 dage projected  
Dag 20:  Forecast = 380 faktisk + 2 dage projected ← næsten kun reel data
```

### Database: `forecast_settings`

Én række pr. team pr. måned (oprettes manuelt):

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | uuid PK | |
| team_id | uuid FK → teams | |
| month, year | int | |
| client_goal | int | Kundens salgsmål |
| sick_pct | numeric DEFAULT 0 | Forventet sygdom % |
| vacation_pct | numeric DEFAULT 0 | Forventet ferie % |
| churn_new_pct | numeric DEFAULT 0 | Churn % nye (<20 vagter) |
| churn_established_pct | numeric DEFAULT 0 | Churn % etablerede |
| new_seller_weekly_target | numeric DEFAULT 0 | Ugentligt mål for nye |
| new_seller_threshold | int DEFAULT 20 | Grænse for "ny" (vagter) |
| rolling_avg_shifts | int DEFAULT 10 | Antal vagter til gns. |
| created_by | uuid | |
| updated_at | timestamptz | |

UNIQUE: `(team_id, month, year)`. RLS: authenticated.

### Beregningslogik (dynamisk intra-month)

```text
For hver medarbejder:

  dags_dato = i dag (eller månedens sidste dag, det tidligste)
  
  FAKTISK SALG (1. → dags_dato):
    → Hent reelle salg fra sales-tabellen for denne medarbejder denne måned
  
  PROJECTED SALG (dags_dato+1 → månedens slutning):
    Hvis ny (< threshold vagter):
      → dagligt_mål = weekly_target / 5
      → projected = dagligt_mål × resterende planlagte vagter
      → × (1 - churn_new_pct/100)
    Hvis etableret (≥ threshold vagter):
      → salg/dag = gns. af seneste [rolling_avg_shifts] vagter
      → projected = salg/dag × resterende planlagte vagter
      → × (1 - churn_established_pct/100)
    
    Projected justeres: × (1 - sick_pct/100) × (1 - vacation_pct/100)

  MEDARBEJDER FORECAST = faktisk_salg + projected_salg

TOTAL FORECAST = sum(alle medarbejderes forecast)
```

**Effekt:** I starten af måneden er forecast primært baseret på projektioner. Mod slutningen er det næsten kun faktiske tal — forecast bliver mere og mere præcist.

### KPI-kort

| KPI | Beskrivelse |
|-----|-------------|
| Salg MTD | Faktiske salg til dato |
| Forecast | Faktisk + projected (dynamisk) |
| Kundens mål | Fra settings |
| Pace | Faktisk / forventet-til-dato (over/under 100%) |
| Sygdom % | Faktisk vs. forventet |
| Ferie % | Faktisk vs. forventet |

### UI: Forside (`/client-forecast`)

Grid af team-cards for alle oprettede forecasts i valgt måned. Hvert card:
- Teamnavn, kundemål, dynamisk forecast, faktisk salg MTD
- Progressbar (faktisk vs. mål)
- Status-badge: Foran / På mål / Bagud (pace-baseret)

### UI: Detalje (`/client-forecast/:id`)

- KPI-kort (6 stk)
- Settings-panel (alle parametre redigerbare pr. team)
- Medarbejder-tabel: Navn, Type, Faktisk salg, Projected, Total forecast

### Filer

```text
src/pages/ClientForecast.tsx
src/pages/ClientForecastDetail.tsx
src/hooks/useClientForecast.ts
src/hooks/useForecastSettings.ts
src/components/forecast/ForecastCard.tsx
src/components/forecast/ForecastKpiCards.tsx
src/components/forecast/ForecastSettingsPanel.tsx
src/components/forecast/ForecastEmployeeTable.tsx
src/components/forecast/CreateForecastDialog.tsx
```

### Routes + menu + permissions

- Routes: `/client-forecast` + `/client-forecast/:id`
- Sidebar: menupunkt under "Ledelse" sektionen
- Permission-key: `menu_client_forecast` under `menu_section_ledelse`

### Implementeringsrækkefølge

1. Database-migration (opret `forecast_settings` med RLS)
2. `useForecastSettings` hook (CRUD + kopiér fra forrige måned)
3. `useClientForecast` hook (dynamisk: faktisk salg + projected med alle konfigurerbare parametre)
4. Forside med team-cards + opret-dialog
5. Detalje-side med KPI, settings, medarbejder-tabel
6. Route, sidebar-link, permission-key

