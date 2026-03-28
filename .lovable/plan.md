

## Compliance-sider: Synlighed for de rigtige roller

### Problem
Compliance-siderne vises **ikke** korrekt for nogen bruger lige nu fordi:
1. **Ingen rettigheder i databasen** — der er 0 rækker i `role_page_permissions` for compliance-nøglerne
2. **Sidebar-linket vises altid** — ingen permission-check på "Compliance" i sidebaren
3. **Oversigten viser alle kort** — ComplianceOverview tjekker ikke om brugeren har adgang til undersiderne

### Plan

**Trin 1: Opret rettigheder i databasen**
Indsæt `role_page_permissions` for alle roller med den korrekte adgang:

| Permission key | Alle (medarbejder+) | Kun ledere/HR/rekr. | Kun ejer/admin/HR |
|---|---|---|---|
| `menu_section_compliance` | ✅ can_view | ✅ can_view | ✅ can_view |
| `menu_compliance_overview` | ✅ can_view | ✅ can_view | ✅ can_view |
| `menu_compliance_employee` | ✅ can_view | ✅ can_view | ✅ can_view |
| `menu_compliance_processes` | ❌ | ✅ can_view | ✅ can_view |
| `menu_compliance_admin` | ❌ | ❌ | ✅ can_view |

Roller: `ejer`, `teamleder`, `rekruttering`, `medarbejder`, `some`, `fm_leder`, `backoffice`, `assisterende_teamleder`, `assisterende_teamleder_fm`, `kontorelev`

**Trin 2: Gate sidebar-linket i AppSidebar.tsx**
Wrap "Compliance" NavLink i en permission-check — vis kun hvis brugeren har `menu_compliance_overview` (can_view).

**Trin 3: Filtrer kort i ComplianceOverview.tsx**
Brug `usePermissions()` til at skjule kort som brugeren ikke har adgang til (f.eks. "Interne processer" og "Admin" skjules for medarbejdere).

### Filer
| Fil | Handling |
|---|---|
| Database migration | INSERT rettigheder for alle 10 roller |
| `src/components/layout/AppSidebar.tsx` | Gate compliance-link med permission-check |
| `src/pages/compliance/ComplianceOverview.tsx` | Filtrer kort baseret på brugerens rettigheder |

