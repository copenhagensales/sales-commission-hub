import { Loader2, Shield, Info, LayoutDashboard, ChevronDown, ChevronRight, Check } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { DASHBOARD_LIST } from "@/config/dashboards";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useTeamDashboardPermissions,
  useTeamsWithLeaders,
  useUpdateTeamDashboardPermission,
  useSeedMissingDashboardPermissions,
  type DashboardAccessLevel,
} from "@/hooks/useTeamDashboardPermissions";
import { cn } from "@/lib/utils";

// Access level configurations
const accessLevels: { value: DashboardAccessLevel; label: string; shortLabel: string; description: string }[] = [
  { value: 'none', label: 'Ingen', shortLabel: '–', description: 'Ingen adgang' },
  { value: 'team_leader', label: 'TL', shortLabel: 'TL', description: 'Kun teamleder' },
  { value: 'leadership', label: 'Ledelse', shortLabel: 'Led.', description: 'Teamleder + assisterende' },
  { value: 'all', label: 'Alle', shortLabel: 'Alle', description: 'Hele teamet' },
];

const accessLevelStyles: Record<DashboardAccessLevel, string> = {
  none: "bg-muted text-muted-foreground hover:bg-muted/80",
  team_leader: "bg-blue-500/20 text-blue-400 border-blue-500/50 hover:bg-blue-500/30",
  leadership: "bg-orange-500/20 text-orange-400 border-orange-500/50 hover:bg-orange-500/30",
  all: "bg-green-500/20 text-green-400 border-green-500/50 hover:bg-green-500/30",
};

const accessLevelActiveStyles: Record<DashboardAccessLevel, string> = {
  none: "bg-muted text-muted-foreground ring-2 ring-muted-foreground/50",
  team_leader: "bg-blue-500 text-white ring-2 ring-blue-400",
  leadership: "bg-orange-500 text-white ring-2 ring-orange-400",
  all: "bg-green-500 text-white ring-2 ring-green-400",
};

