import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DataImport() {
  return (
    <MainLayout>
      <div className="space-y-6 p-6">
        <h1 className="text-2xl font-bold text-foreground">Data import</h1>
        <Card>
          <CardHeader>
            <CardTitle>Kommer snart</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">Indhold kommer snart.</CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
