
# Tilfoej manglende parent-child grupper i Permission Editor

## Problem

`permissionKeys.ts` definerer at `menu_cancellations` har 3 child-faner (`tab_cancellations_manual`, `tab_cancellations_upload`, `tab_cancellations_duplicates`), men `PERMISSION_GROUPS` i `permissionGroups.ts` inkluderer ikke denne gruppe. Derfor viser rettighedseditoren ikke fanerne som en udvidbar gruppe, og de kan ikke redigeres individuelt.

## Loesning

Tilfoej `menu_cancellations` til `PERMISSION_GROUPS` i `permissionGroups.ts` saa fanerne vises korrekt under "Annulleringer" som en collapsible gruppe med individuelle toggles.

## Tekniske detaljer

**Fil:** `src/components/employees/permissions/permissionGroups.ts`

Tilfoej foelgende entry til `PERMISSION_GROUPS` objektet (efter den eksisterende `menu_fm_overview` entry):

```typescript
// Annulleringer tabs
'menu_cancellations': {
  label: 'Annulleringer',
  children: ['tab_cancellations_manual', 'tab_cancellations_upload', 'tab_cancellations_duplicates']
},
```

Ingen andre filer behoever aendring -- `PermissionRowWithChildren` og `buildCategoryTree` bruger allerede `PERMISSION_GROUPS` til at opdage og vise parent-child relationer.
