import { Loader2, Shield, Info, LayoutDashboard, User, Users, UsersRound, UserX, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { DASHBOARD_LIST } from "@/config/dashboards";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  useTeamDashboardPermissions,
  useTeamsWithLeaders,
  useUpdateTeamDashboardPermission,
  type DashboardAccessLevel,
} from "@/hooks/useTeamDashboardPermissions";
import { cn } from "@/lib/utils";

// Icons for access levels
const accessLevelIcons: Record<DashboardAccessLevel, typeof User> = {
  none: UserX,
  team_leader: User,
  leadership: Users,
  all: UsersRound,
};

const accessLevelColors: Record<DashboardAccessLevel, string> = {
  none: "text-muted-foreground",
  team_leader: "text-blue-500",
  leadership: "text-orange-500",
  all: "text-green-500",
};

export function DashboardPermissionsTab() {
  const { toast } = useToast();
  const { data: teams = [], isLoading: teamsLoading } = useTeamsWithLeaders();
  const { data: permissions = [], isLoading: permissionsLoading } = useTeamDashboardPermissions();
  const updatePermission = useUpdateTeamDashboardPermission();
  const [expandedDashboards, setExpandedDashboards] = useState<Set<string>>(new Set(DASHBOARD_LIST.map(d => d.slug)));

  const isLoading = teamsLoading || permissionsLoading;

  // Get current permission for a team/dashboard combination
  const getPermission = (teamId: string, dashboardSlug: string): DashboardAccessLevel => {
    const perm = permissions.find(
      p => p.team_id === teamId && p.dashboard_slug === dashboardSlug
    );
    return perm?.access_level ?? 'none';
  };

  // Count how many teams have access to a dashboard
  const getAccessCount = (dashboardSlug: string): number => {
    return permissions.filter(p => p.dashboard_slug === dashboardSlug && p.access_level !== 'none').length;
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
            title: "Rettighed opdateret",
            description: "Dashboard-rettigheden er blevet gemt.",
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
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Dashboard Rettigheder
        </CardTitle>
        <CardDescription>
          Tildel adgang til dashboards for hvert team
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Info banner about owner access */}
        <Alert className="mb-4">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Ejere har altid fuld adgang til alle dashboards.
          </AlertDescription>
        </Alert>

        {/* Dashboard sections as collapsible rows */}
        <div className="space-y-1">
          {DASHBOARD_LIST.map((dashboard) => {
            const isExpanded = expandedDashboards.has(dashboard.slug);
            const accessCount = getAccessCount(dashboard.slug);

            return (
              <Collapsible
                key={dashboard.slug}
                open={isExpanded}
                onOpenChange={() => toggleDashboard(dashboard.slug)}
              >
                {/* Dashboard header row */}
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <LayoutDashboard className="h-4 w-4 text-primary" />
                      <span className="font-medium">{dashboard.name}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {accessCount} {accessCount === 1 ? 'team' : 'teams'} har adgang
                    </span>
                  </div>
                </CollapsibleTrigger>

                {/* Team permission rows */}
                <CollapsibleContent>
                  <div className="ml-7 mt-1 space-y-0.5">
                    {teams.map((team) => {
                      const currentLevel = getPermission(team.id, dashboard.slug);
                      const IconComponent = accessLevelIcons[currentLevel];
                      const iconColor = accessLevelColors[currentLevel];

                      return (
                        <div
                          key={team.id}
                          className="flex items-center justify-between py-2 px-3 rounded hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <IconComponent className={cn("h-4 w-4", iconColor)} />
                            <span className="text-sm">{team.name}</span>
                          </div>

                          <Select
                            value={currentLevel}
                            onValueChange={(value) => 
                              handlePermissionChange(team.id, dashboard.slug, value as DashboardAccessLevel)
                            }
                            disabled={updatePermission.isPending}
                          >
                            <SelectTrigger className="w-[160px] h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">
                                <div className="flex items-center gap-2">
                                  <UserX className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span>Ingen adgang</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="team_leader">
                                <div className="flex items-center gap-2">
                                  <User className="h-3.5 w-3.5 text-blue-500" />
                                  <span>Kun teamleder</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="leadership">
                                <div className="flex items-center gap-2">
                                  <Users className="h-3.5 w-3.5 text-orange-500" />
                                  <span>Ledelse</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="all">
                                <div className="flex items-center gap-2">
                                  <UsersRound className="h-3.5 w-3.5 text-green-500" />
                                  <span>Hele teamet</span>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
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
