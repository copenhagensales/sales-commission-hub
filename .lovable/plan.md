

# Opdateret Plan: Team-baseret Dashboard Rettigheder

## Overblik

Denne plan erstatter den nuværende rolle-baserede dashboard-rettighedsmodel med en team-baseret model. Den nye model giver finmasket kontrol over hvilke teams der kan se hvilke dashboards, med fire adgangsniveauer:

- **Ingen adgang** - Ingen i teamet kan se dashboardet
- **Kun teamleder** - Kun teamlederen
- **Ledelse** - Teamleder + assisterende teamledere  
- **Hele teamet** - Alle teammedlemmer

**Ejere (brugere med rollen 'ejer') har altid fuld adgang til alle dashboards - hardkodet i systemet.**

---

## Analyse af Eksisterende System

### Nuværende Rettighedssystem (som bevares)

Det eksisterende rettighedssystem består af:

1. **`role_page_permissions`** - Indeholder rolle-baserede rettigheder (role_key → permission_key → can_view/can_edit)
2. **`useUnifiedPermissions`** - Hovedhook der bestemmer brugerens rolle og tjekker `canView(permissionKey)`
3. **`usePositionPermissions`** - Alternativ hook med lignende funktionalitet
4. **Permission keys i `src/config/permissionKeys.ts`** - Central kilde for alle permission keys

### Hvordan Dashboard-adgang Fungerer I Dag

```text
DashboardSidebar.tsx:
  const { canView } = useUnifiedPermissions();
  const accessibleDashboards = DASHBOARD_LIST.filter(dashboard => 
    !dashboard.permissionKey || canView(dashboard.permissionKey)
  );

AppModeContext.tsx:
  const accessibleDashboards = DASHBOARD_LIST.filter(d => 
    !d.permissionKey || canView(d.permissionKey)
  );
  const canAccessDashboards = accessibleDashboards.length > 0 && canView("menu_section_dashboards");
```

### Team-strukturen i Databasen

```text
teams
├── id (UUID)
├── name (TEXT)
├── team_leader_id (UUID → employee_master_data.id)
├── assistant_team_leader_id (UUID → employee_master_data.id) [legacy, delvist brugt]
└── description

team_members (junction table)
├── id (UUID)
├── team_id (UUID → teams.id)
├── employee_id (UUID → employee_master_data.id)
└── created_at

team_assistant_leaders (junction table for multiple assistants)
├── team_id (UUID → teams.id)
├── employee_id (UUID → employee_master_data.id)
└── created_at
```

### Aktuelle Teams

| Team | ID |
|------|-----|
| Eesy TM | 0cb1b854-e7b5-4f49-8fdf-30e54e7d2f95 |
| Fieldmarketing | 900fc72c-8710-4933-9fc5-de89a78b03bf |
| Relatel | f4210d48-5062-4e3a-b945-7ff1d5a874dd |
| Stab | 09012ce9-e307-4f6d-a51e-f72af7200d74 |
| TDC Erhverv | ee967dfd-04c8-465e-bda7-f1c47094bae0 |
| United | ed095592-cc72-4dc5-b4d7-cc4a65250cac |

---

## Ny Datamodel

### Ny Tabel: `team_dashboard_permissions`

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| `id` | UUID | Primær nøgle |
| `team_id` | UUID | Reference til teams-tabellen |
| `dashboard_slug` | TEXT | Dashboard identifier (f.eks. "cph-sales") |
| `access_level` | TEXT | "none", "team_leader", "leadership", "all" |
| `created_at` | TIMESTAMPTZ | Oprettelsestidspunkt |
| `updated_at` | TIMESTAMPTZ | Opdateringstidspunkt |

**Unik begrænsning:** `(team_id, dashboard_slug)` - et team kan kun have én rettighed pr. dashboard

### Access Level Værdier

| Level | Hvem kan se? | Badge | Beskrivelse |
|-------|-------------|-------|-------------|
| `none` | Ingen i teamet | Grå | Standard - ingen adgang |
| `team_leader` | Kun teamleder | Blå | Kun `teams.team_leader_id` |
| `leadership` | TL + Assistenter | Orange | `team_leader_id` + alle i `team_assistant_leaders` |
| `all` | Hele teamet | Grøn | Alle i `team_members` |

