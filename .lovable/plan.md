

## Komplet plan: Kundebevidst timeregistrering — alle huller lukket

### Formål
Vide præcis hvor mange timer hver medarbejder bruger på hver kunde. Ingen ændring af lønlogik (løn følger salget). Teams ejer kunder — det er uændret.

---

### Fase 0: Fix eksisterende trigger-fejl (KRITISK)

**`fn_auto_assign_on_new_team_member`** har byttet kolonner:
```sql
-- NUVÆRENDE (FEJL): client_id → employee_id, employee_id → client_id
SELECT tc.client_id, NEW.employee_id

-- RETTET:
SELECT NEW.employee_id, tc.client_id
```
Skal rettes i migration FØR resten, da hele assignment-grundlaget ellers er forkert.

---

### Fase 1: DB-migration

1. **`employee_client_assignments`**: Tilføj `is_primary boolean NOT NULL DEFAULT false` + partial unique index (max én primær pr. medarbejder)
2. **`time_stamps`**: Tilføj `client_id uuid REFERENCES clients(id)` + index
3. **Ny tabel `employee_client_change_log`**: `employee_id`, `old_client_id`, `new_client_id`, `changed_at`, `changed_by`, `reason` + RLS
4. **Backfill**: Medarbejdere med kun én tildeling → `is_primary = true`
5. **Fix trigger**: Ret kolonnerækkefølge i `fn_auto_assign_on_new_team_member`

After migration: Supabase types auto-regenererer og `time_stamps` typen får `client_id`.

---

### Fase 2: `useEmployeeClientAssignments.ts` — nye mutations

- `setPrimary(employeeId, newClientId)`: Swap `is_primary` + insert i `change_log`
- `addSecondary(employeeId, clientId)`: Insert assignment (`is_primary=false`) + **auto-opret** `employee_time_clocks` entry (type: `override`)
- `removeSecondary(employeeId, clientId)`: Slet assignment + **auto-slet** tilhørende `employee_time_clocks` row

---

### Fase 3: `TeamAssignEmployeesSubTab.tsx` — UI omskrivning

Fra kunde-centrisk matrix til medarbejder-centrisk:
- Primær-dropdown (teamets kunder)
- Sekundær-badges med tilføj/fjern
- Seneste kundeskift-dato fra `change_log`
- Info: "Sekundære kunder får automatisk stempelur"

---

### Fase 4: Kundebevidst stempling

**`useTimeStamps.ts`**:
- `clockIn` mutation accepterer `clientId?: string`, inserter som `client_id`
- Ny query: hent medarbejderens sekundære kunder (`employee_client_assignments WHERE is_primary = false`)
- Returner `secondaryClients` fra hooket

**`TimeStamp.tsx`**:
- Vis kunde-dropdown over stempel-knappen hvis `secondaryClients.length > 0`
- Default = ingen (primær, `client_id = null`)
- Vis kundenavn som badge på hver stempling i "Dagens stemplinger"

**`EditTimeStampDialog.tsx`**:
- Tilføj `client_id` til state
- Vis kundenavn (read-only) ved redigering
- Ved oprettelse: vis dropdown til kundevalg
- Insert/update inkluderer `client_id`

---

### Fase 5: Anti-dobbeltregistrering — `useStaffHoursCalculation.ts`

- Tilføj `clientId?: string` parameter til hook-signatur
- Tilføj `clientId` til `queryKey` (cache-separation)
- Kald `resolveHoursSourceBatch(staffIds, clientId)` med clientId
- Filtrer `time_stamps` query: `.eq("client_id", clientId)` for timestamp-mode
- I shift-mode: hent alle medarbejderens sekundære stemplinger → `netto = vagtplan - sekundær_timer`

---

### Fase 6: Downstream — alle 12 filer med `time_stamps` queries

Komplet matrix:

| Fil | Ændring |
|-----|---------|
| `useDashboardSalesData.ts` | Tilføj `client_id` i select + filter |
| `DailyReports.tsx` | Tilføj `client_id` filter |
| `ShiftOverview.tsx` | Vis kundenavn som label |
| `VagtplanFMContent.tsx` | Tilføj `client_id` i select |
| `useEffectiveHourlyRate.ts` | Filtrer på relevant `client_id` |
| `useKpiTest.ts` | Tilføj `client_id` i select + filter |
| `MyProfile.tsx` | Vis kundenavn på stemplinger |
| `EmployeeDetail.tsx` | Vis kundenavn på stemplinger |
| `EmployeeCommissionHistory.tsx` | Tilføj `client_id` i select |

---

### Fase 7: Edge functions

| Edge function | Ændring |
|---------------|---------|
| `calculate-kpi-values` | Tilføj `client_id` filter på timestamps |
| `calculate-kpi-incremental` | Tilføj `client_id` filter |
| `tv-dashboard-data` | Tilføj `client_id` filter |
| `calculate-leaderboard-incremental` | Tilføj `client_id` filter |

---

### Scope-afgrænsning: `time_entry` vs `time_stamps`

`TimeClock.tsx` bruger `time_entry`-tabellen (via `useShiftPlanning` hooks) — det er et **separat flow** til vagtplanlægning. `time_stamps` er det operative stempelur brugt af medarbejdere dagligt.

**Beslutning**: `time_entry` er **out of scope** i denne levering. Kundebevidst stempling gælder kun `time_stamps`-flowet, som er det downstream bruger til timer-beregning.

---

### Garantier

1. **Ingen dobbeltregistrering**: Primær = vagtplan minus sekundær-stemplinger. Sekundær = kun `time_stamps WHERE client_id = X`
2. **Historisk sporbarhed**: Hvert kundeskift logges med tidspunkt, gammel/ny, hvem
3. **Auto-stempelur**: Sekundær tildeling → auto-opret override clock → medarbejder ser kundevælger
4. **Cache-korrekthed**: `clientId` i queryKey forhindrer data-blanding
5. **Trigger-fix**: Assignment-grundlaget fungerer korrekt fra dag 1
6. **Type-safety**: Migration regenererer types.ts automatisk — ingen `any`-casts

