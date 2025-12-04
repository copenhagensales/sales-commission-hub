import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { CalendarIcon, Wallet, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

interface ClientRow {
  id: string;
  name: string | null;
}

interface PayrollSaleItem {
  mapped_commission: number | null;
  mapped_revenue: number | null;
  quantity: number | null;
  adversus_product_title?: string | null;
}

interface PayrollSale {
  id: string;
  sale_datetime: string;
  agent_name: string | null;
  sale_items: PayrollSaleItem[];
}

interface PayrollSummary {
  totalUnits: number;
  totalRevenue: number;
  totalCommission: number;
  perAgent: {
    agentName: string;
    units: number;
    revenue: number;
    commission: number;
  }[];
}

const emptySummary: PayrollSummary = {
  totalUnits: 0,
  totalRevenue: 0,
  totalCommission: 0,
  perAgent: [],
};

interface CancellationMatch {
  saleId: string;
  externalId: string;
  saleDate: string;
  agentName: string | null;
  cancellationDate?: string;
  cancellationStatus?: string;
  oppNumber?: string;
}

interface UnmatchedCancellation {
  externalId: string;
  oppNumber?: string;
  cancellationDate?: string;
  cancellationStatus?: string;
}

interface CancellationSummary {
  totalCancelled: number;
  totalCancelledCommission: number;
  matches: CancellationMatch[];
  unmatched: UnmatchedCancellation[];
}

const emptyCancellations: CancellationSummary = {
  totalCancelled: 0,
  totalCancelledCommission: 0,
  matches: [],
  unmatched: [],
};

interface SearchableSale {
  id: string;
  sale_datetime: string;
  agent_name: string | null;
  customer_company: string | null;
  customer_phone: string | null;
  adversus_external_id: string | null;
  adversus_opp_number: string | null;
  sale_items: PayrollSaleItem[];
}

function getDefaultPayrollPeriod() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const day = today.getDate();

  if (day >= 15) {
    return {
      from: new Date(year, month, 15),
      to: new Date(year, month + 1, 14),
    };
  }

  return {
    from: new Date(year, month - 1, 15),
    to: new Date(year, month, 14),
  };
}

