

# Fortrolige kontrakter — Sikring på alle niveauer

## Problem
Selv med et `is_confidential`-flag kan andre ejere, teamledere og rekruttering stadig se kontrakten via medarbejderdetaljer (`/employees/:id`), medarbejderlisten (kontraktikon), og `/contracts`-oversigten. Sikringen skal ske i databasen (RLS), så det er umuligt at hente data uanset hvilken side man er på.

## Nuværende RLS-policies på `contracts`

| Policy | Adgang |
|--------|--------|
| Owners can manage all contracts | ALL for ejere |
| Teamledere can view team contracts | SELECT for teamledere |
| Rekruttering can view/send contracts | SELECT + INSERT |
| Employees can view their own contracts | SELECT egen |
| Employees can update their pending contracts | UPDATE egen |

## Løsning

### 1. Database-migration

**Ny kolonne:**
```sql
ALTER TABLE contracts ADD COLUMN is_confidential BOOLEAN DEFAULT false;
```

**Ny security definer funktion:**
```sql
can_access_confidential_contract(_user_id uuid) RETURNS boolean
```
Returnerer `true` kun hvis brugerens auth email er `km@copenhagensales.dk` eller `mg@copenhagensales.dk`.

**Opdaterede RLS-policies — tilføj fortrolighedsfilter:**
- **Owners**: `is_owner(auth.uid()) AND (NOT is_confidential OR can_access_confidential_contract(auth.uid()))`
- **Teamledere**: Tilføj samme `AND (NOT is_confidential OR ...)`-filter
- **Rekruttering**: Tilføj samme filter
- **Employees own contracts**: INGEN ændring — medarbejderen kan altid se sine egne kontrakter

### 2. Frontend-ændringer

**`SendContractDialog.tsx`:**
- Tilføj "Fortrolig"-toggle, kun synlig for km@/mg@

**`Contracts.tsx`:**
- Vis lås-ikon ved fortrolige kontrakter

**`EmployeeMasterData.tsx`:**
- Kontraktstatusikon: RLS filtrerer automatisk, så fortrolige kontrakter ikke indgår i status-visningen for uautoriserede

**`EmployeeDetail.tsx`:**
- RLS filtrerer automatisk — ingen kodeændring nødvendig

### 3. Sikkerhedsmodel

```text
Hvem kan se en fortrolig kontrakt?
├── Medarbejderen selv (altid)
├── km@copenhagensales.dk
└── mg@copenhagensales.dk

Hvem kan IKKE se den?
├── Andre ejere
├── Teamledere
├── Rekruttering
└── Alle andre
```

Emails er hardkodet i en database-funktion (security definer) — ikke i frontend. Adgangen håndhæves på RLS-niveau, så det er umuligt at omgå via API eller anden side.

### Filer der ændres
- **Migration (ny):** Kolonne, funktion, opdaterede RLS-policies
- `src/components/contracts/SendContractDialog.tsx` — Fortrolig-toggle
- `src/pages/Contracts.tsx` — Lås-badge

