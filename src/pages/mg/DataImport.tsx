import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS = [
  { value: "manual-upload", label: "Manuelle data upload" },
  { value: "automatic", label: "Automatisk indhentede data" },
  { value: "manual-entry", label: "Manuelle indtastninger" },
];

export default function DataImport() {
  return (
    <MainLayout>
      <div className="space-y-6 p-6">
        <h1 className="text-2xl font-bold text-foreground">Data import</h1>
        <Tabs defaultValue={TABS[0].value}>
          <TabsList className="h-auto gap-2 bg-muted p-1.5">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="cursor-pointer rounded-md border border-border bg-background px-5 py-2.5 text-sm font-semibold text-muted-foreground shadow-sm transition-colors hover:border-primary/50 hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">{t.label}</TabsTrigger>
            ))}
          </TabsList>
          {TABS.map((t) => (
            <TabsContent key={t.value} value={t.value}>
              <Card>
                <CardContent className="pt-6 text-muted-foreground">Indhold kommer snart.</CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </MainLayout>
  );
}
