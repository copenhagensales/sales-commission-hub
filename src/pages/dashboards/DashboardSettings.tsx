import { Settings } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MainLayout } from "@/components/layout/MainLayout";

const DashboardSettings = () => {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Indstilling dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Administrer indstillinger for dashboards
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Dashboard Indstillinger
            </CardTitle>
            <CardDescription>
              Konfigurer dine dashboard-præferencer
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Dashboard indstillinger kommer snart...
            </p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default DashboardSettings;
