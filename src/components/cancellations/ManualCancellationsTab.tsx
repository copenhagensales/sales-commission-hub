import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, AlertCircle, X } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { CancellationDialog } from "./CancellationDialog";

export function ManualCancellationsTab() {
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);

  // Fetch clients
  const { data: clients = [], isLoading: isLoadingClients } = useQuery({
    queryKey: ["clients-for-cancellations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch sales based on filters
  const { data: sales = [], isLoading: isLoadingSales } = useQuery({
    queryKey: ["sales-for-cancellations", selectedClientId, searchTerm, dateFrom, dateTo],
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
        .select(`
          id,
          created_at,
          sale_datetime,
          customer_phone,
          customer_company,
          validation_status,
          agent_name
        `)
        .in("client_campaign_id", campaignIds)
        .neq("validation_status", "cancelled")
        .order("sale_datetime", { ascending: false })
        .limit(100);

      if (dateFrom) {
        query = query.gte("sale_datetime", dateFrom);
      }
      if (dateTo) {
        query = query.lte("sale_datetime", dateTo + "T23:59:59");
      }
      if (searchTerm) {
        query = query.or(`customer_phone.ilike.%${searchTerm}%,customer_company.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClientId,
  });

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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="client-select">Vælg kunde</Label>
          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
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
          <Label htmlFor="date-from">Fra dato</Label>
          <Input
            id="date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="date-to">Til dato</Label>
          <Input
            id="date-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="search">Søg (telefon/virksomhed)</Label>
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
      ) : sales.length === 0 ? (
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
              {sales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell>
                    {sale.sale_datetime
                      ? format(new Date(sale.sale_datetime), "dd/MM/yyyy", { locale: da })
                      : "-"}
                  </TableCell>
                  <TableCell>{sale.agent_name || "-"}</TableCell>
                  <TableCell>{sale.customer_phone || "-"}</TableCell>
                  <TableCell>{sale.customer_company || "-"}</TableCell>
                  <TableCell>{getStatusBadge(sale.validation_status)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setSelectedSaleId(sale.id)}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Annuller/afvis
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {sales.length === 100 && (
        <p className="text-sm text-muted-foreground text-center">
          Viser de første 100 resultater. Brug filtre for at indsnævre søgningen.
        </p>
      )}

      <CancellationDialog
        saleId={selectedSaleId}
        open={!!selectedSaleId}
        onClose={() => setSelectedSaleId(null)}
      />
    </div>
  );
}