---

## Integration med Eksisterende System

### Ejer-override (Hardkodet)

Bevarer eksisterende mønster fra `useUnifiedPermissions`:

```typescript
// Linje 172 i useUnifiedPermissions.ts
const canView = (permissionKey: string): boolean => {
  if (isOwner) return true; // Owners can view everything
  ...
};
```

Den nye hook vil bruge samme mønster:

```typescript
// useTeamDashboardPermissions.ts
export function useCanViewDashboard(dashboardSlug: string): boolean {
  const { isOwner } = useUnifiedPermissions();
  
  // HARDKODET: Ejere har altid fuld adgang
  if (isOwner) return true;
  
  // Team-baseret logik...
}
```

### Tilbagestilling fra Rolle-baseret

**Nuværende**: `canView("menu_dashboard_cph_sales")` via `role_page_permissions`  
**Nyt**: `useCanViewDashboard("cph-sales")` via `team_dashboard_permissions`

Dashboard permission keys (`menu_dashboard_*`) i `role_page_permissions` **bevares** men bruges ikke længere til dashboard-filtrering. De kan stadig bruges af andre dele af systemet.

---

## Rettighedslogik

```text
Bruger ønsker at se Dashboard X (slug)
                │
                ▼
┌───────────────────────────────────────┐
│ Er bruger 'ejer' (isOwner)?           │
│ → useUnifiedPermissions().isOwner     │
└─────────────────┬─────────────────────┘
                  │
         ┌────────┴────────┐
         ▼                 ▼
        JA                NEJ
         │                 │
         ▼                 ▼
    ✅ ADGANG    ┌─────────────────────────────────────┐
                 │ Hent brugerens employee_id          │
                 │ via employee_master_data.auth_user_id│
                 └─────────────────┬───────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────┐
│ Hent brugerens team-medlemskaber (team_members)          │
│ + teams hvor bruger er leder (teams.team_leader_id)      │
│ + teams hvor bruger er assistent (team_assistant_leaders)│
└─────────────────────────────┬────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────┐
│ Hent team_dashboard_permissions for dashboard_slug = X   │
└─────────────────────────────┬────────────────────────────┘
                              │
                              ▼
        For hvert team bruger tilhører:
                              │
    ┌─────────────────────────┼──────────────────────────────┐
    ▼                         ▼                              ▼
 access_level             access_level                  access_level
  = "all"                = "leadership"                = "team_leader"
    │                         │                              │
    ▼                         ▼                              ▼
 ✅ ADGANG          Er bruger TL eller ATL?         Er bruger teamleder?
                              │                              │
                    ┌─────────┴─────────┐          ┌─────────┴─────────┐
                    ▼                   ▼          ▼                   ▼
                   JA                  NEJ        JA                  NEJ
                    │                   │          │                   │
                    ▼                   ▼          ▼                   ▼
              ✅ ADGANG          Fortsæt...   ✅ ADGANG          Fortsæt...
    
    Hvis ingen teams giver adgang: ❌ INGEN ADGANG
```

---

## Filer der Oprettes/Ændres

### Nye Filer

| Fil | Beskrivelse |
|-----|-------------|
| `src/hooks/useTeamDashboardPermissions.ts` | Ny hook med team-baseret dashboard-logik |

### Ændrede Filer

| Fil | Ændringer |
|-----|-----------|
| `src/components/dashboard/DashboardPermissionsTab.tsx` | Komplet omskrivning til team-grid UI |
| `src/components/layout/DashboardSidebar.tsx` | Erstat `canView(permissionKey)` med ny hook |
| `src/contexts/AppModeContext.tsx` | Erstat dashboard-filtrering med ny hook |

### Database Migration

Opret `team_dashboard_permissions` tabel med RLS policies.

---

## Implementation: Database Migration

