import { Settings, BarChart3 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

        <Tabs defaultValue="kpis" className="w-full">
          <TabsList>
            <TabsTrigger value="kpis" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              KPI'er
            </TabsTrigger>
          </TabsList>

          <TabsContent value="kpis" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  KPI Indstillinger
                </CardTitle>
                <CardDescription>
                  Konfigurer KPI'er for dine dashboards
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  KPI indstillinger kommer snart...
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default DashboardSettings;
