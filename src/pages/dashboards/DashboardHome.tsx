import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAccessibleDashboards } from "@/hooks/useTeamDashboardPermissions";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, ArrowRight, Clock, Sparkles } from "lucide-react";
import { DASHBOARD_LIST } from "@/config/dashboards";

const LAST_VISITED_KEY = "last-visited-dashboard";

export default function DashboardHome() {
  const navigate = useNavigate();
  const { data: accessibleDashboards = [], isLoading } = useAccessibleDashboards();
  const { user } = useAuth();
  const [lastVisited, setLastVisited] = useState<string | null>(null);

  // Fetch employee name
  const { data: employeeData } = useQuery({
    queryKey: ["employee-name", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("employee_master_data")
        .select("first_name")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    const stored = localStorage.getItem(LAST_VISITED_KEY);
    if (stored) {
      setLastVisited(stored);
    }
  }, []);

  const handleNavigateToDashboard = (path: string, name: string) => {
    localStorage.setItem(LAST_VISITED_KEY, JSON.stringify({ path, name }));
    navigate(path);
  };

  const getLastVisitedData = () => {
    try {
      return lastVisited ? JSON.parse(lastVisited) : null;
    } catch {
      return null;
    }
  };

  const lastVisitedData = getLastVisitedData();
  const firstName = employeeData?.first_name || "bruger";

  // Get descriptions from config
  const getDashboardDescription = (slug: string) => {
    const config = DASHBOARD_LIST.find(d => d.slug === slug);
    return config?.description || "Se dashboard for detaljer";
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-muted-foreground">Indlæser dashboards...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container max-w-7xl mx-auto py-8 px-4 sm:px-6">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              Velkommen, {firstName}
            </h1>
          </div>
          <p className="text-muted-foreground text-lg ml-13">
            Vælg et dashboard nedenfor for at komme i gang
          </p>
        </div>

        {/* Last Visited Quick Access */}
        {lastVisitedData && accessibleDashboards.some(d => d.path === lastVisitedData.path) && (
          <div className="mb-8">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <Clock className="h-4 w-4" />
              <span>Fortsæt hvor du slap</span>
            </div>
            <Button
              variant="outline"
              size="lg"
              className="gap-3 h-auto py-4 px-6 border-primary/20 hover:border-primary/40 hover:bg-primary/5"
              onClick={() => handleNavigateToDashboard(lastVisitedData.path, lastVisitedData.name)}
            >
              <LayoutDashboard className="h-5 w-5 text-primary" />
              <span className="font-medium">{lastVisitedData.name}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        )}

        {/* Dashboard Grid */}
        {accessibleDashboards.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <LayoutDashboard className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                Ingen dashboards tilgængelige
              </h3>
              <p className="text-sm text-muted-foreground/70 text-center max-w-md">
                Du har ikke adgang til nogen dashboards endnu. Kontakt din administrator for at få tildelt adgang.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {accessibleDashboards.map((dashboard) => (
              <Card
                key={dashboard.slug}
                className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-primary/30 hover:-translate-y-1"
                onClick={() => handleNavigateToDashboard(dashboard.path, dashboard.name)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <LayoutDashboard className="h-5 w-5 text-primary" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                  <CardTitle className="text-lg mt-3 group-hover:text-primary transition-colors">
                    {dashboard.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="line-clamp-2">
                    {getDashboardDescription(dashboard.slug)}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-12 text-center text-sm text-muted-foreground/60">
          {accessibleDashboards.length > 0 && (
            <p>
              Du har adgang til {accessibleDashboards.length} dashboard{accessibleDashboards.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
