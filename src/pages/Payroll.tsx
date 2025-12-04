import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ClientRow {
  id: string;
  name: string | null;
}

interface PayrollSaleItem {
  mapped_commission: number | null;
  mapped_revenue: number | null;
  quantity: number | null;
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

function getDefaultPayrollPeriod() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-indexed
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

  useEffect(() => {
    if (!clients || clients.length === 0 || selectedClientId) return;
    setSelectedClientId(clients[0]?.id);
  }, [clients, selectedClientId]);

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

                <div>
                  <p className="text-sm font-medium mb-2">Fordeling pr. agent</p>
                  <div className="overflow-hidden rounded-lg border bg-muted/40">
                    <div className="grid grid-cols-4 gap-2 border-b bg-muted px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      <span>Agent</span>
                      <span className="text-right">Salg (stk.)</span>
                      <span className="text-right">Omsætning</span>
                      <span className="text-right">Provision</span>
                    </div>
                    <div className="divide-y divide-border">
                      {summary.perAgent.map((row) => (
                        <div key={row.agentName} className="grid grid-cols-4 gap-2 px-4 py-2 text-sm">
                          <span>{row.agentName}</span>
                          <span className="text-right">{row.units}</span>
                          <span className="text-right">
                            {row.revenue.toLocaleString("da-DK")} DKK
                          </span>
                          <span className="text-right">
                            {row.commission.toLocaleString("da-DK")} DKK
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
