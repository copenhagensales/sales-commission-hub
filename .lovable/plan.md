

## Plan: Audit-logning af adgang til følsomme medarbejderdata

### Problem
Systemet maskerer CPR, bankoplysninger og andre følsomme felter i UI, men logger **ikke** hvem der tilgår dem. DPIA-dokumentationen påstår logning eksisterer — det gør den ikke.

### Løsning

**1. Ny database-tabel: `sensitive_data_access_log`**

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | uuid | PK |
| user_id | uuid | Auth user der tilgik data |
| employee_id | uuid | Medarbejder hvis data blev set |
| field_accessed | text | Felt (cpr_number, bank_account_number osv.) |
| access_type | text | "view" eller "edit" |
| created_at | timestamptz | Tidspunkt |

RLS: Kun owners kan læse loggen. Insert tilladt for authenticated.

**2. Hook: `useLogSensitiveAccess`**

Simpel hook der kalder Supabase insert når et maskeret felt "afsløres" (klik på rediger):

```text
useLogSensitiveAccess(employeeId, fieldName, accessType)
  → supabase.from("sensitive_data_access_log").insert(...)
```

**3. Integration i eksisterende komponenter**

- `EmployeeDetail.tsx`: Log når bruger klikker "rediger" på masked felter (CPR, reg.nr, kontonummer)
- `MyProfile.tsx`: Log når bruger redigerer egne følsomme felter (access_type = "self_edit")

**4. Visning i compliance-sektionen**

- Ny fane eller sektion under `/compliance` der viser de seneste 100 adgange til følsomme data
- Filtrering på medarbejder, felt og tidsperiode

**5. Ret DPIA-dokumentationen**

- Opdater `DpiaDocumentation.tsx` så den matcher den faktiske implementering

### Filer

| Fil | Handling |
|-----|---------|
| Migration | Ny tabel `sensitive_data_access_log` + RLS |
| `src/hooks/useLogSensitiveAccess.ts` | **Ny** — logning-hook |
| `src/pages/EmployeeDetail.tsx` | Tilføj logning ved edit af masked felter |
| `src/pages/MyProfile.tsx` | Tilføj logning ved self-edit |
| `src/pages/compliance/DpiaDocumentation.tsx` | Opdater til at matche virkeligheden |
| `src/pages/compliance/` (ny komponent) | Visning af audit-log for følsomme data |

