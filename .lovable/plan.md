
# Fix: Fieldmarketing Dashboard - Manglende Tab-permissions

## Rodaarsag

Ved den forrige oprydning blev `tab_fm_eesy` og `tab_fm_yousee` slettet fra baade `permissionKeys.ts` og databasen, fordi de var boern af det fjernede `menu_fm_dashboard`. Men disse keys bruges stadig aktivt af Fieldmarketing-dashboardet i dashboard-miljoeet (`/dashboards/fieldmarketing`) til at styre fane-synlighed.

Resultatet: Alle ikke-ejere (inkl. William Bornak som fm_leder) ser en tom side med "Du har ikke adgang", fordi `canView("tab_fm_eesy")` returnerer false naar keyen ikke eksisterer.

---

## AEndring 1: Tilfoej tab_fm_eesy og tab_fm_yousee tilbage i permissionKeys.ts

**Fil**: `src/config/permissionKeys.ts`

Tilfoej de to tab-keys under Fieldmarketing-sektionen (linje 237-242 omraadet). De placeres som children af et nyt dashboard-parent under FM, saa de er korrekt kategoriseret:

```text
// Under "Fieldmarketing Tabs" sektionen, tilfoej:
tab_fm_eesy: { label: 'Fane: Eesy FM Dashboard', section: 'fieldmarketing', parent: 'menu_fm_overview' },
tab_fm_yousee: { label: 'Fane: Yousee Dashboard', section: 'fieldmarketing', parent: 'menu_fm_overview' },
```

Disse placeres under `menu_fm_overview` som parent, da de er faner i FM-dashboardet.

---

## AEndring 2: Opdater permissionGroups.ts

**Fil**: `src/components/employees/permissions/permissionGroups.ts`

Fjern den foraeldre reference til `menu_fm_dashboard` (linje 36-39) som ikke laengere eksisterer, og tilfoej en ny gruppe under `menu_fm_overview`:

```text
// Fjern:
'menu_fm_dashboard': {
  label: 'FM Dashboard',
  children: ['tab_fm_eesy', 'tab_fm_yousee']
}

// Tilfoej:
'menu_fm_overview': {
  label: 'FM Oversigt',
  children: ['tab_fm_eesy', 'tab_fm_yousee']
}
```

---

## AEndring 3: Database - Indsaet manglende permission-raekker

Koer SQL for at genoprette tab-permissions for relevante roller:

```text
INSERT INTO role_page_permissions (role_key, permission_key, can_view, can_edit, visibility)
VALUES 
  ('fm_leder', 'tab_fm_eesy', true, true, 'team'),
  ('fm_leder', 'tab_fm_yousee', true, true, 'team'),
  ('assisterende_teamleder_fm', 'tab_fm_eesy', true, false, 'team'),
  ('assisterende_teamleder_fm', 'tab_fm_yousee', true, false, 'team'),
  ('ejer', 'tab_fm_eesy', true, true, 'all'),
  ('ejer', 'tab_fm_yousee', true, true, 'all')
ON CONFLICT DO NOTHING;
```

---

## Filoversigt

| Fil | AEndring |
|---|---|
| `src/config/permissionKeys.ts` | Tilfoej `tab_fm_eesy` og `tab_fm_yousee` tilbage |
| `src/components/employees/permissions/permissionGroups.ts` | Flyt tab-gruppe fra slettet parent til `menu_fm_overview` |
| Database: `role_page_permissions` | Indsaet permissions for fm_leder, assisterende_teamleder_fm og ejer |

## Effekt
- William Bornak (fm_leder) kan se Fieldmarketing-dashboardet med begge faner (Eesy FM og Yousee)
- Assisterende Teamledere FM kan ogsaa se fanerne
- Ejere paavirkes ikke (de har allerede adgang via owner-override)
- Permission Editor viser tab-permissions korrekt under Fieldmarketing-sektionen
