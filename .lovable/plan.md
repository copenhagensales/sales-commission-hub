
## Plan: Ekstra sorterings- og filtreringsmuligheder på kandidatsiden

### Hvad ændres

**Fil: `src/pages/recruitment/Candidates.tsx`**

### 1. Tilføj positionsfilter (Fieldmarketing / Salgskonsulent)

Tilføj en ny Select-dropdown ved siden af status-filteret:
- State: `positionFilter` (default `"all"`)
- Valgmuligheder: "Alle positioner", "Fieldmarketing", "Salgskonsulent" (evt. flere baseret på `applied_position`-værdier i databasen)
- Filtrer `filteredCandidates` med `candidate.applied_position?.toLowerCase()` match

### 2. Hent "sidst kontaktet" tidspunkt per kandidat

Udvid candidate-queryen eller tilføj en separat query der henter seneste `communication_logs`-entry per kandidat:
- Query `communication_logs` grupperet på `candidate_id` med `MAX(created_at)` — eller hent alle med `context_type = 'candidate'` og byg et lookup-map `candidateId → seneste kontaktdato`
- Gem som `lastContactMap: Record<string, string>`

### 3. Udvid sorteringsmuligheder

Tilføj nye valgmuligheder i sort-dropdown:
- **"Sidst kontaktet"** — sorterer efter seneste SMS/opkald (nyeste først), kandidater uden kontakt sidst
- **"Navn (A-Å)"** — alfabetisk sortering

Opdater sort-logikken i `.sort()` til at håndtere de nye muligheder ved opslag i `lastContactMap`.

### 4. Layout-justering

Udvid filter-grid fra `grid-cols-2` til `grid-cols-3` på desktop for at rumme det ekstra positions-filter.

---

### Ingen database-ændringer
Alt data findes allerede (`applied_position` på candidates, `communication_logs` med `candidate_id`). Kun UI-ændringer i én fil.
