import { Navigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { VagtFlowLayout } from "@/components/vagt-flow/VagtFlowLayout";
import { useEesyFmDeviationAccess } from "@/config/eesyFmDeviationAccess";

export default function EesyFmDeviations() {
  const hasAccess = useEesyFmDeviationAccess();

  if (!hasAccess) return <Navigate to="/home" replace />;

  return (
    <VagtFlowLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Eesy FM afvigelser (Leder)</h1>
          <p className="text-muted-foreground">
            Overblik over afvigelser på Eesy FM
          </p>
        </div>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Indhold tilføjes her.
          </CardContent>
        </Card>
      </div>
    </VagtFlowLayout>
  );
}
