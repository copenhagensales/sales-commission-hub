
# Plan: Hierarkisk Fold-ud for Alle Rettigheder

## Problemanalyse

Brugeren kan i dag ikke folde ud grupper af rettigheder (som Dashboards, Personale-tabs, Fieldmarketing-tabs osv.) for at tildele individuelle rettigheder til forskellige roller. Alt vises som en flad liste.

**Eksempel på ønsket funktionalitet:**
```
Personale ▼
├── ▶ Medarbejdere (klik for at folde ud)
│     ├── Fane: Alle medarbejdere     [Se] [Ret] [Visibility]
│     ├── Fane: Backoffice            [Se] [Ret] [Visibility]
│     ├── Fane: Teams                 [Se] [Ret] [Visibility]
│     ├── Fane: Stillinger            [Se] [Ret] [Visibility]
│     └── Fane: Rettigheder           [Se] [Ret] [Visibility]
├── Teams
└── Dashboard
```

---

## Løsning: Hierarkisk Gruppering med Foldbare Sektioner

### Ændring 1: Definer Parent-Child Relationer

Opret en mapping der grupperer relaterede rettigheder:

```typescript
const PERMISSION_GROUPS: Record<string, { label: string; children: string[] }> = {
  // Personale > Medarbejdere tabs
  'menu_employees': {
    label: 'Medarbejdere',
    children: ['tab_employees_all', 'tab_employees_staff', 'tab_employees_teams', 'tab_employees_positions', 'tab_employees_permissions', 'tab_employees_dialer_mapping']
  },
  // Fieldmarketing > Booking tabs
  'menu_fm_booking': {
    label: 'Booking',
    children: ['tab_fm_book_week', 'tab_fm_bookings', 'tab_fm_markets', 'tab_fm_locations', 'tab_fm_vagtplan']
  },
  // Onboarding tabs
  'menu_onboarding_overview': {
    label: 'Onboarding',
    children: ['tab_onboarding_overview', 'tab_onboarding_ramp', 'tab_onboarding_leader', 'tab_onboarding_drills', 'tab_onboarding_template', 'tab_onboarding_admin']
  },
  // MG tabs
  'menu_team_overview': {
    label: 'Team overblik',
    children: ['tab_mg_salary_schemes', 'tab_mg_relatel_status', 'tab_mg_relatel_events']
  },
  // Winback tabs
  'menu_winback': {
    label: 'Winback',
    children: ['tab_winback_ghostet', 'tab_winback_takket_nej', 'tab_winback_kundeservice']
  },
  // Messages tabs
  'menu_messages': {
    label: 'Beskeder',
    children: ['tab_messages_all', 'tab_messages_sms', 'tab_messages_email', 'tab_messages_call', 'tab_messages_sent']
  },
  // Dashboards som gruppe
  'page_dashboards': {
    label: 'Dashboards',
    children: ['menu_dashboard_cph_sales', 'menu_dashboard_cs_top_20', 'menu_dashboard_fieldmarketing', 'menu_dashboard_eesy_tm', 'menu_dashboard_tdc_erhverv', 'menu_dashboard_relatel', 'menu_dashboard_mg_test', 'menu_dashboard_united', 'menu_dashboard_design', 'menu_dashboard_settings']
  }
};
```

### Ændring 2: Ny Komponent `PermissionRowWithChildren`

Opret en foldbar række-komponent:

```text
┌─────────────────────────────────────────────────────────────┐
│ ▶ Medarbejdere              Se ◉  Ret ○  Alle ▼   [Rediger]│
├─────────────────────────────────────────────────────────────┤
│ (foldet ind - klik for at vise børn)                        │
└─────────────────────────────────────────────────────────────┘

Efter fold-ud:
┌─────────────────────────────────────────────────────────────┐
│ ▼ Medarbejdere              Se ◉  Ret ○  Alle ▼   [Rediger]│
├─────────────────────────────────────────────────────────────┤
│   ├─ Fane: Alle medarbejdere   Se ◉  Ret ○  Team ▼         │
│   ├─ Fane: Backoffice          Se ◉  Ret ○  Alle ▼         │
│   ├─ Fane: Teams               Se ○  Ret ○  Egen ▼         │
│   ├─ Fane: Stillinger          Se ◉  Ret ○  Team ▼         │
│   └─ Fane: Rettigheder         Se ○  Ret ○  Egen ▼         │
└─────────────────────────────────────────────────────────────┘
```

Funktionalitet:
- Chevron-ikon (▶/▼) for fold-ud/ind
- Indrykning for børne-elementer (pl-6)
- Parent switch styrer alle børn
- Tæller badge viser aktiverede børn

### Ændring 3: Byg Hierarki i Kategori-Rendering

Opdater `AccordionContent` til at:
1. Gruppere rettigheder baseret på `PERMISSION_GROUPS`
2. Rendere parents med `PermissionRowWithChildren`
3. Skjule børn der er håndteret af parent

