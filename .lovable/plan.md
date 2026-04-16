

# Plan: Vis ansøgningstekst i godkendelses-kort

## Opsummering
Tilføj et uddrag af kandidatens noter/ansøgningstekst i hvert "afventer godkendelse"-kort, så recruiter kan læse hvad kandidaten har skrevet uden at åbne profilen.

## Ændringer i `src/pages/recruitment/BookingFlow.tsx`

### 1. Udvid data-query (linje 66-70)
Tilføj `notes` til både `candidates` og `applications` select:
```
candidates!inner(id, first_name, last_name, email, phone, notes)
applications(id, role, status, notes)
```

### 2. Vis tekst i godkendelses-kortet (linje 344-355)
Under kandidatens navn/email, vis et truncated uddrag af ansøgningsteksten (candidates.notes eller applications[0].notes). Max 2-3 linjer med `line-clamp-2` styling i en lille grå tekst.

## Fil der ændres
- `src/pages/recruitment/BookingFlow.tsx`

