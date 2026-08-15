import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function TdcErhvervEditSales() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">TDC Erhverv - ret salg</h1>
          <p className="text-muted-foreground">
            Retning og korrektion af TDC Erhverv salg
          </p>
        </div>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-xl">Kommer snart</CardTitle>
            <CardDescription>Funktionalitet til at rette TDC Erhverv salg.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Indhold tilføjes.</p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
