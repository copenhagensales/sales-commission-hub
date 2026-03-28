

## Plan: Log adgang til kontrakter

### Problem
Der logges ikke hvem der åbner/ser en andens kontrakt. Det er en compliance-mangel.

### Løsning

**1. Ny database-tabel: `contract_access_log`**

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | uuid PK | |
| user_id | uuid | Den bruger der tilgik kontrakten |
| contract_id | uuid | Kontrakten der blev åbnet |
| employee_id | uuid | Medarbejderen kontrakten tilhører |
| access_type | text | "view", "sign", "download" |
| created_at | timestamptz | Tidspunkt |

RLS: Insert for authenticated, select kun for owners.

**2. Logning i `ContractSign.tsx`**

Når kontrakten er loadet og brugeren er identificeret, indsættes en log-entry. Logges kun én gang pr. page load via `useEffect`. Logger også ved PDF-download.

**3. Logning i `Contracts.tsx` (admin-side)**

Når en admin åbner preview af en kontrakt, logges det.

**4. Visning i compliance-sektionen**

Tilføj en ny side `/compliance/contract-access-log` der viser de seneste kontrakt-adgange med filtrering.

Tilføj link fra `ComplianceOverview.tsx`.

### Filer

| Fil | Handling |
|-----|---------|
| Migration | Ny tabel `contract_access_log` + RLS |
| `src/hooks/useLogContractAccess.ts` | **Ny** — hook/funktion til at logge kontrakt-adgang |
| `src/pages/ContractSign.tsx` | Tilføj logning ved load + download |
| `src/pages/Contracts.tsx` | Tilføj logning ved preview-åbning |
| `src/pages/compliance/ContractAccessLog.tsx` | **Ny** — visning af kontrakt-adgangslog |
| `src/pages/compliance/ComplianceOverview.tsx` | Tilføj link til ny log-side |
| `src/routes/pages.ts` | Tilføj lazy import |
| `src/routes/config.tsx` | Tilføj route |

### Teknisk detalje

Hook'en `useLogContractAccess`:
```text
logContractAccess(contractId, employeeId, accessType)
  → supabase.from("contract_access_log").insert(...)
```

I `ContractSign.tsx` bruges en `useEffect` der logger "view" når både `contract` og `user` er loaded. Kun logges hvis brugerens employee_id ≠ kontraktens employee_id (dvs. man logger ikke at man ser sin egen kontrakt, medmindre det ønskes).

