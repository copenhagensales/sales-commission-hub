import { useState, useMemo, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MainLayout } from "@/components/layout/MainLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Download, Search, Upload, Trash2, TrendingUp, Package, DollarSign, Ban, PhoneOff, BarChart3, Users } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { normalizePhoneNumber } from "@/lib/phone-utils";
import { useCurrentEmployeeId } from "@/hooks/useOnboarding";
import { useDropzone } from "react-dropzone";
import ExcelJS from "exceljs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

type MatchResult = {
  phone: string;
  type: "cancelled" | "billable";
  matched?: {
    saleId: string;
    agentName: string;
    agentEmail: string;
    saleDate: string;
    product: string;
    customerCompany: string;
    internalReference: string;
  };
  category: "matched_cancellation" | "unmatched_cancellation" | "unverified_sale" | "verified_sale";
};

function parsePhoneLines(text: string): string[] {
  return text
    .split(/[\n\r,;]+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => normalizePhoneNumber(line))
    .filter((p): p is string => p !== null);
}

export default function SalesValidation() {
  const [clientId, setClientId] = useState<string>("");
  const [periodMonth, setPeriodMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Textarea states
  const [billableText, setBillableText] = useState("");
  const [cancelledText, setCancelledText] = useState("");

  // Excel fallback states
  const [showExcelUpload, setShowExcelUpload] = useState(false);
  const [showColumnMapping, setShowColumnMapping] = useState(false);
  const [uploadedRows, setUploadedRows] = useState<Record<string, string>[]>([]);
  const [uploadedHeaders, setUploadedHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [phoneCol, setPhoneCol] = useState("");
  const [statusCol, setStatusCol] = useState("");
  const [billableValue, setBillableValue] = useState("fakturerbar");
  const [cancelledValue, setCancelledValue] = useState("annulleret");

  const { data: employeeId } = useCurrentEmployeeId();

  const { data: clients } = useQuery({
    queryKey: ["clients-for-validation"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name").order("name");
      return data || [];
    },
  });

  const { data: previousUploads, refetch: refetchUploads } = useQuery({
    queryKey: ["sales-validation-uploads", clientId, periodMonth],
    queryFn: async () => {
      if (!clientId) return [];
      const { data } = await supabase
        .from("sales_validation_uploads")
        .select("*")
        .eq("client_id", clientId)
        .eq("period_month", periodMonth)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!clientId,
  });

  // Aggregated sales stats for selected client + period
  const { data: salesStats } = useQuery({
    queryKey: ["sales-validation-stats", clientId, periodMonth],
    queryFn: async () => {
      const [yearStr, monthStr] = periodMonth.split("-");
      const startDate = `${yearStr}-${monthStr}-01`;
      const endMonth = parseInt(monthStr);
      const endYear = parseInt(yearStr);
      const nextMonth = endMonth === 12 ? 1 : endMonth + 1;
      const nextYear = endMonth === 12 ? endYear + 1 : endYear;
      const endDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

      const { data: campaigns } = await supabase
        .from("client_campaigns")
        .select("id")
        .eq("client_id", clientId);
      const campaignIds = (campaigns || []).map((c) => c.id);
      if (campaignIds.length === 0) return { totalSales: 0, totalRevenue: 0, totalCommission: 0, withPhone: 0, withoutPhone: 0 };

      const { data } = await supabase
        .from("sale_items")
        .select("quantity, mapped_revenue, mapped_commission, sale_id, sales!inner(sale_datetime, client_campaign_id, validation_status)")
        .in("sales.client_campaign_id", campaignIds)
        .gte("sales.sale_datetime", startDate)
        .lt("sales.sale_datetime", endDate)
        .neq("sales.validation_status", "rejected");

      const items = data || [];

      // Count sales with/without phone
      const { count: totalSalesCount } = await supabase
        .from("sales")
        .select("id", { count: "exact", head: true })
        .in("client_campaign_id", campaignIds)
        .gte("sale_datetime", startDate)
        .lt("sale_datetime", endDate)
        .neq("validation_status", "rejected");

      const { count: withPhoneCount } = await supabase
        .from("sales")
        .select("id", { count: "exact", head: true })
        .in("client_campaign_id", campaignIds)
        .gte("sale_datetime", startDate)
        .lt("sale_datetime", endDate)
        .neq("validation_status", "rejected")
        .not("customer_phone", "is", null)
        .neq("customer_phone", "");

      const withPhone = withPhoneCount || 0;
      const withoutPhone = (totalSalesCount || 0) - withPhone;

      return {
        totalSales: items.reduce((sum, i) => sum + (i.quantity || 1), 0),
        totalRevenue: items.reduce((sum, i) => sum + (i.mapped_revenue || 0), 0),
        totalCommission: items.reduce((sum, i) => sum + (i.mapped_commission || 0), 0),
        withPhone,
        withoutPhone,
      };
    },
    enabled: !!clientId && !!periodMonth,
  });

  const monthOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("da-DK", { year: "numeric", month: "long" });
      opts.push({ value: val, label });
    }
    return opts;
  }, []);

  // Live counters
  const billableCount = useMemo(() => parsePhoneLines(billableText).length, [billableText]);
  const cancelledCount = useMemo(() => parsePhoneLines(cancelledText).length, [cancelledText]);

  // Core matching logic (shared between textarea and excel flows)
  const runMatching = async (billablePhones: Set<string>, cancelledPhones: Set<string>, sourceName: string) => {
    setIsProcessing(true);
    try {
      const [yearStr, monthStr] = periodMonth.split("-");
      const startDate = `${yearStr}-${monthStr}-01`;
      const endMonth = parseInt(monthStr);
      const endYear = parseInt(yearStr);
      const nextMonth = endMonth === 12 ? 1 : endMonth + 1;
      const nextYear = endMonth === 12 ? endYear + 1 : endYear;
      const endDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

      const { data: campaigns } = await supabase
        .from("client_campaigns")
        .select("id")
        .eq("client_id", clientId);

      const campaignIds = (campaigns || []).map((c) => c.id);
      if (campaignIds.length === 0) {
        toast.error("Ingen kampagner fundet for denne kunde");
        setIsProcessing(false);
        return;
      }

      const { data: salesData } = await supabase
        .from("sales")
        .select("id, agent_name, agent_email, sale_datetime, customer_phone, customer_company, internal_reference, client_campaign_id, sale_items(id, adversus_product_title, product_id, products(name))")
        .in("client_campaign_id", campaignIds)
        .gte("sale_datetime", startDate)
        .lt("sale_datetime", endDate)
        .neq("validation_status", "rejected")
        .order("sale_datetime", { ascending: false })
        .limit(5000);

      const sales = salesData || [];

      const salesByPhone = new Map<string, typeof sales[0][]>();
      for (const sale of sales) {
        const norm = normalizePhoneNumber(sale.customer_phone);
        if (!norm) continue;
        if (!salesByPhone.has(norm)) salesByPhone.set(norm, []);
        salesByPhone.get(norm)!.push(sale);
      }

      const matchResults: MatchResult[] = [];

      const getProduct = (sale: any) =>
        sale.sale_items?.[0]?.products?.name ||
        sale.sale_items?.[0]?.adversus_product_title ||
        "Ukendt";

      const toMatched = (sale: any) => ({
        saleId: sale.id,
        agentName: sale.agent_name || "Ukendt",
        agentEmail: sale.agent_email || "",
        saleDate: sale.sale_datetime || "",
        product: getProduct(sale),
        customerCompany: sale.customer_company || "",
        internalReference: sale.internal_reference || "",
      });

      // Category 1 & 2: cancellations
      for (const phone of cancelledPhones) {
        const matchedSales = salesByPhone.get(phone);
        if (matchedSales && matchedSales.length > 0) {
          matchResults.push({ phone, type: "cancelled", category: "matched_cancellation", matched: toMatched(matchedSales[0]) });
        } else {
          matchResults.push({ phone, type: "cancelled", category: "unmatched_cancellation" });
        }
      }

      // Category 3: unverified sales
      for (const [salePhone, saleList] of salesByPhone) {
        if (!billablePhones.has(salePhone) && !cancelledPhones.has(salePhone)) {
          for (const sale of saleList) {
            matchResults.push({ phone: salePhone, type: "billable", category: "unverified_sale", matched: toMatched(sale) });
          }
        }
      }

      // Category 4: verified sales
      for (const phone of billablePhones) {
        const matchedSales = salesByPhone.get(phone);
        if (matchedSales) {
          for (const sale of matchedSales) {
            matchResults.push({ phone, type: "billable", category: "verified_sale", matched: toMatched(sale) });
          }
        }
      }

      setResults(matchResults);

      const matched = matchResults.filter((r) => r.category === "matched_cancellation").length;
      const unmatched = matchResults.filter((r) => r.category === "unmatched_cancellation").length;
      const unverified = matchResults.filter((r) => r.category === "unverified_sale").length;

      await supabase.from("sales_validation_uploads").insert({
        client_id: clientId,
        period_month: periodMonth,
        file_name: sourceName,
        total_billable: billablePhones.size,
        total_cancelled: cancelledPhones.size,
        matched_cancellations: matched,
        unmatched_cancellations: unmatched,
        unverified_sales: unverified,
        uploaded_by: employeeId || null,
        results_json: { results: matchResults },
      });

      refetchUploads();
      setBillableText("");
      setCancelledText("");
      toast.success(`Validering fuldført: ${matched} matchede annulleringer, ${unmatched} umatchede, ${unverified} uverificerede salg`);
    } catch (e) {
      console.error(e);
      toast.error("Fejl under validering");
    } finally {
      setIsProcessing(false);
    }
  };

  // Textarea-based validation
  const processFromTextarea = () => {
    if (!clientId) {
      toast.error("Vælg en kunde først");
      return;
    }
    const billable = new Set(parsePhoneLines(billableText));
    const cancelled = new Set(parsePhoneLines(cancelledText));
    if (billable.size === 0 && cancelled.size === 0) {
      toast.error("Indsæt mindst ét telefonnummer");
      return;
    }
    runMatching(billable, cancelled, "copy-paste");
  };

  // Excel-based validation (kept as secondary)
  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const workbook = new ExcelJS.Workbook();
      const buffer = await file.arrayBuffer();
      await workbook.xlsx.load(buffer);
      const sheet = workbook.worksheets[0];
      if (!sheet) { toast.error("Ingen ark fundet i filen"); return; }

      const headers: string[] = [];
      const rows: Record<string, string>[] = [];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
          row.eachCell((cell, colNumber) => { headers.push(String(cell.value || `Kolonne ${colNumber}`)); });
        } else {
          const rowData: Record<string, string> = {};
          row.eachCell((cell, colNumber) => {
            const header = headers[colNumber - 1] || `col_${colNumber}`;
            rowData[header] = String(cell.value || "");
          });
          rows.push(rowData);
        }
      });

      setUploadedHeaders(headers);
      setUploadedRows(rows);
      const phoneLike = headers.find((h) => /telefon|phone|tlf|mobil|nummer/i.test(h));
      const statusLike = headers.find((h) => /status|type|kategori|faktu/i.test(h));
      if (phoneLike) setPhoneCol(phoneLike);
      if (statusLike) setStatusCol(statusLike);
      setShowColumnMapping(true);
    } catch {
      toast.error("Kunne ikke læse filen");
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
    },
    maxFiles: 1,
  });

  const processFromExcel = () => {
    if (!clientId || !phoneCol) { toast.error("Vælg kunde og telefonnummer-kolonne"); return; }
    setShowColumnMapping(false);
    const billableSet = new Set<string>();
    const cancelledSet = new Set<string>();
    for (const row of uploadedRows) {
      const rawPhone = row[phoneCol];
      if (!rawPhone) continue;
      const normalized = normalizePhoneNumber(rawPhone);
      if (!normalized) continue;
      let type: "billable" | "cancelled" = "billable";
      if (statusCol && row[statusCol]) {
        const val = row[statusCol].toLowerCase().trim();
        if (val.includes(cancelledValue.toLowerCase()) || val.includes("annuller") || val.includes("cancel") || val.includes("afvist")) {
          type = "cancelled";
        }
      }
      if (type === "cancelled") cancelledSet.add(normalized);
      else billableSet.add(normalized);
    }
    runMatching(billableSet, cancelledSet, fileName);
  };

  const uniqueStatusValues = useMemo(() => {
    if (!statusCol || uploadedRows.length === 0) return [];
    const vals = new Set(uploadedRows.map((r) => r[statusCol]).filter(Boolean));
    return Array.from(vals);
  }, [statusCol, uploadedRows]);

  // Export
  const exportResults = async () => {
    if (!results) return;
    const workbook = new ExcelJS.Workbook();
    const addSheet = (name: string, items: MatchResult[]) => {
      const sheet = workbook.addWorksheet(name);
      sheet.addRow(["Telefon", "Kategori", "Sælger", "Salgsdato", "Produkt", "Firma", "Ref."]);
      sheet.getRow(1).font = { bold: true };
      for (const r of items) {
        sheet.addRow([r.phone, r.category, r.matched?.agentName || "", r.matched?.saleDate ? new Date(r.matched.saleDate).toLocaleDateString("da-DK") : "", r.matched?.product || "", r.matched?.customerCompany || "", r.matched?.internalReference || ""]);
      }
      sheet.columns.forEach((col) => { col.width = 20; });
    };
    addSheet("Matchede annulleringer", results.filter((r) => r.category === "matched_cancellation"));
    addSheet("Umatchede annulleringer", results.filter((r) => r.category === "unmatched_cancellation"));
    addSheet("Uverificerede salg", results.filter((r) => r.category === "unverified_sale"));
    addSheet("Verificerede salg", results.filter((r) => r.category === "verified_sale"));
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `salgsvalidering_${periodMonth}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadPreviousResult = (upload: any) => {
    const data = upload.results_json as any;
    if (data?.results) setResults(data.results);
  };

  const filteredResults = useMemo(() => {
    if (!results) return null;
    const term = searchTerm.toLowerCase();
    return results.filter((r) =>
      !term || r.phone.includes(term) || r.matched?.agentName?.toLowerCase().includes(term) || r.matched?.product?.toLowerCase().includes(term) || r.matched?.customerCompany?.toLowerCase().includes(term)
    );
  }, [results, searchTerm]);

  const matchedCancellations = filteredResults?.filter((r) => r.category === "matched_cancellation") || [];
  const unmatchedCancellations = filteredResults?.filter((r) => r.category === "unmatched_cancellation") || [];
  const unverifiedSales = filteredResults?.filter((r) => r.category === "unverified_sale") || [];
  const verifiedSales = filteredResults?.filter((r) => r.category === "verified_sale") || [];

  // Seller stats aggregation
  const sellerStats = useMemo(() => {
    if (!results) return [];
    const map = new Map<string, { name: string; verified: number; unverified: number; cancellations: number }>();
    for (const r of results) {
      const name = r.matched?.agentName || "Ukendt";
      if (!map.has(name)) map.set(name, { name, verified: 0, unverified: 0, cancellations: 0 });
      const s = map.get(name)!;
      if (r.category === "verified_sale") s.verified++;
      else if (r.category === "unverified_sale") s.unverified++;
      else if (r.category === "matched_cancellation") s.cancellations++;
    }
    return Array.from(map.values())
      .map((s) => ({
        ...s,
        total: s.verified + s.unverified + s.cancellations,
        rate: s.verified + s.unverified > 0 ? Math.round((s.verified / (s.verified + s.unverified)) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [results]);

  const sellerTotals = useMemo(() => {
    if (sellerStats.length === 0) return null;
    const t = { total: 0, verified: 0, unverified: 0, cancellations: 0 };
    for (const s of sellerStats) {
      t.total += s.total;
      t.verified += s.verified;
      t.unverified += s.unverified;
      t.cancellations += s.cancellations;
    }
    const rate = t.verified + t.unverified > 0 ? Math.round((t.verified / (t.verified + t.unverified)) * 100) : 0;
    return { ...t, rate };
  }, [sellerStats]);
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Salgsvalidering</h1>
            <p className="text-muted-foreground">Valider salg og annulleringer mod jeres registreringer</p>
          </div>
          {results && (
            <Button onClick={exportResults} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Eksportér til Excel
            </Button>
          )}
        </div>

        {/* Controls */}
        <div className="flex gap-4 items-end flex-wrap">
          <div className="space-y-1">
            <Label>Kunde</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Vælg kunde" />
              </SelectTrigger>
              <SelectContent>
                {clients?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Periode</Label>
            <Select value={periodMonth} onValueChange={setPeriodMonth}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* KPI Cards */}
        {clientId && (
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            {/* Always visible: base stats */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Package className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Registrerede salg</span>
              </div>
              <p className="text-2xl font-bold">{salesStats?.totalSales?.toLocaleString("da-DK") ?? "–"}</p>
              {salesStats && salesStats.withPhone > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {salesStats.withPhone} m/tlf · {salesStats.withoutPhone} uden
                </p>
              )}
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Omsætning</span>
              </div>
              <p className="text-2xl font-bold">{salesStats ? `${Math.round(salesStats.totalRevenue).toLocaleString("da-DK")} kr` : "–"}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Provision</span>
              </div>
              <p className="text-2xl font-bold">{salesStats ? `${Math.round(salesStats.totalCommission).toLocaleString("da-DK")} kr` : "–"}</p>
            </Card>
            <Card className="p-4 border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2 mb-1">
                <PhoneOff className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span className="text-xs font-medium text-muted-foreground">Uden telefonnr.</span>
              </div>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{salesStats?.withoutPhone?.toLocaleString("da-DK") ?? "–"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Kan ikke auto-valideres</p>
            </Card>

            {/* Post-validation stats */}
            {results && (
              <>
                <Card className="p-4 border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <span className="text-xs font-medium text-muted-foreground">Verificerede</span>
                  </div>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{verifiedSales.length}</p>
                </Card>
                <Card className="p-4 border-orange-200 dark:border-orange-800">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    <span className="text-xs font-medium text-muted-foreground">Uverificerede</span>
                  </div>
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{unverifiedSales.length}</p>
                </Card>
                <Card className="p-4 border-destructive/30">
                  <div className="flex items-center gap-2 mb-1">
                    <Ban className="h-4 w-4 text-destructive" />
                    <span className="text-xs font-medium text-muted-foreground">Annulleringer</span>
                  </div>
                  <p className="text-2xl font-bold text-destructive">
                    {matchedCancellations.length + unmatchedCancellations.length}
                    <span className="text-sm font-normal text-muted-foreground ml-1">
                      ({matchedCancellations.length} matchet)
                    </span>
                  </p>
                </Card>
              </>
            )}
          </div>
        )}

        {/* Tabs for Validation vs Seller overview */}
        {clientId && (
          <Tabs defaultValue="validation" className="space-y-4">
            <TabsList>
              <TabsTrigger value="validation" className="gap-2">
                <ShieldCheck className="h-4 w-4" />
                Validering
              </TabsTrigger>
              <TabsTrigger value="sellers" className="gap-2">
                <Users className="h-4 w-4" />
                Sælgeroversigt
              </TabsTrigger>
            </TabsList>

            <TabsContent value="validation" className="space-y-6">
              {/* Textarea input */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Godkendte/fakturerbare salg (telefonnumre)
                    </Label>
                    <Textarea
                      value={billableText}
                      onChange={(e) => setBillableText(e.target.value)}
                      placeholder={"52512853\n22334455\n40302010\n..."}
                      className="min-h-[200px] font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      {billableCount > 0 ? `${billableCount} numre registreret` : "Ét nummer per linje"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-destructive" />
                      Annullerede salg (telefonnumre)
                    </Label>
                    <Textarea
                      value={cancelledText}
                      onChange={(e) => setCancelledText(e.target.value)}
                      placeholder={"40302010\n11223344\n..."}
                      className="min-h-[200px] font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      {cancelledCount > 0 ? `${cancelledCount} numre registreret` : "Ét nummer per linje"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <Button onClick={processFromTextarea} disabled={isProcessing || (billableCount === 0 && cancelledCount === 0)} className="gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    {isProcessing ? "Behandler..." : "Validér salg"}
                  </Button>
                  <Button variant="ghost" size="sm" className="text-muted-foreground gap-1" onClick={() => setShowExcelUpload(!showExcelUpload)}>
                    <Upload className="h-3 w-3" />
                    {showExcelUpload ? "Skjul Excel-upload" : "Eller upload Excel-fil"}
                  </Button>
                </div>

                {/* Excel upload fallback */}
                {showExcelUpload && (
                  <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                      isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                    }`}
                  >
                    <input {...getInputProps()} />
                    <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium">Træk en Excel-fil hertil eller klik for at vælge</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Filen skal indeholde telefonnumre og evt. en status-kolonne
                    </p>
                  </div>
                )}
              </div>

              {/* Summary cards */}
              {results && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <XCircle className="h-4 w-4 text-destructive" />
                        <span className="text-sm font-medium">Matchede annulleringer</span>
                      </div>
                      <p className="text-2xl font-bold">{matchedCancellations.length}</p>
                      <p className="text-xs text-muted-foreground">Sælger identificeret – kan trækkes</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        <span className="text-sm font-medium">Umatchede annulleringer</span>
                      </div>
                      <p className="text-2xl font-bold">{unmatchedCancellations.length}</p>
                      <p className="text-xs text-muted-foreground">Kan ikke placeres på en sælger</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        <span className="text-sm font-medium">Uverificerede salg</span>
                      </div>
                      <p className="text-2xl font-bold">{unverifiedSales.length}</p>
                      <p className="text-xs text-muted-foreground">Ikke bekræftet af kunden</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-medium">Verificerede salg</span>
                      </div>
                      <p className="text-2xl font-bold">{verifiedSales.length}</p>
                      <p className="text-xs text-muted-foreground">Bekræftet fakturerbare</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Search */}
              {results && (
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Søg telefon, sælger, produkt..." className="pl-9" />
                </div>
              )}

              {/* Results tables */}
              {matchedCancellations.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-destructive" />
                      Matchede annulleringer – sælger identificeret ({matchedCancellations.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Telefon</TableHead>
                          <TableHead>Sælger</TableHead>
                          <TableHead>Salgsdato</TableHead>
                          <TableHead>Produkt</TableHead>
                          <TableHead>Firma</TableHead>
                          <TableHead>Ref.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {matchedCancellations.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-sm">{r.phone}</TableCell>
                            <TableCell className="font-medium">{r.matched?.agentName}</TableCell>
                            <TableCell>{r.matched?.saleDate ? new Date(r.matched.saleDate).toLocaleDateString("da-DK") : ""}</TableCell>
                            <TableCell>{r.matched?.product}</TableCell>
                            <TableCell>{r.matched?.customerCompany}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{r.matched?.internalReference}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {unmatchedCancellations.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      Umatchede annulleringer – kan ikke placeres ({unmatchedCancellations.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Telefon</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {unmatchedCancellations.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-sm">{r.phone}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-orange-600 border-orange-300">Ingen match i jeres salg</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {unverifiedSales.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      Uverificerede salg – ikke bekræftet af kunden ({unverifiedSales.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Telefon</TableHead>
                          <TableHead>Sælger</TableHead>
                          <TableHead>Salgsdato</TableHead>
                          <TableHead>Produkt</TableHead>
                          <TableHead>Firma</TableHead>
                          <TableHead>Ref.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {unverifiedSales.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-sm">{r.phone}</TableCell>
                            <TableCell className="font-medium">{r.matched?.agentName}</TableCell>
                            <TableCell>{r.matched?.saleDate ? new Date(r.matched.saleDate).toLocaleDateString("da-DK") : ""}</TableCell>
                            <TableCell>{r.matched?.product}</TableCell>
                            <TableCell>{r.matched?.customerCompany}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{r.matched?.internalReference}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Previous uploads */}
              {previousUploads && previousUploads.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Tidligere valideringer</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Dato</TableHead>
                          <TableHead>Kilde</TableHead>
                          <TableHead>Fakturerbare</TableHead>
                          <TableHead>Annullerede</TableHead>
                          <TableHead>Matchede</TableHead>
                          <TableHead>Umatchede</TableHead>
                          <TableHead>Uverificerede</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previousUploads.map((u: any) => (
                          <TableRow key={u.id}>
                            <TableCell>{new Date(u.created_at).toLocaleDateString("da-DK")}</TableCell>
                            <TableCell className="text-sm">{u.file_name}</TableCell>
                            <TableCell>{u.total_billable}</TableCell>
                            <TableCell>{u.total_cancelled}</TableCell>
                            <TableCell>{u.matched_cancellations}</TableCell>
                            <TableCell>{u.unmatched_cancellations}</TableCell>
                            <TableCell>{u.unverified_sales}</TableCell>
                            <TableCell className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={() => loadPreviousResult(u)}>Vis</Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Slet validering?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Dette sletter valideringen fra {new Date(u.created_at).toLocaleDateString("da-DK")} permanent. Handlingen kan ikke fortrydes.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Annuller</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      onClick={async () => {
                                        const { error } = await supabase.from("sales_validation_uploads").delete().eq("id", u.id);
                                        if (error) {
                                          toast.error("Kunne ikke slette valideringen");
                                        } else {
                                          toast.success("Validering slettet");
                                          refetchUploads();
                                        }
                                      }}
                                    >
                                      Slet
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="sellers" className="space-y-4">
              {!results ? (
                <Card className="p-8 text-center">
                  <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-lg font-medium">Ingen valideringsdata</p>
                  <p className="text-sm text-muted-foreground mt-1">Kør en validering eller indlæs en tidligere for at se sælgeroversigten</p>
                </Card>
              ) : (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Sælgeroversigt ({sellerStats.length} sælgere)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Sælger</TableHead>
                          <TableHead className="text-right">Totale salg</TableHead>
                          <TableHead className="text-right">Verificerede</TableHead>
                          <TableHead className="text-right">Uverificerede</TableHead>
                          <TableHead className="text-right">Annulleringer</TableHead>
                          <TableHead className="text-right">Verificeringsrate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sellerStats.map((s) => (
                          <TableRow key={s.name}>
                            <TableCell className="font-medium">{s.name}</TableCell>
                            <TableCell className="text-right">{s.total}</TableCell>
                            <TableCell className="text-right text-green-600 dark:text-green-400">{s.verified}</TableCell>
                            <TableCell className="text-right text-orange-600 dark:text-orange-400">{s.unverified}</TableCell>
                            <TableCell className="text-right text-destructive">{s.cancellations}</TableCell>
                            <TableCell className="text-right">
                              <Badge
                                variant="outline"
                                className={
                                  s.rate > 80
                                    ? "border-green-300 text-green-600 dark:border-green-700 dark:text-green-400"
                                    : s.rate >= 50
                                    ? "border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400"
                                    : "border-destructive/50 text-destructive"
                                }
                              >
                                {s.rate}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        {sellerTotals && (
                          <TableRow className="font-bold border-t-2">
                            <TableCell>Total</TableCell>
                            <TableCell className="text-right">{sellerTotals.total}</TableCell>
                            <TableCell className="text-right text-green-600 dark:text-green-400">{sellerTotals.verified}</TableCell>
                            <TableCell className="text-right text-orange-600 dark:text-orange-400">{sellerTotals.unverified}</TableCell>
                            <TableCell className="text-right text-destructive">{sellerTotals.cancellations}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline">{sellerTotals.rate}%</Badge>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </MainLayout>
  );
}
