

## Fix: Visibility check constraint fejl ved "Ingen adgang"

### Problem
Databasen har en check constraint `role_page_permissions_visibility_check` der kun tillader `'all'`, `'team'` eller `'self'` som visibility-værdier. Når du vælger "Ingen adgang" sender koden `visibility: "none"` — som afvises af constrainten.

### Løsning
Ændr `accessConfig` for `none`-niveauet til at bruge `visibility: "self"` i stedet for `"none"`. Adgangen styres allerede af `can_view: false` / `can_edit: false`, så visibility-værdien er irrelevant når begge er `false`.

### Ændring

**Fil: `src/components/employees/permissions/PermissionMap.tsx`** (linje 48)

```typescript
// Fra:
none: { ..., visibility: "none" },

// Til:
none: { ..., visibility: "self" },
```

Én linje. Ingen risiko — `can_view: false` sikrer allerede at brugeren ikke har adgang.