```sql
-- Opret tabel for team-baserede dashboard-rettigheder
CREATE TABLE IF NOT EXISTS public.team_dashboard_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  dashboard_slug TEXT NOT NULL,
  access_level TEXT NOT NULL DEFAULT 'none' 
    CHECK (access_level IN ('none', 'team_leader', 'leadership', 'all')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, dashboard_slug)
);

-- Enable RLS
ALTER TABLE public.team_dashboard_permissions ENABLE ROW LEVEL SECURITY;

-- Kun ejere kan redigere (bruger eksisterende is_owner funktion)
CREATE POLICY "Owners can manage all permissions" 
ON public.team_dashboard_permissions FOR ALL 
TO authenticated 
USING (public.is_owner(auth.uid()))
WITH CHECK (public.is_owner(auth.uid()));

-- Alle autentificerede kan læse (for at tjekke egne rettigheder)
CREATE POLICY "Authenticated users can read permissions" 
ON public.team_dashboard_permissions FOR SELECT 
TO authenticated 
USING (true);

-- Updated_at trigger (bruger eksisterende funktion)
CREATE TRIGGER set_updated_at_team_dashboard_permissions
  BEFORE UPDATE ON public.team_dashboard_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indekser for performance
CREATE INDEX idx_team_dashboard_permissions_team_id 
ON public.team_dashboard_permissions(team_id);

CREATE INDEX idx_team_dashboard_permissions_dashboard_slug 
ON public.team_dashboard_permissions(dashboard_slug);
```

---

## Implementation: Ny Hook

