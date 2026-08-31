import { MainLayout } from "@/components/layout/MainLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTrygEditAccess } from "@/hooks/useTrygEditAccess";

export default function TrygEditSales() {
  const { hasAccess, isLoading } = useTrygEditAccess();

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tryg - Ret salg</h1>
          <p className="text-muted-foreground">
            Retning og annullering af Tryg salg
          </p>
        </div>

        {!isLoading && !hasAccess ? (
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-xl">Ingen adgang</CardTitle>
              <CardDescription>
                Du har ikke adgang til at rette Tryg salg.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-xl">Tryg salg</CardTitle>
              <CardDescription>Indhold tilføjes</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Funktionen er endnu ikke bygget.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
