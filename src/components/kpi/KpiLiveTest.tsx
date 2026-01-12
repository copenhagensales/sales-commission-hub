import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, Clock, Database, BarChart3 } from "lucide-react";
import { useKpiTest, TestPeriod } from "@/hooks/useKpiTest";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface KpiLiveTestProps {
  slug: string;
  name: string;
}

const periodLabels: Record<TestPeriod, string> = {
  today: "I dag",
  yesterday: "I går",
  this_week: "Denne uge",
  this_month: "Denne måned",
  last_30_days: "Sidste 30 dage",
  custom: "Brugerdefineret",
};

export function KpiLiveTest({ slug, name }: KpiLiveTestProps) {
  const [period, setPeriod] = useState<TestPeriod>("this_month");
  const [clientId, setClientId] = useState<string>("");
  const { runTest, isLoading, result, clearResult } = useKpiTest();

  // Fetch clients for filtering
  const { data: clients } = useQuery({
    queryKey: ["clients-for-kpi-test"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const handleRunTest = () => {
    runTest(slug, {
      period,
      clientId: clientId || undefined,
    });
  };

  return (
    <Card className="mt-4 border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Live Test</CardTitle>
        </div>
        <CardDescription>
          Test beregningen af "{name}" mod rigtige data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Parameters */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Periode</Label>
            <Select value={period} onValueChange={(v) => setPeriod(v as TestPeriod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(periodLabels) as TestPeriod[])
                  .filter((p) => p !== "custom")
                  .map((p) => (
                    <SelectItem key={p} value={p}>
                      {periodLabels[p]}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Klient (valgfri)</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Alle klienter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Alle klienter</SelectItem>
                {clients?.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Run button */}
        <Button onClick={handleRunTest} disabled={isLoading} className="w-full">
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Kører test...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Kør test
            </>
          )}
        </Button>

        {/* Results */}
        {result && (
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Resultat</span>
              <span className="text-2xl font-bold text-primary">
                {typeof result.value === "number"
                  ? result.value.toLocaleString("da-DK")
                  : result.value}
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{result.queryTimeMs}ms</span>
              </div>
              {result.rowCount !== undefined && (
                <div className="flex items-center gap-1">
                  <Database className="h-3 w-3" />
                  <span>{result.rowCount} rækker</span>
                </div>
              )}
            </div>

            {result.breakdown && Object.keys(result.breakdown).length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Breakdown
                </span>
                <div className="grid gap-1">
                  {Object.entries(result.breakdown).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between text-sm bg-muted/50 px-3 py-1.5 rounded"
                    >
                      <span>{key}</span>
                      <Badge variant="secondary">
                        {typeof value === "number"
                          ? value.toLocaleString("da-DK")
                          : value}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
