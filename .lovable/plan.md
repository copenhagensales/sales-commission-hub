
# Plan: Fjern Dashboard-rettigheder fra Permission Editor (Komplet Oprydning)

## Problemanalyse

Du kan stadig se dashboard-rettigheder fordi:

| Problem | Årsag |
|---------|-------|
| **99 database-rækker** | `role_page_permissions` indeholder stadig `menu_dashboard_*` og `tab_dashboard_*` entries |
| **Ingen frontend-filter** | `PermissionEditor.tsx` viser ALLE permissions fra databasen uden at filtrere mod `permissionKeys.ts` |
| **Gamle ikon-mappings** | `PermissionsTab.tsx` har stadig dashboard-ikoner i `permissionIconMap` (linje 144-154) |

---

## Løsning

### Fase 1: Database-oprydning

Slet de uønskede rækker fra `role_page_permissions`:

```sql
DELETE FROM role_page_permissions 
WHERE permission_key LIKE 'menu_dashboard_%'
   OR permission_key LIKE 'tab_dashboard_%';
```

Dette fjerner ca. 99 rækker (alle dashboard-specifikke permissions undtagen `menu_dashboards`).

### Fase 2: Tilføj Frontend-filter i PermissionEditor.tsx

Tilføj et filter der kun viser permissions som er defineret i `permissionKeys.ts`:

**Linje ~310-314 - Efter `permissionsByRole` skabes:**

```typescript
// Group permissions by role
const permissionsByRole = extendedPermissions.reduce((acc, p) => {
  if (!acc[p.role_key]) acc[p.role_key] = [];
  // FILTER: Only include permissions that are defined in permissionKeys.ts
  if (ALL_PERMISSION_KEYS.includes(p.permission_key as any)) {
    acc[p.role_key].push(p);
  }
  return acc;
}, {} as Record<string, typeof extendedPermissions>);
```

Dette sikrer at selvom databasen har "gamle" keys, vises de ikke i UI'et.

### Fase 3: Ryd op i PermissionsTab.tsx

Fjern de ubrugte dashboard-ikoner fra `permissionIconMap` (linje 144-154):

**Før:**
```typescript
// DASHBOARDS
menu_section_dashboards: <Monitor className="h-4 w-4" />,
menu_dashboard_cph_sales: <BarChart3 className="h-4 w-4" />,
menu_dashboard_cs_top_20: <Trophy className="h-4 w-4" />,
menu_dashboard_fieldmarketing: <Car className="h-4 w-4" />,
menu_dashboard_eesy_tm: <BarChart3 className="h-4 w-4" />,
menu_dashboard_tdc_erhverv: <Phone className="h-4 w-4" />,
menu_dashboard_relatel: <BarChart3 className="h-4 w-4" />,
menu_dashboard_united: <Building2 className="h-4 w-4" />,
menu_dashboard_design: <Settings className="h-4 w-4" />,
menu_dashboard_settings: <Settings className="h-4 w-4" />,
```

**Efter:**
```typescript
// DASHBOARDS (individuelle dashboards administreres i dashboard-miljøet)
menu_section_dashboards: <Monitor className="h-4 w-4" />,
menu_dashboards: <Monitor className="h-4 w-4" />,
```

---

## Filer der Ændres

| Fil | Ændring |
|-----|---------|
| **Database** | Slet 99 rækker med `menu_dashboard_%` og `tab_dashboard_%` |
| `src/components/employees/permissions/PermissionEditor.tsx` | Tilføj filter mod `ALL_PERMISSION_KEYS` |
| `src/components/employees/PermissionsTab.tsx` | Fjern ubrugte dashboard-ikoner |

---

## Forventet Resultat

Efter ændringerne vil Dashboards-sektionen i permission editoren kun vise:

```
Dashboards
└── menu_dashboards (Dashboards generelt) - kontrollerer miljø-adgang
```

Individuelle dashboard-rettigheder administreres nu udelukkende via:
- Dashboard-miljøets indstillinger
- `team_dashboard_permissions` tabellen
- `DashboardPermissionsTab.tsx` UI

---

## Sikkerhedsgaranti

Filteret i frontend sikrer at selvom nogen manuelt tilføjer ugyldige keys i databasen, vil de aldrig vises i UI'et - kun keys defineret i `permissionKeys.ts` vises.
