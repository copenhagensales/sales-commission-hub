

# Tilføj "optjent i dag" og placeringsryk til liga-boardet

## Hvad ændres

### 1. Ny hook: `src/hooks/useLeagueTodayProvision.ts`
- Henter dagens provision for alle tilmeldte spillere via en enkelt query
- Joiner `sale_items` → `sales` → `employee_agent_mapping` → `employee_master_data` filtreret på `sale_datetime >= today` og `counts_as_sale = true`
- Returnerer `Record<employeeId, number>` (today's commission)
- Alternativt: bruger `get_sales_aggregates_v2` RPC med `groupBy: ['employee']` for dagens dato

### 2. `src/components/league/QualificationBoard.tsx`
- Modtag ny prop `todayProvisionMap: Record<string, number>`
- Send den videre til `PlayerRow`
- I `PlayerRow`: vis "I dag: X kr" under total provision (lille grøn tekst)
- Placeringsryk-indikatoren er allerede implementeret (linje 222-227), men vises kun når `previous_overall_rank !== null` — den virker allerede korrekt

### 3. `src/components/league/ActiveSeasonBoard.tsx`
- Modtag ny prop `todayProvisionMap: Record<string, number>`
- Send den videre til `SeasonPlayerRow`
- Vis "I dag: X kr" i provision-kolonnen
- Tilføj placeringsryk-indikator (op/ned-pile) baseret på `previous_division` eller tilføj `previous_overall_rank` til season standings (kræver evt. DB-ændring)

### 4. `src/pages/CommissionLeague.tsx`
- Kald `useLeagueTodayProvision(employeeIds)` med alle enrolled employee IDs
- Send `todayProvisionMap` ned til QualificationBoard og ActiveSeasonBoard

## Visuel design (inspireret af screenshot)
- Provision-kolonnen viser allerede total i fed skrift
- Tilføj en lille linje nedenunder: `"I dag: 2.450 kr"` i `text-emerald-400 text-[10px]`
- Placeringsryk: grøn pil op + antal pladser, rød pil ned + antal pladser (allerede i QualificationBoard)

## Teknisk tilgang
- Én query for alle spilleres daglige provision (grupperet pr. employee) — undgår N+1
- Stale time 60s, refetch 120s — matcher standings-refresh
- Ingen DB-migration nødvendig — bruger eksisterende salgsdata

