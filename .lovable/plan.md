
# Plan: Dashboards Folder Sig Ud i Rettigheds-Editoren

## Problemanalyse

I den nuværende implementering viser Permission Editor alle rettigheder som en **flad liste** inden for hver kategori-accordion. Selvom databasen har `parent_key`-relationer defineret (f.eks. `menu_dashboard_cph_sales` har `parent_key: menu_section_dashboards`), bruger UI'et ikke denne hierarki til at skabe indlejrede/foldbare rækker.

Det betyder at:
1. Dashboards-kategorien viser alle dashboard-rettigheder som separate rækker
2. Der er ingen visuel gruppering eller mulighed for at folde ud/ind for at se børne-elementer
3. "Dashboard"-rækken under andre kategorier er blot en enkelt rettighed, ikke en container

---

## Løsning: Hierarkisk Visning med Foldbare Parent-Child Rækker

### Ændring 1: Udvid `PERMISSION_HIERARCHY` med rigtige parent-child relationer

Opdater hierarkiet så hver individuel dashboard-rettighed har en eksplicit parent:

```typescript
const PERMISSION_HIERARCHY: Record<string, string | null> = {
  // ... eksisterende
  // Dashboards - individuelle dashboards under section
  menu_dashboard_cph_sales: 'page_dashboards',
  menu_dashboard_cs_top_20: 'page_dashboards',
  menu_dashboard_fieldmarketing: 'page_dashboards',
  menu_dashboard_eesy_tm: 'page_dashboards',
  // ... osv.
};
```

### Ændring 2: Ny komponent `PermissionRowWithChildren`

Opret en ny komponent der kan:
- Vise en parent-rettighed med en fold-ud knap
- Indeholde børne-rettigheder som kan vises/skjules
- Håndtere "parent enables children" logik

```text
┌──────────────────────────────────────────────────────┐
│ ▼ Dashboards (Side)          Se ◉  Ret ○  Alle ○    │
├──────────────────────────────────────────────────────┤
│   └ CPH Salg (Menu)          Se ◉  Ret ○  Alle ○    │
│   └ Fieldmarketing (Menu)    Se ○  Ret ○  Team ○    │
│   └ Eesy TM (Menu)           Se ◉  Ret ○  Egen ◉    │
│   └ TDC Erhverv (Menu)       Se ○  Ret ○  Egen ○    │
│   └ Relatel (Menu)           Se ◉  Ret ○  Alle ○    │
└──────────────────────────────────────────────────────┘
```

### Ændring 3: Gruppér rettigheder hierarkisk i UI

I stedet for en flad liste, omstrukturér hvordan kategorier renderes:

1. Find alle "root" rettigheder (dem uden parent eller med section som parent)
2. For hver root, find børn baseret på `parent_key`
3. Render som collapsible træ-struktur

### Ændring 4: Tilføj en hovedrettighed for "Dashboards-adgang"

Opret en overordnet `page_dashboards` rettighed der fungerer som gate:
- Hvis `page_dashboards` er slået fra, kan ingen individuelle dashboards ses
- Hvis slået til, vises børnene og kan styres individuelt

---

## Tekniske Ændringer

### Fil: `src/components/employees/permissions/PermissionEditorV2.tsx`

```text
1. Tilføj state for åbne parent-rækker:
   const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

2. Opret hjælpefunktion til at bygge hierarki:
   function buildPermissionTree(permissions): PermissionWithChildren[] {
     // Gruppér børn under deres parent
     // Returnér kun root-elementer med children array
   }

3. Ny komponent: PermissionRowWithChildren
   - Viser chevron-ikon hvis der er børn
   - Klikbart for at folde ud/ind
   - Renderer børne-rækker med indrykning
   - Arver disabled-state fra parent

4. Opdater AccordionContent rendering:
   - Brug buildPermissionTree i stedet for flad liste
   - Render PermissionRowWithChildren for elementer med børn
   - Render PermissionRowCompact for blade (uden børn)
```

### Fil: `src/hooks/useUnifiedPermissions.ts`

```text
1. Tilføj page_dashboards til permissionKeyLabels:
   page_dashboards: 'Dashboards (hovedadgang)',

2. Opdater PERMISSION_HIERARCHY med child-mappings
```

### Database-ændring (migration)

```sql
-- Tilføj page_dashboards som parent-rettighed
INSERT INTO role_page_permissions (role_key, permission_key, parent_key, permission_type, can_view, can_edit, visibility)
SELECT DISTINCT 
  role_key,
  'page_dashboards',
  'menu_section_dashboards',
  'page',
  true,
  true,
  'all'
FROM role_page_permissions
WHERE role_key IN (SELECT DISTINCT key FROM system_role_definitions)
ON CONFLICT (role_key, permission_key) DO NOTHING;

-- Opdater alle dashboard-menu items til at have page_dashboards som parent
UPDATE role_page_permissions 
SET parent_key = 'page_dashboards'
WHERE permission_key IN (
  'menu_dashboard_cph_sales',
  'menu_dashboard_cs_top_20',
  'menu_dashboard_fieldmarketing',
  'menu_dashboard_eesy_tm',
  'menu_dashboard_tdc_erhverv',
  'menu_dashboard_relatel',
  'menu_dashboard_mg_test',
  'menu_dashboard_united',
  'menu_dashboard_design',
  'menu_dashboard_settings'
);
```

---

## Implementeringsrækkefølge

1. **Database**: Kør migration for at oprette `page_dashboards` rettighed og opdatere parent_key på dashboard-menupunkter

2. **Hooks**: Tilføj nye labels og opdater hierarki-konstanter

3. **Byg hierarki-funktion**: Implementer `buildPermissionTree()` 

4. **Ny komponent**: Opret `PermissionRowWithChildren` med fold-ud funktionalitet

5. **Opdater rendering**: Erstat flad liste med hierarkisk rendering i kategori-accordion

6. **Test**: Verificér at:
   - Dashboards-kategorien viser en foldbar "Dashboards" parent-række
   - Klik folder ud og viser individuelle dashboards
   - Deaktivering af parent deaktiverer alle børn
   - Synkroniser-knappen opretter korrekt hierarki

---

## Visuelt Koncept

**Før (flad liste):**
```text
Dashboards
├── CPH Salg          Se ◉  Ret ○
├── Fieldmarketing    Se ◉  Ret ○
├── Eesy TM           Se ○  Ret ○
├── TDC Erhverv       Se ◉  Ret ○
└── ...
```

**Efter (hierarkisk med fold-ud):**
```text
Dashboards
└── ▼ Dashboards (hovedadgang)    Se ◉  Ret ○  Alle
      ├── CPH Salg                Se ◉  Ret ○  Team
      ├── Fieldmarketing          Se ◉  Ret ○  Alle
      ├── Eesy TM                 Se ○  Ret ○  Egen
      └── TDC Erhverv             Se ◉  Ret ○  Alle
```

---

## Fordele

- **Klar hierarki**: Administratorer kan tydeligt se hvilke dashboards der hører under hovedadgangen
- **Bulk-styring**: Deaktivering af parent deaktiverer alle børn automatisk
- **Bedre overblik**: Fold-funktion reducerer visual clutter
- **Konsistent med eksisterende mønster**: Bruger samme accordion-mønster som kategorier, men på rettigheds-niveau
- **Skalerbar**: Kan anvendes på andre sektioner (f.eks. Fieldmarketing tabs, MG undersider)
