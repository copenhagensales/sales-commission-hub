import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const EmployeeOnboardingView = lazy(() => import("./EmployeeOnboardingView"));
const LeaderOnboardingView = lazy(() => import("./LeaderOnboardingView"));
const DrillLibrary = lazy(() => import("./DrillLibrary"));
const OnboardingAdmin = lazy(() => import("./OnboardingAdmin"));

export default function OnboardingDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "employee";

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        <Button 
          variant="ghost" 
          onClick={() => navigate("/")} 
          className="mb-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Tilbage til menu
        </Button>
        
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
          <TabsTrigger value="employee">Min Onboarding</TabsTrigger>
          <TabsTrigger value="leader">Leder</TabsTrigger>
          <TabsTrigger value="drills">Drill-bibliotek</TabsTrigger>
          <TabsTrigger value="admin">Admin</TabsTrigger>
        </TabsList>

        <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
          <TabsContent value="employee" className="space-y-4">
            <EmployeeOnboardingView />
          </TabsContent>

          <TabsContent value="leader" className="space-y-4">
            <LeaderOnboardingView />
          </TabsContent>

          <TabsContent value="drills" className="space-y-4">
            <DrillLibrary />
          </TabsContent>

          <TabsContent value="admin" className="space-y-4">
            <OnboardingAdmin />
          </TabsContent>
        </Suspense>
        </Tabs>
      </div>
    </MainLayout>
  );
}
