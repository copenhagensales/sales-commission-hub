

## Fix: Forældede parent_keys i rettighedsdatabasen + forebyggelse

### Oversigt
Tre ændringer sikrer at rettigheder altid vises under den korrekte sektion, selv når hierarkiet ændres i koden.

### Trin

**1. Database-opdatering**
Ret alle eksisterende `menu_cancellations`-rækker til den korrekte parent:
```sql
UPDATE role_page_permissions 
SET parent_key = 'menu_section_reports' 
WHERE permission_key = 'menu_cancellations' 
AND (parent_key IS NULL OR parent_key != 'menu_section_reports');
```

**2. Auto-korrektion ved rollevalg (PermissionEditor.tsx, linje 428-439)**
Udvid `useEffect` til at finde og rette rækker med forældet `parent_key` ved at sammenligne mod `PERMISSION_HIERARCHY`. Opdaterer i baggrunden og invaliderer cache.

**3. Fix copyPermissionsFromRole (PermissionEditor.tsx, linje 396 + PermissionEditorV2.tsx, linje 299)**
Prioriter den autoritative `PERMISSION_HIERARCHY` over kilderollens `parent_key`:
```
// Fra: p.parent_key || PERMISSION_HIERARCHY[...] || null
// Til: PERMISSION_HIERARCHY[...] ?? p.parent_key ?? null
```

### Tekniske detaljer

Berørte filer:
- `src/components/employees/permissions/PermissionEditor.tsx` (linje 396 og 428-439)
- `src/components/employees/permissions/PermissionEditorV2.tsx` (linje 299)
- Database: `role_page_permissions` tabel (data-opdatering)

