import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet } from "lucide-react";

export default function Payroll() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Lønkørsel</h1>
          <p className="text-muted-foreground">Overblik over lønkørsler (fase 2)</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Lønkørsler
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              Lønkørsels-beregning bliver implementeret i fase 2.
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
