import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VagtFlowLayout } from "@/components/vagt-flow/VagtFlowLayout";

const TABS = [
  { value: "upload", label: "Upload" },
  { value: "overview", label: "Oversigt" },
  { value: "raw", label: "Rådata" },
] as const;

export default function EesyFmDeviations() {
  return (
    <VagtFlowLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Afstem automatisk salg</h1>
          <p className="text-muted-foreground">
            Afvigelser på Eesy FM — upload, overblik og rådata
          </p>
        </div>

        <Tabs defaultValue="upload" className="space-y-4">
          <TabsList>
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {TABS.map((tab) => (
            <TabsContent key={tab.value} value={tab.value}>
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardContent className="py-16 text-center text-sm text-muted-foreground">
                  Indhold tilføjes her.
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </VagtFlowLayout>
  );
}
