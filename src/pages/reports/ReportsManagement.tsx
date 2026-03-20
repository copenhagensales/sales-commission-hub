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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { CLIENT_IDS } from "@/utils/clientIds";
import { RawSalesTable } from "./RawSalesTable";
import { LocationReportTab } from "./LocationReportTab";

const CLIENT_OPTIONS = Object.entries(CLIENT_IDS).filter(
  ([name]) => name !== "Eesy"
);

interface DetailedRow {
  employee_name: string;
  product_name: string;
  quantity: number;
  commission: number;
  revenue: number;
}

interface RawRow {
  employee_name: string;
  sale_datetime: string;
  product_name: string;
  quantity: number;
  commission: number;
  revenue: number;
  customer_phone: string;
  customer_company: string;
  status: string;
  internal_reference: string;
}

interface EmployeeRow {
  name: string;
  salesCount: number;
  commission: number;
  revenue: number;
  products: Record<string, number>;
}

export default function ReportsManagement() {
  const { t } = useTranslation();

  const [clientId, setClientId] = useState(CLIENT_IDS["Eesy TM"]);
  const [periodStart, setPeriodStart] = useState("2026-01-15");
  const [periodEnd, setPeriodEnd] = useState("2026-02-14");

  const clientLabel = useMemo(
    () => CLIENT_OPTIONS.find(([, id]) => id === clientId)?.[0] ?? "Ukendt",
    [clientId]
  );

  const { data: rawData, isLoading } = useQuery({
    queryKey: ["sales-report-detailed", clientId, periodStart, periodEnd],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_sales_report_detailed", {
        p_client_id: clientId,
        p_start: periodStart,
        p_end: periodEnd,
      });
      if (error) throw error;
      return (data ?? []) as DetailedRow[];
    },
    enabled: !!clientId && !!periodStart && !!periodEnd,
  });

  const { data: rawSalesData, isLoading: isLoadingRaw, isFetching: isFetchingRaw } = useQuery({
    queryKey: ["sales-report-raw", clientId, periodStart, periodEnd],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      const allRows: RawRow[] = [];
      let offset = 0;
      const MAX_PAGES = 50;

      while (allRows.length / PAGE_SIZE < MAX_PAGES) {
        const { data, error } = await supabase.rpc("get_sales_report_raw", {
          p_client_id: clientId,
          p_start: periodStart,
          p_end: periodEnd,
          p_limit: PAGE_SIZE,
          p_offset: offset,
        });
        if (error) throw error;
        if (!data || data.length === 0) break;
        allRows.push(...(data as RawRow[]));
        if (data.length < PAGE_SIZE) break;
        offset += data.length;
      }

      return allRows;
    },
    enabled: !!clientId && !!periodStart && !!periodEnd,
  });

  const { employees, productNames } = useMemo(() => {
    if (!rawData?.length) return { employees: [] as EmployeeRow[], productNames: [] as string[] };

    const empMap = new Map<string, EmployeeRow>();
    const prodSet = new Set<string>();

    for (const row of rawData) {
      prodSet.add(row.product_name);
      let emp = empMap.get(row.employee_name);
      if (!emp) {
        emp = { name: row.employee_name, salesCount: 0, commission: 0, revenue: 0, products: {} };
        empMap.set(row.employee_name, emp);
      }
      emp.salesCount += Number(row.quantity ?? 0);
      emp.commission += Number(row.commission ?? 0);
      emp.revenue += Number(row.revenue ?? 0);
      emp.products[row.product_name] = (emp.products[row.product_name] || 0) + Number(row.quantity ?? 0);
    }

    const sorted = Array.from(empMap.values()).sort((a, b) => b.salesCount - a.salesCount);
    const names = Array.from(prodSet).sort();
    return { employees: sorted, productNames: names };
  }, [rawData]);

  const totals = useMemo(() => {
    const t = { salesCount: 0, commission: 0, revenue: 0, products: {} as Record<string, number> };
    for (const emp of employees) {
      t.salesCount += emp.salesCount;
      t.commission += emp.commission;
      t.revenue += emp.revenue;
      for (const pn of productNames) {
        t.products[pn] = (t.products[pn] || 0) + (emp.products[pn] || 0);
      }
    }
    return t;
  }, [employees, productNames]);

  const periodLabel = `${periodStart}_${periodEnd}`;

  const handleExport = () => {
    if (!employees.length) return;

    const summaryRows = employees.map((emp) => {
      const row: Record<string, string | number> = {
        Medarbejder: emp.name,
        "Antal salg": emp.salesCount,
      };
      for (const pn of productNames) {
        row[pn] = emp.products[pn] || 0;
      }
      row["Provision (DKK)"] = Math.round(emp.commission);
      row["Revenue (DKK)"] = Math.round(emp.revenue);
      return row;
    });

    const totalRow: Record<string, string | number> = {
      Medarbejder: "TOTAL",
      "Antal salg": totals.salesCount,
    };
    for (const pn of productNames) {
      totalRow[pn] = totals.products[pn] || 0;
    }
    totalRow["Provision (DKK)"] = Math.round(totals.commission);
    totalRow["Revenue (DKK)"] = Math.round(totals.revenue);
    summaryRows.push(totalRow);

    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    const colCount = 2 + productNames.length + 2;
    wsSummary["!cols"] = Array.from({ length: colCount }, (_, i) => ({ wch: i === 0 ? 30 : 14 }));

    const rawRows = (rawSalesData ?? []).map((r) => ({
      Dato: r.sale_datetime ? new Date(r.sale_datetime).toLocaleString("da-DK") : "",
      Medarbejder: r.employee_name ?? "",
      Produkt: r.product_name ?? "",
      Antal: r.quantity ?? 1,
      "Provision (DKK)": Math.round(Number(r.commission ?? 0)),
      "Revenue (DKK)": Math.round(Number(r.revenue ?? 0)),
      Telefon: r.customer_phone ?? "",
      Virksomhed: r.customer_company ?? "",
      Status: r.status ?? "",
      Reference: r.internal_reference ?? "",
    }));

    const wsRaw = XLSX.utils.json_to_sheet(rawRows);
    wsRaw["!cols"] = [
      { wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 8 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 20 },
      { wch: 12 }, { wch: 18 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsSummary, "Opsummering");
    XLSX.utils.book_append_sheet(wb, wsRaw, "Rådata");
    XLSX.writeFile(wb, `${clientLabel.toLowerCase().replace(/\s+/g, "-")}-salg-${periodLabel}.xlsx`);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rapporter Ledelse</h1>
          <p className="text-muted-foreground">Ledelsesrapporter og nøgletal</p>
        </div>

        <Tabs defaultValue="salgsrapport">
          <TabsList>
            <TabsTrigger value="salgsrapport">Salgsrapport</TabsTrigger>
            <TabsTrigger value="lokationsrapport">Lokationsrapport</TabsTrigger>
          </TabsList>

          <TabsContent value="salgsrapport">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileSpreadsheet className="h-5 w-5" />
                  Salgsudtræk per medarbejder
                </CardTitle>
                <Button
                  onClick={handleExport}
                  disabled={!employees.length || isLoading || isLoadingRaw || isFetchingRaw}
                  size="sm"
                >
                  {(isLoading || isLoadingRaw || isFetchingRaw) ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Henter data...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-1" />
                      Download Excel{rawSalesData?.length ? ` (${rawSalesData.length.toLocaleString("da-DK")} rækker)` : ""}
                    </>
                  )}
                </Button>
              </CardHeader>

              <CardContent className="space-y-4">
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

                <Tabs defaultValue="opsummering">
                  <TabsList>
                    <TabsTrigger value="opsummering">Opsummering</TabsTrigger>
                    <TabsTrigger value="raadata">Rådata ({rawSalesData?.length ?? 0})</TabsTrigger>
                  </TabsList>

                  <TabsContent value="opsummering">
                    {isLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : !employees.length ? (
                      <p className="text-sm text-muted-foreground py-4">
                        Ingen salgsdata fundet for den valgte periode.
                      </p>
                    ) : (
                      <div className="rounded-md border overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="sticky left-0 bg-background z-10">Medarbejder</TableHead>
                              <TableHead className="text-right">Antal salg</TableHead>
                              {productNames.map((pn) => (
                                <TableHead key={pn} className="text-right whitespace-nowrap">{pn}</TableHead>
                              ))}
                              <TableHead className="text-right">Provision (DKK)</TableHead>
                              <TableHead className="text-right">Revenue (DKK)</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {employees.map((emp) => (
                              <TableRow key={emp.name}>
                                <TableCell className="font-medium sticky left-0 bg-background z-10">{emp.name}</TableCell>
                                <TableCell className="text-right">{emp.salesCount}</TableCell>
                                {productNames.map((pn) => (
                                  <TableCell key={pn} className="text-right">{emp.products[pn] || 0}</TableCell>
                                ))}
                                <TableCell className="text-right">
                                  {Math.round(emp.commission).toLocaleString("da-DK")}
                                </TableCell>
                                <TableCell className="text-right">
                                  {Math.round(emp.revenue).toLocaleString("da-DK")}
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="font-bold border-t-2">
                              <TableCell className="sticky left-0 bg-background z-10">TOTAL</TableCell>
                              <TableCell className="text-right">{totals.salesCount}</TableCell>
                              {productNames.map((pn) => (
                                <TableCell key={pn} className="text-right">{totals.products[pn] || 0}</TableCell>
                              ))}
                              <TableCell className="text-right">
                                {Math.round(totals.commission).toLocaleString("da-DK")}
                              </TableCell>
                              <TableCell className="text-right">
                                {Math.round(totals.revenue).toLocaleString("da-DK")}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="raadata">
                    <RawSalesTable data={rawSalesData} isLoading={isLoading} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="lokationsrapport">
            <LocationReportTab />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}