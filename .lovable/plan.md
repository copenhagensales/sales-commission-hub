
# Plan: Vis Dashboard-rettigheder i Permission Editor

## Problem Identificeret
`PermissionsTab.tsx` (linje 252) har en **tom array** for `menu_section_dashboards`:
```typescript
menu_section_dashboards: [], // Administreres i dashboard-miljøet
```

Dette forhindrer UI'et i at vise dashboard-relaterede rettigheder (`menu_dashboards`, `menu_dashboard_admin`, etc.) selvom de eksisterer i databasen og er defineret i `permissionKeys.ts`.

## Løsning
Opdater `sectionChildren` i `PermissionsTab.tsx` til at inkludere de korrekte dashboard-rettigheder:

```typescript
menu_section_dashboards: [
  'menu_dashboards',
  'menu_dashboard_admin',
  'menu_tv_board_admin',
  'menu_dashboard_settings'
],
```

## Fil der Ændres

| Fil | Ændring |
|-----|---------|
| `src/components/employees/PermissionsTab.tsx` (linje 252) | Tilføj dashboard children keys |

## Forventet Resultat
- **Dashboards-sektionen** vil vise 4 rettigheder i stedet for 0
- **Administratorer** kan nu se og redigere dashboard-adgang for alle roller
- **Medarbejder-rollen** vil vise den eksisterende `menu_dashboards: can_view = true` toggle

## Tekniske Detaljer
Ændringen synkroniserer `sectionChildren` med den centrale `permissionKeys.ts` konfiguration, som allerede definerer disse børn-rettigheder under `menu_section_dashboards` via `parent`-feltet.
