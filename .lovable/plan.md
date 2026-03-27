

## Fix: Brug upsert i stedet for insert ved oprettelse af rettigheder

### Problem
Fejlen "duplicate key value violates unique constraint" opstår fordi rækken allerede findes i `role_page_permissions`-tabellen (med en anden kombination af `can_view`/`can_edit`/`visibility`), men koden forsøger at lave en `INSERT`. Det sker typisk når en rettighed tidligere er blevet oprettet men vises som "manglende" i kortet.

### Løsning
Ændr `.insert()` til `.upsert()` med `onConflict: 'role_key,permission_key'` i `handleCreateAndSetAccess`-funktionen. Så vil den opdatere den eksisterende række i stedet for at fejle.

### Ændring

**Fil: `src/components/employees/permissions/PermissionMap.tsx`** (linje 118-128)

Erstat:
```typescript
const { error } = await supabase
  .from("role_page_permissions")
  .insert({...})
```

Med:
```typescript
const { error } = await supabase
  .from("role_page_permissions")
  .upsert({...}, { onConflict: 'role_key,permission_key' })
```

Det er én linje der ændres. Ingen risiko — upsert opfører sig som insert når rækken ikke findes, og som update når den gør.

