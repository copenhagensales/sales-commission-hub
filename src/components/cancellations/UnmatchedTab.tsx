import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Clock, ArrowUpDown, ArrowUp, ArrowDown, Search } from "lucide-react";
import { format } from "date-fns";
import { extractOpp } from "./utils/extractOpp";

type SortKey = "date" | "agent" | "opp" | "revenue" | "phone" | "company";
type SortDir = "asc" | "desc";

interface UnmatchedTabProps {
  clientId: string;
}

export function UnmatchedTab({ clientId }: UnmatchedTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sellerFilter, setSellerFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { data: campaignIds = [] } = useQuery({
    queryKey: ["client-campaigns-ids", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_campaigns")
        .select("id")
        .eq("client_id", clientId);
      if (error) throw error;
      return (data || []).map(c => c.id);
    },
    enabled: !!clientId,
  });

  const { data: queueSaleIds = [] } = useQuery({
    queryKey: ["cancellation-queue-all-sale-ids"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cancellation_queue")
        .select("sale_id");
      if (error) throw error;
      return (data || []).map(q => q.sale_id);
    },
  });

  const queueSaleIdSet = new Set(queueSaleIds);

  const { data: pendingSales = [], isLoading } = useQuery({
    queryKey: ["pending-sales-not-in-queue", clientId, campaignIds, queueSaleIds],
    queryFn: async () => {
      if (campaignIds.length === 0) return [];

      const { data: sales, error } = await supabase
        .from("sales")
        .select("id, sale_datetime, customer_phone, customer_company, agent_name, raw_payload, client_campaign_id")
        .in("client_campaign_id", campaignIds)
        .eq("validation_status", "pending")
        .order("sale_datetime", { ascending: false })
        .limit(2000);
      if (error) throw error;

      const filtered = (sales || []).filter(s => !queueSaleIdSet.has(s.id));

      if (filtered.length > 0) {
        const saleIds = filtered.map(s => s.id);
        const { data: items } = await supabase
          .from("sale_items")
          .select("sale_id, quantity, mapped_commission, mapped_revenue, product:products(name)")
          .in("sale_id", saleIds.slice(0, 500));

        const itemsBySale: Record<string, typeof items> = {};
        (items || []).forEach(item => {
          if (!itemsBySale[item.sale_id]) itemsBySale[item.sale_id] = [];
          itemsBySale[item.sale_id].push(item);
        });

        return filtered.map(s => ({ ...s, saleItems: itemsBySale[s.id] || [] }));
      }

      return filtered.map(s => ({ ...s, saleItems: [] as any[] }));
    },
    enabled: !!clientId && campaignIds.length > 0,
  });

  // Unique sellers for filter
  const sellers = useMemo(() => {
    const names = [...new Set(pendingSales.map(s => s.agent_name || "Ukendt"))].sort();
    return names;
  }, [pendingSales]);

  // Filter + search + sort
  const processedSales = useMemo(() => {
    let result = [...pendingSales];

    // Seller filter
    if (sellerFilter !== "all") {
      result = result.filter(s => (s.agent_name || "Ukendt") === sellerFilter);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s => {
        const opp = extractOpp(s.raw_payload);
        const products = (s.saleItems || []).map((si: any) => si.product?.name || "").join(" ");
        return [
          s.agent_name,
          s.customer_phone,
          s.customer_company,
          opp,
          products,
          s.sale_datetime ? format(new Date(s.sale_datetime), "dd/MM/yyyy") : "",
        ].some(v => v && v.toLowerCase().includes(q));
      });
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "date":
          cmp = (a.sale_datetime || "").localeCompare(b.sale_datetime || "");
          break;
        case "agent":
          cmp = (a.agent_name || "").localeCompare(b.agent_name || "");
          break;
        case "opp":
          cmp = extractOpp(a.raw_payload).localeCompare(extractOpp(b.raw_payload));
          break;
        case "revenue": {
          const ra = (a.saleItems || []).reduce((sum: number, si: any) => sum + (si.mapped_revenue || 0), 0);
          const rb = (b.saleItems || []).reduce((sum: number, si: any) => sum + (si.mapped_revenue || 0), 0);
          cmp = ra - rb;
          break;
        }
        case "phone":
          cmp = (a.customer_phone || "").localeCompare(b.customer_phone || "");
          break;
        case "company":
          cmp = (a.customer_company || "").localeCompare(b.customer_company || "");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [pendingSales, sellerFilter, searchQuery, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "asc");
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  if (!clientId) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>Vælg en kunde i toppen for at se afventende salg.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Afventende salg
          <Badge variant="secondary">{processedSales.length}</Badge>
        </CardTitle>
        <CardDescription>
          Salg med status "pending" som endnu ikke er i annullerings- eller kurvrettelseskøen
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Søg i alle felter..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={sellerFilter} onValueChange={setSellerFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Alle sælgere" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle sælgere</SelectItem>
              {sellers.map(name => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Indlæser...</p>
        ) : processedSales.length === 0 ? (
          <div className="flex items-center gap-2 text-muted-foreground py-4">
            <AlertCircle className="h-4 w-4" />
            <span>Ingen afventende salg fundet.</span>
          </div>
        ) : (
          <div className="overflow-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort("date")}>
                    <span className="flex items-center">Dato <SortIcon column="date" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort("agent")}>
                    <span className="flex items-center">Sælger <SortIcon column="agent" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort("opp")}>
                    <span className="flex items-center">OPP <SortIcon column="opp" /></span>
                  </TableHead>
                  <TableHead>Produkter</TableHead>
                  <TableHead className="cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort("revenue")}>
                    <span className="flex items-center">Omsætning <SortIcon column="revenue" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort("phone")}>
                    <span className="flex items-center">Telefon <SortIcon column="phone" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort("company")}>
                    <span className="flex items-center">Virksomhed <SortIcon column="company" /></span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processedSales.map(sale => {
                  const products = (sale.saleItems || [])
                    .map((si: any) => si.product?.name || "Ukendt")
                    .filter(Boolean);
                  const revenue = (sale.saleItems || [])
                    .reduce((sum: number, si: any) => sum + (si.mapped_revenue || 0), 0);
                  return (
                    <TableRow key={sale.id}>
                      <TableCell className="whitespace-nowrap">
                        {sale.sale_datetime ? format(new Date(sale.sale_datetime), "dd/MM/yyyy") : "-"}
                      </TableCell>
                      <TableCell>{sale.agent_name || "-"}</TableCell>
                      <TableCell>{extractOpp(sale.raw_payload) || "-"}</TableCell>
                      <TableCell>
                        {products.length > 0
                          ? products.map((p: string, i: number) => (
                              <Badge key={i} variant="outline" className="mr-1 mb-1">{p}</Badge>
                            ))
                          : <span className="text-muted-foreground">-</span>
                        }
                      </TableCell>
                      <TableCell className="font-mono">
                        {revenue > 0 ? `${Math.round(revenue).toLocaleString("da-DK")} kr` : "-"}
                      </TableCell>
                      <TableCell>{sale.customer_phone || "-"}</TableCell>
                      <TableCell>{sale.customer_company || "-"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
