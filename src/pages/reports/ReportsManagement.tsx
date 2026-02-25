import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { CLIENT_IDS } from "@/utils/clientIds";

const CLIENT_OPTIONS = Object.entries(CLIENT_IDS).filter(
  // Remove duplicate "Eesy" (same id as "Eesy TM")
  ([name]) => name !== "Eesy"
);

export default function ReportsManagement() {
  const { t } = useTranslation();

  const [clientId, setClientId] = useState(CLIENT_IDS["Eesy TM"]);
  const [periodStart, setPeriodStart] = useState("2026-01-15");
  const [periodEnd, setPeriodEnd] = useState("2026-02-14");

  const clientLabel = useMemo(
    () => CLIENT_OPTIONS.find(([, id]) => id === clientId)?.[0] ?? "Ukendt",
    [clientId]
  );

  const { data: aggregatedData, isLoading } = useQuery({
    queryKey: ["sales-report", clientId, periodStart, periodEnd],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_sales_aggregates_v2", {
        p_client_id: clientId,
        p_start: periodStart,
        p_end: periodEnd,
        p_group_by: "employee",
      });
      if (error) throw error;
      return (data ?? [])
        .map((r: any) => ({
          name: r.group_name || r.group_key || "Ukendt",
          salesCount: Number(r.total_sales ?? 0),
          commission: Number(r.total_commission ?? 0),
        }))
        .sort((a: any, b: any) => b.salesCount - a.salesCount);
    },
    enabled: !!clientId && !!periodStart && !!periodEnd,
  });

  const totalSales = useMemo(
    () => (aggregatedData ?? []).reduce((s, e) => s + e.salesCount, 0),
    [aggregatedData]
  );
  const totalCommission = useMemo(
    () => (aggregatedData ?? []).reduce((s, e) => s + e.commission, 0),
    [aggregatedData]
  );

  const periodLabel = `${periodStart}_${periodEnd}`;

  const handleExport = () => {
    if (!aggregatedData?.length) return;
    const rows = aggregatedData.map((emp) => ({
      Medarbejder: emp.name,
      "Antal salg": emp.salesCount,
      "Provision (DKK)": Math.round(emp.commission),
    }));
    rows.push({
      Medarbejder: "TOTAL",
      "Antal salg": totalSales,
      "Provision (DKK)": Math.round(totalCommission),
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    // Auto-size columns
    ws["!cols"] = [{ wch: 30 }, { wch: 12 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${clientLabel} Salg`);
    XLSX.writeFile(wb, `${clientLabel.toLowerCase().replace(/\s+/g, "-")}-salg-${periodLabel}.xlsx`);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rapporter Ledelse</h1>
          <p className="text-muted-foreground">Ledelsesrapporter og nøgletal</p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileSpreadsheet className="h-5 w-5" />
              Salgsudtræk per medarbejder
            </CardTitle>
            <Button
              onClick={handleExport}
              disabled={!aggregatedData?.length}
              size="sm"
            >
              <Download className="h-4 w-4 mr-1" />
              Download Excel
            </Button>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1 min-w-[180px]">
                <Label>Klient</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLIENT_OPTIONS.map(([name, id]) => (
                      <SelectItem key={id} value={id}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Fra</Label>
                <Input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="w-[160px]"
                />
              </div>
              <div className="space-y-1">
                <Label>Til</Label>
                <Input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="w-[160px]"
                />
              </div>
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !aggregatedData?.length ? (
              <p className="text-sm text-muted-foreground py-4">
                Ingen salgsdata fundet for den valgte periode.
              </p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Medarbejder</TableHead>
                      <TableHead className="text-right">Antal salg</TableHead>
                      <TableHead className="text-right">Provision (DKK)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aggregatedData.map((emp) => (
                      <TableRow key={emp.name}>
                        <TableCell className="font-medium">{emp.name}</TableCell>
                        <TableCell className="text-right">{emp.salesCount}</TableCell>
                        <TableCell className="text-right">
                          {Math.round(emp.commission).toLocaleString("da-DK")}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold border-t-2">
                      <TableCell>TOTAL</TableCell>
                      <TableCell className="text-right">{totalSales}</TableCell>
                      <TableCell className="text-right">
                        {Math.round(totalCommission).toLocaleString("da-DK")}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