```typescript
// src/hooks/useTeamDashboardPermissions.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUnifiedPermissions } from "@/hooks/useUnifiedPermissions";
import { useTeamAssistantLeaders } from "@/hooks/useTeamAssistantLeaders";
import { DASHBOARD_LIST, type DashboardConfig } from "@/config/dashboards";

export type DashboardAccessLevel = 'none' | 'team_leader' | 'leadership' | 'all';

export interface TeamDashboardPermission {
  id: string;
  team_id: string;
  dashboard_slug: string;
  access_level: DashboardAccessLevel;
  created_at: string;
  updated_at: string;
}

interface Team {
  id: string;
  name: string;
  team_leader_id: string | null;
}

// Hent alle team-dashboard rettigheder (til admin UI)
export function useTeamDashboardPermissions() {
  return useQuery({
    queryKey: ["team-dashboard-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_dashboard_permissions")
        .select("*")
        .order("dashboard_slug");
      
      if (error) throw error;
      return data as TeamDashboardPermission[];
    },
  });
}

// Hent alle teams med deres ledere
export function useTeamsWithLeaders() {
  return useQuery({
    queryKey: ["teams-with-leaders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, team_leader_id")
        .order("name");
      
      if (error) throw error;
      return data as Team[];
    },
  });
}

// Opdater en team-dashboard permission
export function useUpdateTeamDashboardPermission() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      teamId, 
      dashboardSlug, 
      accessLevel 
    }: { 
      teamId: string; 
      dashboardSlug: string; 
      accessLevel: DashboardAccessLevel;
    }) => {
      // Upsert - indsæt eller opdater
      const { error } = await supabase
        .from("team_dashboard_permissions")
        .upsert({
          team_id: teamId,
          dashboard_slug: dashboardSlug,
          access_level: accessLevel,
        }, {
          onConflict: 'team_id,dashboard_slug'
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-dashboard-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["accessible-dashboards"] });
    },
  });
}

// Hent brugerens tilgængelige dashboards
export function useAccessibleDashboards() {
  const { user } = useAuth();
  const { isOwner, isLoading: unifiedLoading } = useUnifiedPermissions();
  const { data: assistantRelations } = useTeamAssistantLeaders();
  
  return useQuery({
    queryKey: ["accessible-dashboards", user?.id, isOwner],
    queryFn: async () => {
      // HARDKODET: Ejere har altid fuld adgang til alle dashboards
      if (isOwner) {
        return DASHBOARD_LIST;
      }
      
      if (!user?.id) return [];
      
      // 1. Hent employee_id for nuværende bruger
      const { data: employee } = await supabase
        .from("employee_master_data")
        .select("id")
        .eq("auth_user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      
      if (!employee?.id) return [];
      const employeeId = employee.id;
      
      // 2. Hent brugerens team-medlemskaber
      const { data: memberships } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("employee_id", employeeId);
      
      const memberTeamIds = new Set((memberships || []).map(m => m.team_id));
      
      // 3. Hent teams hvor bruger er teamleder
      const { data: leaderTeams } = await supabase
        .from("teams")
        .select("id")
        .eq("team_leader_id", employeeId);
      
      const leaderTeamIds = new Set((leaderTeams || []).map(t => t.id));
      
      // 4. Find teams hvor bruger er assisterende (fra useTeamAssistantLeaders)
      const assistantTeamIds = new Set(
        (assistantRelations || [])
          .filter(a => a.employee_id === employeeId)
          .map(a => a.team_id)
      );
      
      // 5. Hent alle team dashboard permissions
      const { data: permissions } = await supabase
        .from("team_dashboard_permissions")
        .select("*");
      
      const permissionMap = new Map<string, TeamDashboardPermission[]>();
      (permissions || []).forEach(p => {
        const existing = permissionMap.get(p.dashboard_slug) || [];
        existing.push(p);
        permissionMap.set(p.dashboard_slug, existing);
      });
      
      // 6. Filtrer dashboards baseret på rettigheder
      const accessibleDashboards = DASHBOARD_LIST.filter(dashboard => {
        const dashboardPerms = permissionMap.get(dashboard.slug) || [];
        
        // Tjek hver af brugerens teams
        for (const perm of dashboardPerms) {
          // Er bruger medlem af dette team?
          const isMember = memberTeamIds.has(perm.team_id);
          const isLeader = leaderTeamIds.has(perm.team_id);
          const isAssistant = assistantTeamIds.has(perm.team_id);
          
          if (!isMember && !isLeader && !isAssistant) continue;
          
          switch (perm.access_level) {
            case 'all':
              // Alle medlemmer har adgang
              if (isMember || isLeader || isAssistant) return true;
              break;
            case 'leadership':
              // Kun teamleder + assisterende
              if (isLeader || isAssistant) return true;
              break;
            case 'team_leader':
              // Kun teamleder
              if (isLeader) return true;
              break;
            case 'none':
            default:
              // Ingen adgang
              break;
          }
        }
        
        return false;
      });
      
      return accessibleDashboards;
    },
    enabled: !!user && !unifiedLoading,
    staleTime: 5 * 60 * 1000, // 5 minutter
  });
}

// Check om bruger kan se et specifikt dashboard
export function useCanViewDashboard(dashboardSlug: string): boolean {
  const { data: accessibleDashboards = [], isLoading } = useAccessibleDashboards();
  const { isOwner } = useUnifiedPermissions();
  
  // HARDKODET: Ejere har altid fuld adgang
  if (isOwner) return true;
  
  if (isLoading) return false;
  
  return accessibleDashboards.some(d => d.slug === dashboardSlug);
}
```

---

## Implementation: Nyt DashboardPermissionsTab UI

Det nye UI viser:

1. **Info-banner** om at ejere altid har fuld adgang
2. **For hvert dashboard**: En sektion med grid af team-cards
3. **For hvert team**: Et card med dropdown til at vælge adgangsniveau

### Dropdown Muligheder

| Mulighed | Værdi | Badge Farve | Ikon |
|----------|-------|-------------|------|
| Ingen adgang | `none` | Grå | UserX |
| Kun teamleder | `team_leader` | Blå | User |
| Ledelse (TL + ATL) | `leadership` | Orange | Users |
| Hele teamet | `all` | Grøn | UsersRound |

### Visuel Struktur

