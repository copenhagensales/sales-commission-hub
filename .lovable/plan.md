
# Plan: Dashboard Forside (Landing Page)

## Overblik

Opretter en ny landing page til dashboard-miljøet, som brugere ser når de går til `/dashboards` ruten. Denne side fungerer som et overblik over alle tilgængelige dashboards med hurtige links og preview-information.

---

## Formål

Når brugere i dag går til dashboard-miljøet, lander de direkte på det første tilgængelige dashboard. Med denne ændring får de i stedet:

1. **Overblik over alle tilgængelige dashboards** - Viser kort med alle dashboards brugeren har adgang til
2. **Hurtig navigation** - Et klik for at gå til et specifikt dashboard
3. **Status-information** - Eventuelt preview af key metrics fra hvert dashboard
4. **Velkomsthilsen** - Personlig hilsen til brugeren

---

## Design

### Visuel Struktur

```text
┌────────────────────────────────────────────────────────────────────┐
│ [DashboardLayout med sidebar]                                      │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  👋 Velkommen til Dashboards, [Fornavn]                           │
│  Vælg et dashboard nedenfor for at komme i gang                    │
│                                                                    │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐      │
│  │ 📊 CPH Sales    │ │ 📊 Fieldmark.   │ │ 📊 TDC Erhverv  │      │
│  │                 │ │                 │ │                 │      │
│  │ Dagsboard med   │ │ Field sales     │ │ TDC klient-     │      │
│  │ sales overblik  │ │ performance     │ │ dashboard       │      │
│  │                 │ │                 │ │                 │      │
│  │     [Åbn →]     │ │     [Åbn →]     │ │     [Åbn →]     │      │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘      │
│                                                                    │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐      │
│  │ 📊 Eesy TM      │ │ 📊 Relatel      │ │ 📊 United       │      │
│  │ ...             │ │ ...             │ │ ...             │      │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘      │
│                                                                    │
│  ────────────────────────────────────────────────────────────────  │
│                                                                    │
│  📌 Hurtig adgang                                                  │
│  [Åbn senest besøgte: CPH Sales]                                   │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## Teknisk Implementation

### Ny Fil: `src/pages/dashboards/DashboardHome.tsx`

Denne komponent viser:

1. **Header** med velkomsthilsen (bruger `useAuth` til at hente brugerens navn)
2. **Grid af dashboard-kort** via `useAccessibleDashboards` hook
3. **"Senest besøgte" funktion** der gemmer sidste dashboard i `localStorage`
4. **Wrapped i `DashboardLayout`** for at vise sidebar

```typescript
// Pseudo-kode struktur
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAccessibleDashboards } from "@/hooks/useTeamDashboardPermissions";
import { useAuth } from "@/hooks/useAuth";

const DashboardHome = () => {
  const { data: dashboards } = useAccessibleDashboards();
  const { user } = useAuth();
  const lastVisited = localStorage.getItem("last-visited-dashboard");

  return (
    <DashboardLayout>
      {/* Header med velkommen */}
      <div className="mb-8">
        <h1>Velkommen til Dashboards</h1>
        <p>Vælg et dashboard for at komme i gang</p>
      </div>

      {/* Grid af dashboard kort */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {dashboards.map(dashboard => (
          <DashboardCard key={dashboard.slug} dashboard={dashboard} />
        ))}
      </div>

      {/* Senest besøgte sektion */}
      {lastVisited && (
        <div className="mt-8">
          <Button onClick={() => navigate(lastVisited)}>
            Fortsæt til senest besøgte
          </Button>
        </div>
      )}
    </DashboardLayout>
  );
};
```

### Dashboard-kort Komponent

Hvert kort viser:
- **Ikon** (LayoutDashboard fra lucide)
- **Dashboard navn**
- **Kort beskrivelse** (kan tilføjes til `DASHBOARD_LIST` config)
- **"Åbn" knap** der navigerer til dashboardet

### Opdateret Routing

I `src/routes/config.tsx` tilføjes:

```typescript
{
  path: "/dashboards",
  component: DashboardHome,
  access: "protected",
},
```

### Opdater `AppModeContext`

Ændr `switchToDashboard()` funktionen til at navigere til `/dashboards` i stedet for første tilgængelige dashboard:

```typescript
const switchToDashboard = () => {
  setMode("dashboard");
  navigate("/dashboards"); // Ny landing page
};
```

### Opdater `DashboardSidebar`

- Tilføj "Hjem" link i sidebaren der peger på `/dashboards`
- Logo-klik skal også gå til `/dashboards` i stedet for første dashboard

---

## Dashboard Beskrivelser

Udvider `src/config/dashboards.ts` med beskrivelser:

```typescript
export interface DashboardConfig {
  slug: string;
  name: string;
  path: string;
  description?: string;  // NYT FELT
  icon?: string;         // NYT FELT (optional)
  permissionKey?: string;
}

export const DASHBOARD_LIST: DashboardConfig[] = [
  { 
    slug: "cph-sales", 
    name: "Dagsboard CPH Sales", 
    path: "/dashboards/cph-sales",
    description: "Overblik over dagens salg, top performers og team performance",
    permissionKey: "menu_dashboard_cph_sales" 
  },
  // ... resten med beskrivelser
];
```

---

## Filer der Oprettes/Ændres

| Fil | Handling | Beskrivelse |
|-----|----------|-------------|
| `src/pages/dashboards/DashboardHome.tsx` | OPRET | Ny landing page komponent |
| `src/routes/config.tsx` | OPDATER | Tilføj `/dashboards` route |
| `src/routes/pages.ts` | OPDATER | Eksportér DashboardHome |
| `src/config/dashboards.ts` | OPDATER | Tilføj beskrivelser |
| `src/contexts/AppModeContext.tsx` | OPDATER | Ændr `switchToDashboard` |
| `src/components/layout/DashboardSidebar.tsx` | OPDATER | Tilføj Hjem link |

---

## Brugeroplevelse

### Før
1. Bruger klikker på "Dashboards" i hovedsystemet
2. Bliver sendt direkte til første tilgængelige dashboard (f.eks. CPH Sales)
3. Må bruge sidebar til at skifte dashboard

### Efter
1. Bruger klikker på "Dashboards" i hovedsystemet
2. Lander på oversigtsside med alle tilgængelige dashboards
3. Kan vælge præcis det dashboard de vil se
4. Har mulighed for "fortsæt hvor du slap" med senest besøgte

---

## Ekstra Features (Optional)

Disse kan tilføjes senere:

1. **Live preview metrics** - Vis 1-2 key KPIs på hvert kort
2. **Favoritter** - Mulighed for at markere foretrukne dashboards
3. **Søgefunktion** - For brugere med mange dashboards
4. **Seneste aktivitet** - Vis hvornår dashboardet sidst blev opdateret