export function DashboardPermissionsTab() {
  const { toast } = useToast();
  const { data: teams = [], isLoading: teamsLoading } = useTeamsWithLeaders();
  const { data: permissions = [], isLoading: permissionsLoading } = useTeamDashboardPermissions();
  const updatePermission = useUpdateTeamDashboardPermission();
  const seedMissingPermissions = useSeedMissingDashboardPermissions();
  const hasSeeded = useRef(false);
  const [expandedDashboards, setExpandedDashboards] = useState<Set<string>>(
    new Set(DASHBOARD_LIST.slice(0, 3).map(d => d.slug)) // Expand first 3 by default
  );

  const isLoading = teamsLoading || permissionsLoading;

  // Auto-seed manglende permissions når data er loaded
  useEffect(() => {
    if (!isLoading && teams.length > 0 && !hasSeeded.current) {
      hasSeeded.current = true;
      seedMissingPermissions.mutate({ teams, existingPermissions: permissions });
    }
  }, [isLoading, teams, permissions]);

  // Get current permission for a team/dashboard combination
  const getPermission = (teamId: string, dashboardSlug: string): DashboardAccessLevel => {
    const perm = permissions.find(
      p => p.team_id === teamId && p.dashboard_slug === dashboardSlug
    );
    return perm?.access_level ?? 'none';
  };

  // Count teams with each access level for a dashboard
  const getAccessSummary = (dashboardSlug: string) => {
    const counts = { none: 0, team_leader: 0, leadership: 0, all: 0 };
    teams.forEach(team => {
      const level = getPermission(team.id, dashboardSlug);
      counts[level]++;
    });
    return counts;
  };

  // Handle permission change
  const handlePermissionChange = (
    teamId: string, 
    dashboardSlug: string, 
    newLevel: DashboardAccessLevel
  ) => {
    updatePermission.mutate(
      { teamId, dashboardSlug, accessLevel: newLevel },
      {
        onSuccess: () => {
          toast({
            title: "Gemt",
            description: "Rettigheden er opdateret.",
          });
        },
        onError: (error) => {
          console.error("Error updating permission:", error);
          toast({
            title: "Fejl",
            description: "Kunne ikke opdatere rettigheden.",
            variant: "destructive",
          });
        },
      }
    );
  };

  // Set all teams to a specific level for a dashboard
  const setAllTeams = async (dashboardSlug: string, level: DashboardAccessLevel) => {
    const teamsToUpdate = teams.filter(
      team => getPermission(team.id, dashboardSlug) !== level
    );
    
    if (teamsToUpdate.length === 0) return;
    
    try {
      await Promise.all(
        teamsToUpdate.map(team => 
          updatePermission.mutateAsync({ teamId: team.id, dashboardSlug, accessLevel: level })
        )
      );
      toast({
        title: "Alle teams opdateret",
        description: `${teamsToUpdate.length} teams sat til "${accessLevels.find(l => l.value === level)?.label}"`,
      });
    } catch (error) {
      toast({
        title: "Fejl",
        description: "Nogle rettigheder kunne ikke opdateres",
        variant: "destructive",
      });
    }
  };

  const toggleDashboard = (slug: string) => {
    setExpandedDashboards(prev => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  };

  const expandAll = () => setExpandedDashboards(new Set(DASHBOARD_LIST.map(d => d.slug)));
  const collapseAll = () => setExpandedDashboards(new Set());

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Dashboard Rettigheder
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Dashboard Rettigheder
            </CardTitle>
            <CardDescription className="mt-1">
              Klik på knapperne for at ændre adgang
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={expandAll}>
              Udvid alle
            </Button>
            <Button variant="ghost" size="sm" onClick={collapseAll}>
              Luk alle
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {/* Info banner */}
        <Alert className="mb-4 py-2">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Ejere har altid fuld adgang til alle dashboards.
          </AlertDescription>
        </Alert>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4 pb-2 border-b">
          <span className="font-medium">Niveauer:</span>
          {accessLevels.map(level => (
            <span key={level.value} className="flex items-center gap-1">
              <span className={cn(
                "w-2 h-2 rounded-full",
                level.value === 'none' && "bg-muted-foreground",
                level.value === 'team_leader' && "bg-blue-500",
                level.value === 'leadership' && "bg-orange-500",
                level.value === 'all' && "bg-green-500",
              )} />
              {level.description}
            </span>
          ))}
        </div>

        {/* Dashboard sections */}
        <div className="space-y-2">
          {DASHBOARD_LIST.map((dashboard) => {
            const isExpanded = expandedDashboards.has(dashboard.slug);
            const summary = getAccessSummary(dashboard.slug);
            const hasAccess = summary.team_leader + summary.leadership + summary.all;

            return (
              <Collapsible
                key={dashboard.slug}
                open={isExpanded}
                onOpenChange={() => toggleDashboard(dashboard.slug)}
                className="border rounded-lg overflow-hidden"
              >
                {/* Dashboard header */}
                <div className="flex items-center bg-muted/30">
                  <CollapsibleTrigger className="flex-1 flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <LayoutDashboard className="h-4 w-4 text-primary" />
                    <span className="font-medium">{dashboard.name}</span>
                    
                    {/* Access summary badges */}
                    <div className="flex items-center gap-1 ml-auto mr-2">
                      {hasAccess > 0 ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                          {hasAccess} teams
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          Ingen adgang
                        </span>
                      )}
                    </div>
                  </CollapsibleTrigger>
                  
                  {/* Quick actions */}
                  <div className="flex items-center gap-1 pr-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAllTeams(dashboard.slug, 'all');
                          }}
                        >
                          Alle ✓
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Giv alle teams adgang</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 px-2 text-xs text-muted-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAllTeams(dashboard.slug, 'none');
                          }}
                        >
                          Nulstil
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Fjern al adgang</TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                {/* Team rows */}
                <CollapsibleContent>
                  <div className="divide-y divide-border/50">
                    {teams.map((team) => {
                      const currentLevel = getPermission(team.id, dashboard.slug);

                      return (
                        <div
                          key={team.id}
                          className="flex items-center justify-between py-2 px-4 hover:bg-accent/30 transition-colors"
                        >
                          <span className="text-sm font-medium min-w-[120px]">{team.name}</span>

                          {/* Access level toggle buttons */}
                          <div className="flex items-center gap-1">
                            {accessLevels.map(level => {
                              const isActive = currentLevel === level.value;
                              return (
                                <Tooltip key={level.value}>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={() => handlePermissionChange(team.id, dashboard.slug, level.value)}
                                      disabled={updatePermission.isPending}
                                      className={cn(
                                        "px-3 py-1 text-xs font-medium rounded-md border transition-all",
                                        "disabled:opacity-50 disabled:cursor-not-allowed",
                                        isActive 
                                          ? accessLevelActiveStyles[level.value]
                                          : cn(accessLevelStyles[level.value], "border-transparent")
                                      )}
                                    >
                                      {isActive && <Check className="h-3 w-3 inline mr-1" />}
                                      {level.label}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">
                                    {level.description}
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>

        {teams.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Ingen teams fundet
          </div>
        )}
      </CardContent>
    </Card>
  );
}
