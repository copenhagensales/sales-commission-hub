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
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
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
