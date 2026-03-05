

## Debug: Emma Sylvest kan ikke se kontrakter under profil

### Analyse
Database og RLS er korrekt konfigureret:
- Emma har `auth_user_id` korrekt linket
- 2 kontrakter eksisterer med hendes `employee_id`
- `get_current_employee_id()` er `SECURITY DEFINER` og burde virke
- RLS policies på `contracts` og `contract_signatures` ser korrekte ud

Fejlen er sandsynligvis en stille fejl i enten employee-lookup eller contracts-query der sker client-side. For at diagnosticere og samtidig gøre koden mere robust:

### Plan

**Fil: `src/pages/MyProfile.tsx`**

1. **Tilføj console.log** til contracts-queryen for at logge hvad der returneres (og eventuelle fejl)
2. **Brug `auth_user_id` som primær lookup** for employee i stedet for email-matching via `.or()`. Emmas `auth_user_id` er allerede linket, og dette eliminerer potentielle problemer med PostgREST filter-parsing af email-adresser med punktummer
3. **Fallback til email-matching** hvis `auth_user_id` ikke finder en record (bagudkompatibilitet)

Ændringen i employee-lookup (linje ~225-233):
```typescript
// Primary: lookup by auth_user_id
const { data: userData } = await supabase.auth.getUser();
if (!userData.user) return null;

let data, error;

// Try auth_user_id first (most reliable)
({ data, error } = await supabase
  .from("employee_master_data")
  .select("*")
  .eq("auth_user_id", userData.user.id)
  .maybeSingle());

// Fallback to email matching
if (!data && !error) {
  const lowerEmail = userData.user.email?.toLowerCase() || '';
  ({ data, error } = await supabase
    .from("employee_master_data")
    .select("*")
    .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
    .maybeSingle());
}
```

Plus debug logging i contracts-queryen for at bekræfte data hentes korrekt.

Ingen database-ændringer. Ingen nye filer.

