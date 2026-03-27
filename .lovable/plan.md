

## Ny fane: "Rettighedskort" — Visuelt overblik over roller og rettigheder

### Hvad vi bygger
En tredje fane i PermissionsTab (ved siden af "Oversigt" og "Rediger") der viser et visuelt **kort/diagram** over alle rettigheder grupperet efter sektioner, med farve-kodede indikatorer per rolle. Formålet er at give et hurtigt overblik uden at skulle scrolle igennem den store matrixtabel.

### Design

```text
┌──────────────────────────────────────────────────────┐
│  [Oversigt]  [Kort 🗺️]  [Rediger ⚙️]               │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Rolle-filter: [Alle] [Ejer] [Teamleder] [FM Leder] │
│                                                      │
│  ┌─ Mit Hjem ────────────────────────────────────┐   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ │   │
│  │  │ Hjem   │ │ H2H    │ │ Liga   │ │ Mål    │ │   │
│  │  │ 🟢🟢🔵 │ │ 🟢🟡⚪ │ │ 🟢🟢🟢 │ │ 🟢🟡⚪ │ │   │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌─ Personale ───────────────────────────────────┐   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐             │   │
│  │  │Medarb. │ │ Teams  │ │ Login  │             │   │
│  │  │ 🟢🟢🔵 │ │ 🟢⚪⚪ │ │ 🟢⚪⚪ │             │   │
│  │  └────────┘ └────────┘ └────────┘             │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  Legende: 🟢 Fuld  🔵 Rediger  🟡 Læs  ⚪ Ingen    │
└──────────────────────────────────────────────────────┘
```

Hver "boks" er en permission-key. Hoverer man på den, viser en tooltip hvilke roller der har adgang og med hvilket scope. Boksen viser farve-dots for de valgte roller.

### Teknisk plan

**Én ny fil:**
- `src/components/employees/permissions/PermissionMap.tsx`

**Én ændring:**
- `src/components/employees/PermissionsTab.tsx` — tilføj den tredje tab

### Implementeringsdetaljer

1. **PermissionMap.tsx** komponent:
   - Bruger eksisterende `useRoleDefinitions()` og `usePagePermissions()` hooks (ingen nye queries)
   - Bruger `PERMISSION_KEYS` fra `permissionKeys.ts` for hierarki (section → children)
   - Rolle-filter buttons øverst (toggle hvilke roller der vises)
   - Grupperer permissions efter `section`/`parent` fra PERMISSION_KEYS
   - Hver permission vises som et kort/boks med:
     - Ikon (fra eksisterende `permissionIconMap`)
     - Dansk label (fra `permissionKeyLabels`)
     - Farve-dots per synlig rolle: grøn=fuld, blå=edit, gul=view-only, grå=ingen
   - Tooltip ved hover: viser alle rollers adgang for den permission
   - Responsive grid layout (4-6 kolonner desktop, 2-3 mobil)

2. **PermissionsTab.tsx** ændring:
   - Tilføj `<TabsTrigger value="map">Kort</TabsTrigger>` mellem Oversigt og Rediger
   - Tilføj `<TabsContent value="map"><PermissionMap /></TabsContent>`

### Risiko
**Nul** — rent additiv ændring. Ingen eksisterende funktionalitet ændres.

