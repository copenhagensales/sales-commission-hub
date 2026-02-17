

## Fix: Forældede parent_keys i rettighedsdatabasen + forebyggelse

### Problemet
Når rettigheder oprettes i databasen, gemmes `parent_key` (som bestemmer hvilken sektion en rettighed vises under). Men hvis hierarkiet senere ændres i koden (fx annulleringer flyttes fra "Lon" til "Rapporter"), opdateres de eksisterende database-rækker **aldrig**. Det betyder at rettigheder forsvinder fra Permission Editor for de roller, der blev oprettet for ændringen.

Konkret for annulleringer:
- `ejer` har `parent_key = 'section_salary'` (eksisterer ikke)
- `fm_leder` har `parent_key = 'menu_section_salary'` (forkert sektion)
- Begge burde have `parent_key = 'menu_section_reports'`

Der er to fejlkilder i koden:
1. **Auto-seed springer eksisterende rækker over** uden at tjekke om deres `parent_key` er korrekt
2. **Kopiering af roller** kan viderefoere forældede `parent_key`-værdier fra kilderollen

### Losning

**1. Database-migration: Ret alle forkerte parent_keys**

En enkelt SQL-sætning retter alle rækker i `role_page_permissions` hvor `parent_key` ikke matcher den autoritative konfiguration i koden. De tre specifikke rettelser:

```sql
UPDATE role_page_permissions 
SET parent_key = 'menu_section_reports' 
WHERE permission_key = 'menu_cancellations' 
AND (parent_key IS NULL OR parent_key != 'menu_section_reports');
```

**2. Auto-korrektion i PermissionEditor.tsx**

Udvid `useEffect` (auto-seed ved rollevalg) til ogsaa at opdatere rækker med forkert `parent_key`. Naar en rolle vælges:
- Sammenlign eksisterende `parent_key`-værdier med `PERMISSION_HIERARCHY`
- Opdater rækker der afviger med den korrekte værdi
- Invalider query-cache saa UI opdateres

```typescript
// I useEffect (linje 428-439), efter seed-logikken:
const existingPermissions = permissionsByRole[selectedRole] || [];
const stalePermissions = existingPermissions.filter(p => {
  const correctParent = PERMISSION_HIERARCHY[p.permission_key] ?? null;
  return p.parent_key !== correctParent;
});

if (stalePermissions.length > 0) {
  Promise.all(stalePermissions.map(p =>
    supabase.from('role_page_permissions')
      .update({ parent_key: PERMISSION_HIERARCHY[p.permission_key] || null })
      .eq('id', p.id)
  )).then(() => {
    queryClient.invalidateQueries({ queryKey: ['page-permissions'] });
  });
}
```

**3. Fix copyPermissionsFromRole**

I `copyPermissionsFromRole` (linje 396), brug altid den autoritative `PERMISSION_HIERARCHY` som kilde i stedet for at kopiere den potentielt forældede `parent_key` fra kilderollen:

```typescript
// Aendr fra:
parent_key: p.parent_key || PERMISSION_HIERARCHY[p.permission_key] || null,
// Til:
parent_key: PERMISSION_HIERARCHY[p.permission_key] ?? p.parent_key ?? null,
```

### Resultat
- Annulleringsrettigheder vises korrekt under "Rapporter" for alle roller
- Fremtidige hierarki-ændringer i `permissionKeys.ts` korrigeres automatisk i databasen naar en rolle åbnes i Permission Editor
- Kopiering af roller bruger altid det nyeste hierarki