```typescript
function buildCategoryTree(categoryPermissions) {
  const parents = [];
  const handledKeys = new Set();
  
  // Find alle parents
  for (const [parentKey, group] of Object.entries(PERMISSION_GROUPS)) {
    const parentPerm = categoryPermissions.find(p => p.permission_key === parentKey);
    if (parentPerm) {
      const children = categoryPermissions.filter(p => group.children.includes(p.permission_key));
      parents.push({ parent: parentPerm, children, groupLabel: group.label });
      handledKeys.add(parentKey);
      group.children.forEach(k => handledKeys.add(k));
    }
  }
  
  // Resterende (ikke-grupperede)
  const standalone = categoryPermissions.filter(p => !handledKeys.has(p.permission_key));
  
  return { parents, standalone };
}
```

---

## Tekniske Ændringer

### Fil: `src/components/employees/permissions/PermissionEditorV2.tsx`

1. **Tilføj `PERMISSION_GROUPS` konstant** (linje ~200)
   - Mapping fra parent-key til børne-keys for alle grupperinger

2. **Tilføj `expandedGroups` state** (linje ~268)
   ```typescript
   const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
   ```

3. **Ny komponent: `PermissionRowWithChildren`** (efter linje 1178)
   - Props: `parentPermission`, `children`, `groupLabel`, `isExpanded`, `onToggleExpand`
   - Chevron-ikon for fold
   - Tæller badge for børn
   - Rendrer indrykkede børne-rækker

4. **Ny hjælpefunktion: `buildCategoryTree()`** (linje ~230)
   - Identificerer parents og deres børn
   - Returnerer struktureret data til rendering

5. **Opdater AccordionContent rendering** (linje ~872-890)
   - Brug `buildCategoryTree()` til at strukturere data
   - Render `PermissionRowWithChildren` for groups
   - Render `PermissionRowCompact` for standalone items

6. **Toggle alle børn når parent ændres** (opdater `togglePermission`)
   - Hvis parent slås fra, deaktiver alle børn
   - Hvis parent slås til, aktiver alle børn (valgfrit)

---

## Visuelt Koncept

**Før (flad liste):**
```
Personale ▼
├── Dashboard           Se ◉  Ret ○  
├── Medarbejdere        Se ◉  Ret ◉
├── Teams               Se ◉  Ret ○
├── Fane: Alle          Se ○  Ret ○
├── Fane: Backoffice    Se ◉  Ret ○
├── Fane: Teams         Se ○  Ret ○
└── ...
```

**Efter (hierarkisk):**
```
Personale ▼
├── Dashboard                   Se ◉  Ret ○  Alle
├── ▼ Medarbejdere (5/6)        Se ◉  Ret ◉  Alle    ← Klikbar!
│     ├── Fane: Alle            Se ◉  Ret ○  Team
│     ├── Fane: Backoffice      Se ◉  Ret ○  Alle
│     ├── Fane: Teams           Se ○  Ret ○  Egen
│     ├── Fane: Stillinger      Se ◉  Ret ○  Team
│     ├── Fane: Rettigheder     Se ○  Ret ○  Egen
│     └── Fane: Dialer-mapping  Se ◉  Ret ○  Alle
├── Teams                       Se ◉  Ret ○  Team
└── ...
```

---

## Implementeringsrækkefølge

1. **Definer `PERMISSION_GROUPS`** konstant med alle parent-child mappings

2. **Tilføj `expandedGroups` state** til at tracke åbne grupper

3. **Opret `buildCategoryTree()` hjælpefunktion** til at strukturere data

4. **Opret `PermissionRowWithChildren` komponent**:
   - Chevron toggle
   - Parent-række med controls
   - Collapsible børne-sektion
   - Indrykning og visuelt hierarki

5. **Opdater AccordionContent** til at bruge den nye struktur

6. **Tilføj parent-child toggle logik** (valgfrit: bulk-toggle)

---

## Fordele

- **Bedre overblik**: Relaterede rettigheder er grupperet visuelt
- **Mindre clutter**: Børn kan foldes ind/ud efter behov
- **Hurtigere administration**: Alle roller (teamleder, fm_medarbejder, etc.) kan konfigureres mere overskueligt
- **Konsistent mønster**: Samme fold-logik som accordion-kategorier
- **Skalerbar**: Let at tilføje nye grupperinger i `PERMISSION_GROUPS`

---

## Berørte Roller

Alle eksisterende roller vil automatisk drage fordel af den nye visning:
- **Ejer** - fuld oversigt med hierarki
- **Teamleder** - fokuseret visning af team-relaterede rettigheder
- **FM Leder / FM Medarbejder** - Fieldmarketing tabs grupperet
- **Assisterende Teamleder FM** - kombination af begge
- **Rekruttering** - Winback og rekruttering tabs grupperet
- **SOME** - SOME-specifikke rettigheder
- **Medarbejder** - begrænset visning med samme hierarki
