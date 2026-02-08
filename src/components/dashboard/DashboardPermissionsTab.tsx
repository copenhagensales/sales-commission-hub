import { useState } from "react";
import { Loader2, Shield, Info, LayoutDashboard, User, Users, UsersRound, UserX } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
  useTeamDashboardPermissions,
  useTeamsWithLeaders,
  useUpdateTeamDashboardPermission,
  accessLevelLabels,
  type DashboardAccessLevel,
} from "@/hooks/useTeamDashboardPermissions";

// Badge colors and icons for access levels
const accessLevelConfig: Record<DashboardAccessLevel, { 
  variant: "default" | "secondary" | "destructive" | "outline"; 
  className: string;
  icon: typeof User;
}> = {
  none: { variant: "secondary", className: "bg-muted text-muted-foreground", icon: UserX },
  team_leader: { variant: "default", className: "bg-blue-500/15 text-blue-700 border-blue-200", icon: User },
  leadership: { variant: "default", className: "bg-orange-500/15 text-orange-700 border-orange-200", icon: Users },
  all: { variant: "default", className: "bg-green-500/15 text-green-700 border-green-200", icon: UsersRound },
};

export function DashboardPermissionsTab() {
  const { toast } = useToast();
  const { data: teams = [], isLoading: teamsLoading } = useTeamsWithLeaders();
  const { data: permissions = [], isLoading: permissionsLoading } = useTeamDashboardPermissions();
  const updatePermission = useUpdateTeamDashboardPermission();

  const isLoading = teamsLoading || permissionsLoading;

  // Get current permission for a team/dashboard combination
  const getPermission = (teamId: string, dashboardSlug: string): DashboardAccessLevel => {
    const perm = permissions.find(
      p => p.team_id === teamId && p.dashboard_slug === dashboardSlug
    );
    return perm?.access_level ?? 'none';
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
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Dashboard Rettigheder
        </CardTitle>
        <CardDescription>
          Tildel adgang til dashboards for hvert team
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Info banner about owner access */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Ejere har altid fuld adgang til alle dashboards uanset disse indstillinger.
          </AlertDescription>
        </Alert>

        {/* Dashboard sections */}
        {DASHBOARD_LIST.map((dashboard) => (
          <div key={dashboard.slug} className="space-y-4">
            {/* Dashboard header */}
            <div className="flex items-center gap-2 border-b pb-2">
              <LayoutDashboard className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg">{dashboard.name}</h3>
            </div>

            {/* Team grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {teams.map((team) => {
                const currentLevel = getPermission(team.id, dashboard.slug);
                const config = accessLevelConfig[currentLevel];
                const IconComponent = config.icon;

                return (
                  <div
                    key={team.id}
                    className="p-4 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex flex-col gap-3">
                      {/* Team name */}
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{team.name}</span>
                        <Badge 
                          variant={config.variant}
                          className={config.className}
                        >
                          <IconComponent className="h-3 w-3 mr-1" />
                          {currentLevel === 'none' ? 'Ingen' : currentLevel === 'all' ? 'Alle' : currentLevel === 'team_leader' ? 'TL' : 'Ledelse'}
                        </Badge>
                      </div>

                      {/* Access level select */}
                      <Select
                        value={currentLevel}
                        onValueChange={(value) => 
                          handlePermissionChange(team.id, dashboard.slug, value as DashboardAccessLevel)
                        }
                        disabled={updatePermission.isPending}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Vælg adgangsniveau..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            <div className="flex items-center gap-2">
                              <UserX className="h-4 w-4 text-muted-foreground" />
                              <span>Ingen adgang</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="team_leader">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-blue-600" />
                              <span>Kun teamleder</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="leadership">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-orange-600" />
                              <span>Ledelse (TL + ATL)</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="all">
                            <div className="flex items-center gap-2">
                              <UsersRound className="h-4 w-4 text-green-600" />
                              <span>Hele teamet</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {teams.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Ingen teams fundet
          </div>
        )}
      </CardContent>
    </Card>
  );
}
