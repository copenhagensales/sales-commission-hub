

# Vis alle kolonner + berig med sælgernavn i "Fejl i match"

## Problem
1. Tabellen viser kun de første 6 kolonner fra upload-data — resten skjules.
2. Der er ingen mulighed for at berige rækker med sælgernavn baseret på "Operator"-feltet eller lignende.

## Ændringer i `MatchErrorsSubTab.tsx`

### 1. Vis ALLE kolonner fra upload-data
- Fjern `displayKeys = allKeys.slice(0, 6)` begrænsningen.
- Brug `allKeys` direkte i tabelvisningen, så alle kolonner fra Excel-filen vises.

### 2. Tilføj sælgernavn-berigelse via `useAgentNameResolver`
- Import og brug `useAgentNameResolver` hook.
- For hver række: find det felt der mest sandsynligt indeholder sælger-info (typisk "Operator" eller lignende).
- Tilføj en **"Sælger"** kolonne i tabellen der viser `resolve(row.rowData["Operator"])` — resolver agent-identifikator til fuldt medarbejdernavn.
- Da kolonne-navne kan variere mellem uploads, scan `allKeys` for sandsynlige sælger-felter ("Operator", "Agent", "Sælger", "agent_email" osv.) og brug det fundne felt.

### 3. Fjern redundante meta-kolonner
- Fjern "Fil" og "Upload dato" kolonnerne fra tabellen, da de er metadata og ikke fra selve upload-filen. Alle rækker fra samme upload har samme fil/dato alligevel.
- Behold "Type" badge.

### 4. Layout
- Da der nu kan være mange kolonner, sørg for horisontal scroll med `overflow-x-auto`.

## Fil
`src/components/cancellations/MatchErrorsSubTab.tsx`