```text
┌────────────────────────────────────────────────────────────────────┐
│ 🛡️ Dashboard Rettigheder                                          │
│ Tildel adgang til dashboards for hvert team                        │
│                                                                    │
│ ℹ️ Ejere har altid fuld adgang til alle dashboards                 │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ 📊 CPH Sales                                                       │
│ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐          │
│ │ Eesy TM        │ │ Fieldmarketing │ │ Relatel        │          │
│ │ [Ingen ▼]      │ │ [Hele team ▼]  │ │ [Ledelse ▼]    │          │
│ └────────────────┘ └────────────────┘ └────────────────┘          │
│ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐          │
│ │ Stab           │ │ TDC Erhverv    │ │ United         │          │
│ │ [Kun TL ▼]     │ │ [Ingen ▼]      │ │ [Ledelse ▼]    │          │
│ └────────────────┘ └────────────────┘ └────────────────┘          │
│                                                                    │
│ 📊 Fieldmarketing                                                  │
│ ...                                                                │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## Implementation: Opdater DashboardSidebar

```typescript
// src/components/layout/DashboardSidebar.tsx

// FØR (rolle-baseret):
const { canView, isLoading } = useUnifiedPermissions();
const accessibleDashboards = DASHBOARD_LIST.filter(dashboard => {
  if (!dashboard.permissionKey) return true;
  return canView(dashboard.permissionKey);
});

// EFTER (team-baseret):
const { data: accessibleDashboards = [], isLoading } = useAccessibleDashboards();
// accessibleDashboards er allerede filtreret af hooken
```

---

## Implementation: Opdater AppModeContext

```typescript
// src/contexts/AppModeContext.tsx

// FØR:
const accessibleDashboards = DASHBOARD_LIST.filter(d => 
  !d.permissionKey || canView(d.permissionKey)
);
const canAccessDashboards = accessibleDashboards.length > 0 && canView("menu_section_dashboards");

// EFTER:
const { data: accessibleDashboards = [], isLoading: dashboardsLoading } = useAccessibleDashboards();
const canAccessDashboards = accessibleDashboards.length > 0;
```

---

## Eksempel Scenarie

### Opsætning

| Dashboard | Team | Access Level |
|-----------|------|--------------|
| CPH Sales | Eesy TM | `all` |
| CPH Sales | Fieldmarketing | `leadership` |
| CPH Sales | Relatel | `team_leader` |
| CPH Sales | TDC Erhverv | `none` |

### Resultat

| Bruger | Position | Team | Kan se CPH Sales? | Grund |
|--------|----------|------|-------------------|-------|
| William | Ejer | - | ✅ | Hardkodet owner override |
| Jonas | Teamleder | Eesy TM | ✅ | access_level = all |
| Anders | Ass. TL | Eesy TM | ✅ | access_level = all |
| Maria | Medarbejder | Eesy TM | ✅ | access_level = all |
| Oscar | Teamleder | FM | ✅ | access_level = leadership |
| Emma | Ass. TL | FM | ✅ | access_level = leadership |
| Lars | Medarbejder | FM | ❌ | access_level = leadership (kun ledelse) |
| Martin | Teamleder | Relatel | ✅ | access_level = team_leader |
| Sara | Ass. TL | Relatel | ❌ | access_level = team_leader (kun TL) |
| Peter | Medarbejder | Relatel | ❌ | access_level = team_leader |
| Kristoffer | Teamleder | TDC | ❌ | access_level = none |

---

## Test Plan

1. **Ejer override**: Log ind som ejer - alle dashboards synlige uanset permissions
2. **Opret rettighed**: Giv Team Eesy TM adgang til CPH Sales med "Hele team"
3. **Verificer medarbejder**: Log ind som medarbejder i Eesy TM - kan se CPH Sales
4. **Skift til kun teamleder**: Ændr til "Kun teamleder"
5. **Verificer medarbejder**: Samme medarbejder kan nu IKKE se CPH Sales
6. **Verificer assisterende**: Assisterende teamleder kan heller IKKE se (kun TL)
7. **Skift til ledelse**: Ændr til "Ledelse"
8. **Verificer assisterende**: Nu kan assisterende se dashboardet
9. **Verificer medarbejder**: Medarbejder kan stadig ikke se
10. **Fjern adgang**: Sæt til "Ingen adgang"
11. **Verificer alle**: Ingen i teamet kan se dashboardet
12. **Ejer stadig adgang**: Tjek at ejer stadig kan se

