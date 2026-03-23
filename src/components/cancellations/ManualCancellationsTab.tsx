import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Loader2, AlertCircle, ShoppingCart, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { EditCartDialog } from "./EditCartDialog";
import { CLIENT_IDS } from "@/utils/clientIds";

const RELATEL_CLIENT_ID = CLIENT_IDS["Relatel"];

interface ManualCancellationsTabProps {
  clientId: string;
}

export function ManualCancellationsTab({ clientId: selectedClientId }: ManualCancellationsTabProps) {
  // Fetch sales based on filters
  const { data: sales = [], isLoading: isLoadingSales } = useQuery({
    queryKey: ["sales-for-cancellations", selectedClientId, dateFrom, dateTo],
    queryFn: async () => {
      if (!selectedClientId) return [];

      const { data: campaigns } = await supabase
        .from("client_campaigns")
        .select("id")
        .eq("client_id", selectedClientId);

      const campaignIds = campaigns?.map(c => c.id) || [];
      if (campaignIds.length === 0) return [];

      let query = supabase
        .from("sales")
        .select("id, created_at, sale_datetime, customer_phone, customer_company, validation_status, agent_name, raw_payload, normalized_data")
        .in("client_campaign_id", campaignIds)
        .order("sale_datetime", { ascending: false })
        .limit(1000);

      if (dateFrom) {
        query = query.gte("sale_datetime", format(dateFrom, "yyyy-MM-dd"));
      }
      if (dateTo) {
        query = query.lte("sale_datetime", format(dateTo, "yyyy-MM-dd") + "T23:59:59");
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClientId,
  });

  // Unique agents from current results
  const agentsInResults = useMemo(() => {
    const names = new Set<string>();
    for (const sale of sales) {
      if (sale.agent_name) names.add(sale.agent_name);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, "da"));
  }, [sales]);

  const matchesSearch = (sale: typeof sales[number], term: string): boolean => {
    const lower = term.toLowerCase();
    const nd = sale.normalized_data as Record<string, unknown> | null;
    const rp = sale.raw_payload as Record<string, unknown> | null;

    const directFields = [sale.customer_phone, sale.customer_company, sale.agent_name];

    const ndKeys = [
      'customer_name', 'customer_email', 'customer_address',
      'customer_city', 'customer_zip', 'phone_number',
      'external_reference', 'lead_id', 'member_number',
      'product_name', 'subscription_type', 'campaign_name',
      'akasse_type', 'current_akasse', 'association_type',
      'lonsikring_type', 'coverage_amount'
    ];
    const ndFields = ndKeys.map(k => nd?.[k]);

    const rpDirect = ['CustomerName','CustomerPhone','CustomerCompany','uniqueId','leadId'].map(k => rp?.[k]);
    const lrf = rp?.leadResultFields as Record<string, unknown> | null;
    const lrfValues = lrf ? Object.values(lrf) : [];

    const all = [...directFields, ...ndFields, ...rpDirect, ...lrfValues];
    return all.some(f => f != null && String(f).toLowerCase().includes(lower));
  };

  // Filter sales by selected agent and search term
  const filteredSales = useMemo(() => {
    let result = sales;
    if (selectedAgent) result = result.filter(s => s.agent_name === selectedAgent);
    if (searchTerm.trim()) result = result.filter(s => matchesSearch(s, searchTerm.trim()));
    return result;
  }, [sales, selectedAgent, searchTerm]);

  const getCompanyDisplay = (sale: typeof filteredSales[number]) => {
    if (sale.customer_company) return sale.customer_company;
    if (selectedClientId === RELATEL_CLIENT_ID && sale.raw_payload) {
      const payload = sale.raw_payload as any;
      const salesId = payload?.leadResultFields?.['Sales ID'];
      if (salesId) return salesId;
    }
    return "-";
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "approved":
        return <Badge variant="default">Godkendt</Badge>;
      case "rejected":
        return <Badge variant="destructive">Afvist</Badge>;
      case "pending":
        return <Badge variant="secondary">Afventer</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="text-muted-foreground">Annulleret</Badge>;
      default:
        return <Badge variant="secondary">{status || "Ukendt"}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="space-y-2">
          <Label htmlFor="client-select">Vælg kunde</Label>
          <Select value={selectedClientId} onValueChange={(v) => { setSelectedClientId(v); setSelectedAgent(""); }}>
            <SelectTrigger id="client-select">
              <SelectValue placeholder="Vælg en kunde..." />
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Fra dato</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, "dd/MM/yyyy", { locale: da }) : "Vælg dato..."}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="pointer-events-auto" locale={da} />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>Til dato</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, "dd/MM/yyyy", { locale: da }) : "Vælg dato..."}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="pointer-events-auto" locale={da} />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label htmlFor="search">Søg (alle felter)</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Søg..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Vælg medarbejder</Label>
          <Select value={selectedAgent || "all"} onValueChange={(v) => setSelectedAgent(v === "all" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Alle medarbejdere" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle medarbejdere</SelectItem>
              {agentsInResults.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results */}
      {!selectedClientId ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <AlertCircle className="h-12 w-12 mb-4" />
          <p>Vælg en kunde for at se salg</p>
        </div>
      ) : isLoadingSales ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredSales.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <p>Ingen salg fundet med de valgte filtre</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Salgsdato</TableHead>
                <TableHead>Sælger</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Virksomhed</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Handling</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell>
                    {sale.sale_datetime
                      ? format(new Date(sale.sale_datetime), "dd/MM/yyyy", { locale: da })
                      : "-"}
                  </TableCell>
                  <TableCell>{sale.agent_name || "-"}</TableCell>
                  <TableCell>{sale.customer_phone || "-"}</TableCell>
                  <TableCell>{getCompanyDisplay(sale)}</TableCell>
                  <TableCell>{getStatusBadge(sale.validation_status)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedSaleId(sale.id)}
                    >
                      <ShoppingCart className="h-4 w-4 mr-1" />
                      Rediger kurv
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {sales.length >= 1000 && (
        <div className="flex items-center justify-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p>
            <strong>Advarsel:</strong> Der er flere end 1.000 salg i den valgte periode. Nogle salg og medarbejdere kan mangle. Indsnævr med datofiltre for at se alle.
          </p>
        </div>
      )}

      <EditCartDialog
        saleId={selectedSaleId}
        open={!!selectedSaleId}
        onClose={() => setSelectedSaleId(null)}
      />
    </div>
  );
}
