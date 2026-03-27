

## Security Fixes: Ingen Risiko + Lav Risiko

Baseret på vores gennemgang fikserer vi følgende i én omgang. Ingen af ændringerne påvirker brugeroplevelsen.

---

### 1. XSS-beskyttelse i kontrakter (Ingen risiko)
Installerer `dompurify` og saniterer al HTML før rendering i:
- `ContractSign.tsx` (linje 460)
- `Contracts.tsx` (linje 666)  
- `SendContractDialog.tsx` (linje 860)

Ændring: `dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }}`

---

### 2. Sidste Function Search Path (Ingen risiko)
Én funktion mangler stadig: `get_distinct_sales_sources()`. Migration der tilføjer `SET search_path TO 'public'`.

---

### 3. Admin Edge Functions – JWT + rolle-tjek (Lav risiko)
Tilføjer auth-validering til 3 funktioner så kun managers/owners kan kalde dem:
- **`set-user-password`** — tilføj JWT-validering + `is_owner` check
- **`create-employee-user`** — tilføj JWT-validering + `is_manager_or_above` check  
- **`delete-auth-user`** — tilføj JWT-validering + `is_owner` check

Mønsteret kopieres fra `force-password-reset` der allerede gør det korrekt. Frontend sender allerede JWT via `supabase.functions.invoke()`.

---

### 4. RLS på salary_additions (Lav risiko)
Erstatter `USING(true)` med:
- **SELECT**: `is_manager_or_above(auth.uid())` — kun ledere kan se løndata
- **INSERT/UPDATE/DELETE**: `is_owner(auth.uid())` — kun ejere kan ændre

---

### 5. RLS på agent_presence (Lav risiko)
Erstatter den public `USING(true)` policy med:
- Kun **authenticated** brugere (ikke anon)
- Medarbejdere kan kun ændre **deres egen** presence-record

---

### Teknisk oversigt

| Fix | Type | Filer |
|-----|------|-------|
| DOMPurify XSS | npm + kode | 3 tsx-filer |
| search_path | Migration | 1 SQL |
| Edge functions auth | Edge functions | 3 index.ts |
| salary_additions RLS | Migration | 1 SQL |
| agent_presence RLS | Migration | 1 SQL |

