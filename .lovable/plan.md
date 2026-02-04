
# Plan: Dashboard-miljø med Separat Rettighedsstyring

## Oversigt
Denne plan opretter et separat "Dashboard-miljø" med sin egen menu, navigation og rettighedsstyring. Brugere kan skifte mellem det eksisterende **Hovedsystem** og det nye **Dashboard-system** via en skifteknap i øverste højre hjørne.

## Hvad du får
- **To separate miljøer**: Hovedsystem (nuværende) og Dashboard-miljø (nyt)
- **Skifteknap** øverst til højre for at skifte mellem miljøerne
- **Separate rettigheder**: Dashboard-miljøet får sine egne rettigheder der administreres uafhængigt
- **Dedikeret navigation**: Dashboard-miljøet får sin egen sidebar med kun dashboard-relaterede menupunkter

## Brugeroplevelse

```text
┌─────────────────────────────────────────────────────────────┐
│ [Logo]                           [Hovedsystem ⇄ Dashboards] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Nuværende system med alle funktioner                      │
│   (Mit Hjem, Personale, Rekruttering, osv.)                │
│                                                             │
└─────────────────────────────────────────────────────────────┘

                          ↕ Skift miljø

┌─────────────────────────────────────────────────────────────┐
│ [Logo]                           [Hovedsystem ⇄ Dashboards] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Dashboard-miljø med kun dashboard-funktioner              │
│   (CPH Sales, Fieldmarketing, Eesy TM, osv.)               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Tekniske Ændringer

### 1. Ny Context: `AppModeContext`
Opretter en ny context til at styre hvilket miljø brugeren befinder sig i:
- Gemmer valgt miljø i localStorage for at huske valget
- Tilbyder `mode` (hovedsystem | dashboard) og `switchMode()` funktion

### 2. Ny Komponent: `EnvironmentSwitcher`
En toggle-knap der vises øverst til højre:
- Viser "Hovedsystem" og "Dashboards" som valg
- Navigerer automatisk til relevant startside ved skift
- Kun synlig for brugere med adgang til mindst ét dashboard

### 3. Dashboard-specifik Sidebar: `DashboardSidebar`
Ny sidebar der kun viser dashboard-menupunkter:
- CPH Sales, Fieldmarketing, Eesy TM, TDC Erhverv, etc.
- Dashboard-indstillinger og TV-board admin
- Bruger eksisterende dashboard-rettigheder (`menu_dashboard_*`)

### 4. Opdateret Layout-logik
- `MainLayout` viser `EnvironmentSwitcher` og bruger standard sidebar
- `DashboardLayout` viser `EnvironmentSwitcher` og bruger `DashboardSidebar`
- Begge layouts deler header-struktur med skifteknappen

### 5. Rettighedsstyring
Dashboard-miljøet bruger de eksisterende rettigheder:
- `menu_section_dashboards` - Adgang til dashboard-sektionen
- `menu_dashboard_cph_sales`, `menu_dashboard_fieldmarketing`, etc. - Individuelle dashboards

Disse rettigheder administreres allerede i Permission Editor og forbliver uændrede i database-struktur.

### 6. Routing-opdateringer
- Dashboard-ruter (`/dashboards/*`) forbliver som de er
- Ved skift til dashboard-miljø navigeres til første tilgængelige dashboard
- Ved skift til hovedsystem navigeres til `/home`

## Filer der oprettes
1. `src/contexts/AppModeContext.tsx` - Ny context for miljø-skift
2. `src/components/layout/EnvironmentSwitcher.tsx` - Skifteknap-komponent
3. `src/components/layout/DashboardSidebar.tsx` - Dashboard-specifik sidebar

## Filer der ændres
1. `src/App.tsx` - Tilføj `AppModeProvider`
2. `src/components/layout/MainLayout.tsx` - Tilføj `EnvironmentSwitcher` i header
3. `src/components/layout/DashboardLayout.tsx` - Tilføj `EnvironmentSwitcher` og `DashboardSidebar`
4. `src/components/dashboard/DashboardHeader.tsx` - Fjern "Gå til menu" knap (erstattes af switcher)

## Eksempel på brug

**Bruger med kun dashboard-adgang:**
- Ser kun dashboard-miljøet
- Skifteknap er skjult (ingen adgang til hovedsystem)

**Bruger med begge adgange:**
- Kan frit skifte mellem miljøer
- Valget huskes på tværs af sessioner

**TV-board mode:**
- Skifteknap er skjult (intet login)
- Fungerer som hidtil

## Fordele
- **Klar adskillelse**: Dashboard-brugere forstyrres ikke af andre menupunkter
- **Enklere navigation**: Færre menupunkter i hver kontekst
- **Fleksibel adgang**: Rettigheder styres individuelt per miljø
- **Bagudkompatibel**: Eksisterende funktionalitet forbliver uændret
