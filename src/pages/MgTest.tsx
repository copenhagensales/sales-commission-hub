import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MgTest() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <header>
          <h1 className="text-3xl font-bold">MG test</h1>
          <p className="text-muted-foreground">
            Intern testside til MG-relateret indhold og eksperimenter.
          </p>
        </header>
        <section>
          <Card>
            <CardHeader>
              <CardTitle>MG test overview</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Denne side er en placeholder til fremtidige MG-testfunktioner. Sig til, hvad du gerne vil have vist her.
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </MainLayout>
  );
}