export default function Payroll() {
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>(undefined);
  const defaultPeriod = getDefaultPayrollPeriod();
  const [fromDate, setFromDate] = useState<Date | undefined>(defaultPeriod.from);
  const [toDate, setToDate] = useState<Date | undefined>(defaultPeriod.to);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSale, setSelectedSale] = useState<SearchableSale | null>(null);

  const { data: clients, isLoading: loadingClients } = useQuery<ClientRow[]>({
    queryKey: ["payroll-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");

      if (error) throw error;
      return data as ClientRow[];
    },
  });

  const { data: summary, isLoading: loadingSummary } = useQuery<PayrollSummary>({
    queryKey: [
      "payroll-summary",
      selectedClientId,
      fromDate ? fromDate.toISOString() : undefined,
      toDate ? toDate.toISOString() : undefined,
    ],
    enabled: !!selectedClientId && !!fromDate && !!toDate,
    queryFn: async () => {
      if (!selectedClientId || !fromDate || !toDate) return emptySummary;

      const { data: campaigns, error: campaignsError } = await supabase
        .from("client_campaigns")
        .select("id")
        .eq("client_id", selectedClientId);

      if (campaignsError) throw campaignsError;

      const campaignIds = (campaigns || []).map((c: any) => c.id as string);
      if (!campaignIds.length) return emptySummary;

      const { data: sales, error: salesError } = await supabase
        .from("sales")
        .select(
          "id, sale_datetime, agent_name, sale_items(mapped_commission, mapped_revenue, quantity)"
        )
        .in("client_campaign_id", campaignIds)
        .gte("sale_datetime", fromDate.toISOString())
        .lte("sale_datetime", toDate.toISOString());

      if (salesError) throw salesError;

      const typedSales = (sales || []) as unknown as PayrollSale[];

      let totalUnits = 0;
      let totalRevenue = 0;
      let totalCommission = 0;
      const perAgentMap = new Map<string, { units: number; revenue: number; commission: number }>();

      typedSales.forEach((sale) => {
        const agentName = sale.agent_name && sale.agent_name.trim().length > 0 ? sale.agent_name : "Ukendt";

        sale.sale_items?.forEach((item) => {
          const qty = Number(item.quantity ?? 1) || 1;
          const revenue = Number(item.mapped_revenue) || 0;
          const commission = Number(item.mapped_commission) || 0;

          totalUnits += qty;
          totalRevenue += revenue;
          totalCommission += commission;

          const existing = perAgentMap.get(agentName) || {
            units: 0,
            revenue: 0,
            commission: 0,
          };

          existing.units += qty;
          existing.revenue += revenue;
          existing.commission += commission;

          perAgentMap.set(agentName, existing);
        });
      });

      const perAgent = Array.from(perAgentMap.entries())
        .map(([agentName, values]) => ({ agentName, ...values }))
        .sort((a, b) => a.agentName.localeCompare(b.agentName, "da-DK"));

      return {
        totalUnits,
        totalRevenue,
        totalCommission,
        perAgent,
      } satisfies PayrollSummary;
    },
  });

  const { data: cancellations, isLoading: loadingCancellations } = useQuery<CancellationSummary>({
    queryKey: [
      "payroll-cancellations",
      selectedClientId,
      fromDate ? fromDate.toISOString() : undefined,
      toDate ? toDate.toISOString() : undefined,
    ],
    enabled: !!selectedClientId && !!fromDate && !!toDate,
    queryFn: async () => {
      if (!selectedClientId || !fromDate || !toDate) return emptyCancellations;

      const { data: campaigns, error: campaignsError } = await supabase
        .from("client_campaigns")
        .select("id")
        .eq("client_id", selectedClientId);

      if (campaignsError) throw campaignsError;

      const campaignIds = (campaigns || []).map((c: any) => c.id as string);
      if (!campaignIds.length) return emptyCancellations;

      const { data: sales, error: salesError } = await supabase
        .from("sales")
        .select("id, sale_datetime, agent_name, adversus_external_id")
        .in("client_campaign_id", campaignIds);

      if (salesError) throw salesError;

      const typedSales = (sales || []) as unknown as PayrollSale[];

      const { data: tdcImports, error: tdcError } = await supabase
        .from("tdc_cancellation_imports")
        .select("id, uploaded_at, raw_data")
        .order("uploaded_at", { ascending: false })
        .limit(1);

      if (tdcError) throw tdcError;
      const latest = tdcImports?.[0] as any | undefined;
      if (!latest?.raw_data?.content_base64) return emptyCancellations;

      const base64 = latest.raw_data.content_base64 as string;
      const binary = atob(base64);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const workbook = XLSX.read(bytes, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });

      if (!rows.length) return emptyCancellations;

      const headers = Object.keys(rows[0]);
      const normalize = (header: string) => header.toLowerCase().replace(/[\s_]+/g, "");
      const orderHeader =
        headers.find((h) => {
          const n = normalize(h);
          return (
            n.includes("ordre") ||
            n.includes("ordrenr") ||
            n.includes("ordrenummer") ||
            n.includes("orderid")
          );
        }) || headers[0];

      const oppHeader = headers.find((h) => normalize(h).includes("opp"));

      const dateHeader =
        headers.find((h) => normalize(h).includes("starttidspunkt")) ||
        headers.find((h) => {
          const n = normalize(h);
          return n.includes("dato") || n.includes("date");
        });

      const statusHeader = headers.find((h) => {
        const n = normalize(h);
        return n.includes("status") || n.includes("resultat");
      });

      const cancellationByOrder = new Map<
        string,
        { row: Record<string, any>; date?: string; status?: string; oppNumber?: string }
      >();

      const from = fromDate;
      const to = toDate;

      rows.forEach((row) => {
        const rawOrder = row[orderHeader];
        if (!rawOrder) return;
        const orderId = String(rawOrder).trim();
        if (!orderId) return;

        const rawOpp = oppHeader ? row[oppHeader] : undefined;
        const oppNumber = rawOpp != null && String(rawOpp).trim() !== "" ? String(rawOpp).trim() : undefined;

        let cancellationDate: Date | undefined;
        if (dateHeader) {
          const rawDate = row[dateHeader];
          if (rawDate instanceof Date) {
            cancellationDate = rawDate;
          } else if (typeof rawDate === "number") {
            const parsed = (XLSX as any).SSF?.parse_date_code
              ? (XLSX as any).SSF.parse_date_code(rawDate)
              : null;
            if (parsed) {
              cancellationDate = new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, parsed.S);
            } else {
              const excelEpoch = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
              if (!isNaN(excelEpoch.getTime())) {
                cancellationDate = excelEpoch;
              }
            }
          } else if (typeof rawDate === "string" && rawDate.trim()) {
            const parsed = new Date(rawDate);
            if (!isNaN(parsed.getTime())) {
              cancellationDate = parsed;
            }
          }
        }

        if (!cancellationDate) return;
        if (from && cancellationDate < from) return;
        if (to && cancellationDate > to) return;

        const statusValue = statusHeader ? String(row[statusHeader] ?? "").trim() : undefined;

        cancellationByOrder.set(orderId, {
          row,
          date: format(cancellationDate, "dd.MM.yyyy"),
          status: statusValue,
          oppNumber,
        });
      });

      if (!cancellationByOrder.size) return emptyCancellations;

      const matches: CancellationMatch[] = [];

      typedSales.forEach((sale) => {
        const externalId = (sale as any).adversus_external_id as string | null;
        if (!externalId) return;
        const key = externalId.trim();
        if (!key) return;

        const match = cancellationByOrder.get(key);
        if (!match) return;

        matches.push({
          saleId: sale.id,
          externalId: key,
          saleDate: sale.sale_datetime,
          agentName: sale.agent_name,
          cancellationDate: match.date,
          cancellationStatus: match.status,
          oppNumber: match.oppNumber,
        });
      });

      let totalCancelledCommission = 0;

      if (matches.length) {
        const cancelledSaleIds = matches.map((m) => m.saleId);

        const { data: cancelledSales, error: cancelledSalesError } = await supabase
          .from("sales")
          .select("id, sale_items(mapped_commission, quantity)")
          .in("id", cancelledSaleIds);

        if (cancelledSalesError) throw cancelledSalesError;

        (cancelledSales || []).forEach((sale: any) => {
          (sale.sale_items || []).forEach((item: any) => {
            const qty = Number(item.quantity ?? 1) || 1;
            const commission = Number(item.mapped_commission) || 0;
            totalCancelledCommission += qty * commission;
          });
        });
      }

      const matchedOrderIds = new Set(matches.map((m) => m.externalId));
      const unmatched: UnmatchedCancellation[] = [];

      cancellationByOrder.forEach((value, orderId) => {
        if (!matchedOrderIds.has(orderId)) {
          unmatched.push({
            externalId: orderId,
            oppNumber: value.oppNumber,
            cancellationDate: value.date,
            cancellationStatus: value.status,
          });
        }
      });

      return {
        totalCancelled: matches.length,
        totalCancelledCommission,
        matches,
        unmatched,
      } satisfies CancellationSummary;
    },
  });

  const { data: searchableSales, isLoading: loadingSearchableSales } = useQuery<SearchableSale[]>({
    queryKey: [
      "payroll-search-sales",
      selectedClientId,
    ],
    enabled: !!selectedClientId,
    queryFn: async () => {
      if (!selectedClientId) return [];

      const { data: campaigns, error: campaignsError } = await supabase
        .from("client_campaigns")
        .select("id")
        .eq("client_id", selectedClientId);

      if (campaignsError) throw campaignsError;

      const campaignIds = (campaigns || []).map((c: any) => c.id as string);
      if (!campaignIds.length) return [];

      const { data: sales, error: salesError } = await supabase
        .from("sales")
        .select(
          "id, sale_datetime, agent_name, customer_company, customer_phone, adversus_external_id, adversus_opp_number, sale_items(adversus_product_title, mapped_commission, mapped_revenue, quantity)"
        )
        .in("client_campaign_id", campaignIds);

      if (salesError) throw salesError;

      return (sales || []) as unknown as SearchableSale[];
    },
  });

  useEffect(() => {
    if (!clients || clients.length === 0 || selectedClientId) return;
    setSelectedClientId(clients[0]?.id);
  }, [clients, selectedClientId]);

  const openSaleDetails = (saleId: string) => {
    const sale = (searchableSales || []).find((s) => s.id === saleId);
    if (sale) {
      setSelectedSale(sale);
    }
  };

  const filteredSales = (searchableSales || []).filter((sale) => {
    if (!searchTerm.trim()) return false;
    const term = searchTerm.trim().toLowerCase();
    const inExternalId = sale.adversus_external_id?.toLowerCase().includes(term) ?? false;
    const inOppAdversus = sale.adversus_opp_number?.toLowerCase().includes(term) ?? false;
    const inPhone = sale.customer_phone?.toLowerCase().includes(term) ?? false;
    const inCompany = sale.customer_company?.toLowerCase().includes(term) ?? false;
    const inAgent = sale.agent_name?.toLowerCase().includes(term) ?? false;

    const matchFromCancellations = cancellations?.matches.find((m) => m.saleId === sale.id);
    const inOpp = matchFromCancellations?.oppNumber?.toLowerCase().includes(term) ?? false;
    const inCancelOrderId = matchFromCancellations?.externalId?.toLowerCase().includes(term) ?? false;

    return inExternalId || inOppAdversus || inPhone || inCompany || inAgent || inOpp || inCancelOrderId;
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="w-full md:w-[260px]">
            <Select
              value={selectedClientId}
              onValueChange={setSelectedClientId}
              disabled={loadingClients || !clients || clients.length === 0}
            >
              <SelectTrigger className="w-full bg-background">
                <SelectValue
                  placeholder={loadingClients ? "Indlæser kunder..." : "Vælg kunde (fra MG test)"}
                />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {clients?.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name ?? "Ukendt kunde"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center">
            <span className="text-sm text-muted-foreground md:w-28">Lønperiode</span>
            <div className="flex flex-1 flex-col gap-2 sm:flex-row">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !fromDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fromDate ? format(fromDate, "dd.MM.yyyy") : <span>Fra (15.)</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={fromDate}
                    onSelect={setFromDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !toDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {toDate ? format(toDate, "dd.MM.yyyy") : <span>Til (14.)</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={toDate}
                    onSelect={setToDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Lønkørsler
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedClientId || !fromDate || !toDate ? (
              <div className="text-center py-8 text-muted-foreground">
                Vælg kunde og lønperiode for at se et overblik over salg til lønkørsel.
              </div>
            ) : loadingSummary ? (
              <div className="text-center py-8 text-muted-foreground">Henter salg for valgt periode...</div>
            ) : !summary || summary.totalUnits === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Ingen registrerede salg for den valgte kunde i den valgte periode.
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg border bg-muted/40 p-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Antal salg (stk.)
                    </p>
                    <p className="mt-2 text-2xl font-bold">{summary.totalUnits}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/40 p-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Omsætning
                    </p>
                    <p className="mt-2 text-2xl font-bold">
                      {summary.totalRevenue.toLocaleString("da-DK")} DKK
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/40 p-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Provision
                    </p>
                    <p className="mt-2 text-2xl font-bold">
                      {summary.totalCommission.toLocaleString("da-DK")} DKK
                    </p>
                  </div>
                </div>

                {cancellations && !loadingCancellations && (
                  <p className="text-sm text-muted-foreground">
                    Total annulleret provision i perioden ({cancellations.totalCancelled ?? 0} salg):{" "}
                    <span className="font-semibold">
                      {(cancellations.totalCancelledCommission ?? 0).toLocaleString("da-DK")} DKK
                    </span>
                  </p>
                )}

                <div>
                  <p className="text-sm font-medium mb-2">Fordeling pr. agent</p>
                  <div className="overflow-hidden rounded-lg border bg-muted/40">
                    <div className="grid grid-cols-5 gap-2 border-b bg-muted px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      <span>Agent</span>
                      <span className="text-right">Salg (stk.)</span>
                      <span className="text-right">Annullerede salg</span>
                      <span className="text-right">Omsætning</span>
                      <span className="text-right">Provision</span>
                    </div>
                    <div className="divide-y divide-border">
                      {summary.perAgent.map((row) => {
                        const cancelledCount =
                          cancellations?.matches.filter((m) => {
                            const agentName =
                              m.agentName && m.agentName.trim().length > 0 ? m.agentName : "Ukendt";
                            return agentName === row.agentName;
                          }).length ?? 0;

                        return (
                          <div key={row.agentName} className="grid grid-cols-5 gap-2 px-4 py-2 text-sm">
                            <span>{row.agentName}</span>
                            <span className="text-right">{row.units}</span>
                            <span className="text-right">{cancelledCount}</span>
                            <span className="text-right">
                              {row.revenue.toLocaleString("da-DK")} DKK
                            </span>
                            <span className="text-right">
                              {row.commission.toLocaleString("da-DK")} DKK
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Annullerede salg i perioden
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedClientId || !fromDate || !toDate ? (
              <div className="text-center py-6 text-muted-foreground">
                Vælg kunde og lønperiode for at se matchede annulleringer.
              </div>
            ) : loadingCancellations ? (
              <div className="text-center py-6 text-muted-foreground">Henter annulleringer...</div>
            ) : !cancellations || cancellations.totalCancelled === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                Ingen annulleringer fundet i TDC-ann filen for salg i den valgte periode.
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {cancellations.totalCancelled} salg er matchet mellem Adversus (ordre-id) og seneste
                  TDC-ann Excel-fil.
                </p>
                <div className="rounded-lg border bg-muted/40 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ordre-id (Adversus)</TableHead>
                        <TableHead>Salgsdato</TableHead>
                        <TableHead>Agent</TableHead>
                        <TableHead>Annulleringsdato</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cancellations.matches.map((m) => (
                        <TableRow
                          key={m.saleId + m.externalId}
                          className="cursor-pointer hover:bg-accent/40"
                          onClick={() => openSaleDetails(m.saleId)}
                        >
                          <TableCell className="font-mono text-xs">{m.externalId}</TableCell>
                          <TableCell>
                            {m.saleDate ? format(new Date(m.saleDate), "dd.MM.yyyy") : "-"}
                          </TableCell>
                          <TableCell>{m.agentName ?? "Ukendt"}</TableCell>
                          <TableCell>{m.cancellationDate || "-"}</TableCell>
                          <TableCell>{m.cancellationStatus || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
              Annulleringer uden match (kun i Excel)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedClientId || !fromDate || !toDate ? (
              <div className="text-center py-6 text-muted-foreground">
                Vælg kunde og lønperiode for at se annulleringer uden match.
              </div>
            ) : loadingCancellations ? (
              <div className="text-center py-6 text-muted-foreground">Henter annulleringer...</div>
            ) : !cancellations || cancellations.unmatched.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                Alle annulleringer i perioden er matchet til salg.
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {cancellations.unmatched.length} annulleringer findes i TDC-ann Excel-filen, men kunne ikke
                  matches til salg (ordre-id) i systemet.
                </p>
                <div className="rounded-lg border bg-muted/40 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ordre-id (Excel)</TableHead>
                        <TableHead>OPP-nummer</TableHead>
                        <TableHead>Annulleringsdato</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cancellations.unmatched.map((u) => (
                        <TableRow key={u.externalId + (u.cancellationDate || "")}>
                          <TableCell className="font-mono text-xs">{u.externalId}</TableCell>
                          <TableCell className="font-mono text-xs">{u.oppNumber || "-"}</TableCell>
                          <TableCell>{u.cancellationDate || "-"}</TableCell>
                          <TableCell>{u.cancellationStatus || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Søg TDC-salg</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedClientId || !fromDate || !toDate ? (
              <div className="text-center py-6 text-muted-foreground">
                Vælg kunde og lønperiode for at søge efter salg.
              </div>
            ) : (
              <div className="space-y-4">
                <Input
                  placeholder="Søg på OPP-nummer, ordre-id, telefon, kundenavn eller agent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-md"
                />

                {searchTerm.trim() && loadingSearchableSales && (
                  <div className="text-sm text-muted-foreground">Søger efter salg...</div>
                )}

                {searchTerm.trim() && !loadingSearchableSales && filteredSales.length === 0 && (
                  <div className="text-sm text-muted-foreground">Ingen salg matcher din søgning.</div>
                )}

                {searchTerm.trim() && filteredSales.length > 0 && (
                  <div className="rounded-lg border bg-muted/40 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Dato</TableHead>
                          <TableHead>Agent</TableHead>
                          <TableHead>Kunde</TableHead>
                          <TableHead>Telefon</TableHead>
                          <TableHead>Ordre-id</TableHead>
                          <TableHead className="text-right">Salg (stk.)</TableHead>
                          <TableHead className="text-right">Provision</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSales.map((sale) => {
                          const units = (sale.sale_items || []).reduce((sum, item) => {
                            const qty = Number(item.quantity ?? 1) || 1;
                            return sum + qty;
                          }, 0);

                          const commission = (sale.sale_items || []).reduce((sum, item) => {
                            const qty = Number(item.quantity ?? 1) || 1;
                            const c = Number(item.mapped_commission) || 0;
                            return sum + qty * c;
                          }, 0);

                          return (
                            <TableRow
                              key={sale.id}
                              className="cursor-pointer hover:bg-accent/40"
                              onClick={() => setSelectedSale(sale)}
                            >
                              <TableCell>
                                {sale.sale_datetime
                                  ? format(new Date(sale.sale_datetime), "dd.MM.yyyy")
                                  : "-"}
                              </TableCell>
                              <TableCell>{sale.agent_name ?? "Ukendt"}</TableCell>
                              <TableCell>{sale.customer_company ?? "-"}</TableCell>
                              <TableCell>{sale.customer_phone ?? "-"}</TableCell>
                              <TableCell className="font-mono text-xs">
                                {sale.adversus_external_id ?? "-"}
                              </TableCell>
                              <TableCell className="text-right">{units}</TableCell>
                              <TableCell className="text-right">
                                {commission.toLocaleString("da-DK")} DKK
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <Dialog open={!!selectedSale} onOpenChange={(open) => !open && setSelectedSale(null)}>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Detaljer for salg</DialogTitle>
                      <DialogDescription>
                        {selectedSale?.adversus_external_id
                          ? `Ordre-id: ${selectedSale.adversus_external_id}`
                          : "Detaljer for valgt salg"}
                      </DialogDescription>
                    </DialogHeader>
                    {selectedSale && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-muted-foreground">Dato</p>
                            <p className="font-medium">
                              {selectedSale.sale_datetime
                                ? format(new Date(selectedSale.sale_datetime), "dd.MM.yyyy")
                                : "-"}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Agent</p>
                            <p className="font-medium">{selectedSale.agent_name ?? "Ukendt"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Kunde</p>
                            <p className="font-medium">{selectedSale.customer_company ?? "-"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Telefon</p>
                            <p className="font-medium">{selectedSale.customer_phone ?? "-"}</p>
                          </div>
                        </div>

                        <div className="rounded-lg border bg-muted/40 overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Produkt</TableHead>
                                <TableHead className="text-right">Antal</TableHead>
                                <TableHead className="text-right">Provision pr. stk.</TableHead>
                                <TableHead className="text-right">Provision i alt</TableHead>
                                <TableHead className="text-right">Omsætning</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedSale.sale_items.map((item, index) => {
                                const qty = Number(item.quantity ?? 1) || 1;
                                const commissionPerUnit = Number(item.mapped_commission) || 0;
                                const revenuePerUnit = Number(item.mapped_revenue) || 0;
                                const lineCommission = qty * commissionPerUnit;
                                const lineRevenue = qty * revenuePerUnit;

                                return (
                                  <TableRow key={index}>
                                    <TableCell>{item.adversus_product_title ?? "Ukendt produkt"}</TableCell>
                                    <TableCell className="text-right">{qty}</TableCell>
                                    <TableCell className="text-right">
                                      {commissionPerUnit.toLocaleString("da-DK")} DKK
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {lineCommission.toLocaleString("da-DK")} DKK
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {lineRevenue.toLocaleString("da-DK")} DKK
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
