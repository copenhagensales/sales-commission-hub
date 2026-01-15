import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchParams } from "react-router-dom";
import { Suspense, lazy, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { useUnifiedPermissions } from "@/hooks/useUnifiedPermissions";

const EmployeeOnboardingView = lazy(() => import("./EmployeeOnboardingView"));
const ExpectationsRamp = lazy(() => import("./ExpectationsRamp"));
const LeaderOnboardingView = lazy(() => import("./LeaderOnboardingView"));
const DrillLibrary = lazy(() => import("./DrillLibrary"));
const OnboardingAdmin = lazy(() => import("./OnboardingAdmin"));
const FeedbackTemplatePreview = lazy(() => import("./FeedbackTemplatePreview"));

// Tab configuration with permission keys
const allTabs = [
  { value: "overview", label: "Oversigt", permissionKey: "tab_onboarding_overview" },
  { value: "ramp", label: "Forventninger", permissionKey: "tab_onboarding_ramp" },
  { value: "leader", label: "Leder", permissionKey: "tab_onboarding_leader" },
  { value: "drills", label: "Drill-bibliotek", permissionKey: "tab_onboarding_drills" },
  { value: "template", label: "Skabelon", permissionKey: "tab_onboarding_template" },
  { value: "admin", label: "Admin", permissionKey: "tab_onboarding_admin" },
];

export default function OnboardingDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { canView, isLoading } = useUnifiedPermissions();
  
  // Filter tabs based on permissions
  const visibleTabs = useMemo(() => 
    allTabs.filter(tab => canView(tab.permissionKey)),
    [canView]
  );
  
  // Default to first visible tab
  const defaultTab = visibleTabs[0]?.value || "overview";
  const urlTab = searchParams.get("tab");
  const activeTab = urlTab && visibleTabs.some(t => t.value === urlTab) ? urlTab : defaultTab;

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (visibleTabs.length === 0) {
    return (
      <MainLayout>
        <div className="text-center py-12 text-muted-foreground">
          Du har ikke adgang til denne side.
        </div>
      </MainLayout>
    );
  }

  // Dynamic grid columns class
  const gridColsClass = `grid-cols-${Math.min(visibleTabs.length, 6)}`;

  return (
    <MainLayout>
      <div className="space-y-4">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <TabsList className={`grid w-full ${gridColsClass} lg:w-auto lg:inline-flex`}>
            {visibleTabs.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
            {visibleTabs.some(t => t.value === "overview") && (
              <TabsContent value="overview" className="space-y-4">
                <EmployeeOnboardingView />
              </TabsContent>
            )}

            {visibleTabs.some(t => t.value === "ramp") && (
              <TabsContent value="ramp" className="space-y-4">
                <ExpectationsRamp />
              </TabsContent>
            )}

            {visibleTabs.some(t => t.value === "leader") && (
              <TabsContent value="leader" className="space-y-4">
                <LeaderOnboardingView />
              </TabsContent>
            )}

            {visibleTabs.some(t => t.value === "drills") && (
              <TabsContent value="drills" className="space-y-4">
                <DrillLibrary />
              </TabsContent>
            )}

            {visibleTabs.some(t => t.value === "template") && (
              <TabsContent value="template" className="space-y-4">
                <FeedbackTemplatePreview />
              </TabsContent>
            )}

            {visibleTabs.some(t => t.value === "admin") && (
              <TabsContent value="admin" className="space-y-4">
                <OnboardingAdmin />
              </TabsContent>
            )}
          </Suspense>
        </Tabs>
      </div>
    </MainLayout>
  );
}