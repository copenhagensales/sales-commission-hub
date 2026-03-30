import { useState, useMemo } from "react";
import { CLIENT_IDS } from "@/utils/clientIds";
import { useAgentNameResolver } from "@/hooks/useAgentNameResolver";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ArrowUpDown, ArrowUp, ArrowDown, Search, CalendarIcon, Undo2 } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { getPayrollPeriod } from "@/lib/calculations/dates";
import { toast } from "sonner";
import { extractOpp } from "./utils/extractOpp";

interface ApprovedTabProps {
  clientId: string;
}

type SortKey = "date" | "agent" | "opp" | "type" | "status" | "deduction" | "reviewed_at";
type SortDir = "asc" | "desc";

const ASE_CLIENT_ID = CLIENT_IDS["Ase"];

export function ApprovedTab({ clientId }: ApprovedTabProps) {
  const { resolve } = useAgentNameResolver();
  const isAse = clientId === ASE_CLIENT_ID;
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [sellerFilter, setSellerFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("reviewed_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["approved-queue", clientId],
    queryFn: async () => {
      let query = supabase
        .from("cancellation_queue")
        .select(`
          id, status, upload_type, reviewed_at, reviewed_by, created_at, opp_group, deduction_date, uploaded_data,
          sale:sales!cancellation_queue_sale_id_fkey(id, sale_datetime, agent_name, agent_email, raw_payload),
          reviewer:employee_master_data!cancellation_queue_reviewed_by_fkey(first_name, last_name)
        `)
        .in("status", ["approved", "rejected"]);

      if (clientId) {
        query = query.eq("client_id", clientId);
      }

      const { data, error } = await query.order("reviewed_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((item: any) => {
        const deductionSource = item.deduction_date
          ? new Date(item.deduction_date + "T00:00:00")
          : item.reviewed_at ? new Date(item.reviewed_at) : null;
        const period = item.status === "approved" && deductionSource
          ? getPayrollPeriod(deductionSource)
          : null;
        const ud = item.uploaded_data as Record<string, any> | null;
        const provRaw = ud?.["Provision"];
        const provValue = typeof provRaw === "object" && provRaw !== null ? provRaw.result : (typeof provRaw === "number" ? provRaw : null);
        return {
          id: item.id,
          status: item.status,
          uploadType: item.upload_type,
          reviewedAt: item.reviewed_at,
          deductionDate: item.deduction_date,
          deductionPeriod: period,
          oppGroup: item.opp_group,
          agentName: item.sale?.agent_name || item.sale?.agent_email || "",
          saleDate: item.sale?.sale_datetime || "",
          saleId: item.sale?.id || "",
          opp: extractOpp(item.sale?.raw_payload) || item.opp_group || "",
          reviewerName: item.reviewer
            ? `${item.reviewer.first_name || ""} ${item.reviewer.last_name || ""}`.trim()
            : "",
          product: ud?.["A-kasse"] || "",
          memberNumber: ud?.["Medlemsnummer"] != null ? String(ud["Medlemsnummer"]) : "",
          provision: typeof provValue === "number" ? provValue : null,
        };
      });
    },
    enabled: !!clientId,
  });

  // Check which approved basket_difference items have change log entries (for rollback)
  const approvedBasketIds = useMemo(
    () => items.filter(i => i.status === "approved" && i.uploadType === "basket_difference").map(i => i.id),
    [items]
  );

  const { data: changeLogMap = {} } = useQuery({
    queryKey: ["product-change-log", approvedBasketIds],
    queryFn: async () => {
      if (approvedBasketIds.length === 0) return {};
      const { data } = await supabase
        .from("product_change_log")
        .select("id, cancellation_queue_id, old_product_name, new_product_name, rolled_back_at")
        .in("cancellation_queue_id", approvedBasketIds as any)
        .is("rolled_back_at", null);
      const map: Record<string, { logId: string; oldName: string; newName: string }> = {};
      for (const entry of data || []) {
        const e = entry as any;
        if (e.cancellation_queue_id && !map[e.cancellation_queue_id]) {
          map[e.cancellation_queue_id] = {
            logId: e.id,
            oldName: e.old_product_name || "",
            newName: e.new_product_name || "",
          };
        }
      }
      return map;
    },
    enabled: approvedBasketIds.length > 0,
  });

  const rollbackMutation = useMutation({
    mutationFn: async (cancellationQueueId: string) => {
      // Get all change log entries for this queue item
      const { data: logs, error: logError } = await supabase
        .from("product_change_log")
        .select("*")
        .eq("cancellation_queue_id", cancellationQueueId as any)
        .is("rolled_back_at", null);
      if (logError) throw logError;
      if (!logs || logs.length === 0) throw new Error("Ingen rettelser fundet at rulle tilbage");

      const saleIds = new Set<string>();

      // Restore old product on each sale_item
      for (const log of logs) {
        const l = log as any;
        await supabase.from("sale_items").update({
          product_id: l.old_product_id,
          adversus_product_title: l.old_product_name,
        } as any).eq("id", l.sale_item_id);
        saleIds.add(l.sale_id);
      }

      // Trigger rematch to recalculate prices with original product
      if (saleIds.size > 0) {
        await supabase.functions.invoke("rematch-pricing-rules", {
          body: { sale_ids: Array.from(saleIds) },
        });
      }

      // Get current user for audit
      const { data: { user } } = await supabase.auth.getUser();
      let empId: string | null = null;
      if (user?.email) {
        const res = await (supabase as any).from("employee_master_data").select("id").eq("email", user.email).maybeSingle();
        empId = res.data?.id || null;
      }

      // Mark log entries as rolled back
      for (const log of logs) {
        await (supabase as any).from("product_change_log").update({
          rolled_back_at: new Date().toISOString(),
          rolled_back_by: empId,
        }).eq("id", (log as any).id);
      }
    },
    onSuccess: () => {
      toast.success("Produktrettelse er rullet tilbage");
      queryClient.invalidateQueries({ queryKey: ["approved-queue", clientId] });
      queryClient.invalidateQueries({ queryKey: ["product-change-log"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
    },
    onError: (err: Error) => toast.error("Kunne ikke rulle tilbage: " + err.message),
  });

  const updateDeductionDate = useMutation({
    mutationFn: async ({ id, date }: { id: string; date: string }) => {
      const { error } = await supabase
        .from("cancellation_queue")
        .update({ deduction_date: date } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approved-queue", clientId] });
      toast.success("Fradragsdato opdateret");
    },
    onError: () => toast.error("Kunne ikke opdatere fradragsdato"),
  });

  const sellers = useMemo(() => {
    const set = new Set(items.map((i) => i.agentName).filter(Boolean));
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    let result = [...items];
    if (sellerFilter !== "all") result = result.filter((i) => i.agentName === sellerFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (i) =>
          i.agentName.toLowerCase().includes(q) ||
          i.opp.toLowerCase().includes(q) ||
          i.reviewerName.toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "date": cmp = (a.saleDate || "").localeCompare(b.saleDate || ""); break;
        case "agent": cmp = a.agentName.localeCompare(b.agentName); break;
        case "opp": cmp = a.opp.localeCompare(b.opp); break;
        case "type": cmp = a.uploadType.localeCompare(b.uploadType); break;
        case "status": cmp = a.status.localeCompare(b.status); break;
        case "deduction": cmp = (a.deductionDate || a.reviewedAt || "").localeCompare(b.deductionDate || b.reviewedAt || ""); break;
        case "reviewed_at": cmp = (a.reviewedAt || "").localeCompare(b.reviewedAt || ""); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [items, sellerFilter, searchQuery, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="ml-1 h-3 w-3 inline" />;
    return sortDir === "asc" ? <ArrowUp className="ml-1 h-3 w-3 inline" /> : <ArrowDown className="ml-1 h-3 w-3 inline" />;
  };

  if (!clientId) return <p className="text-muted-foreground">Vælg en kunde for at se godkendte/afviste sager.</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between flex-wrap gap-4">
          <span>Godkendte / Afviste ({filtered.length})</span>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Søg..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-48"
              />
            </div>
            <Select value={sellerFilter} onValueChange={setSellerFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Alle sælgere" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle sælgere</SelectItem>
                {sellers.map((s) => (
                <SelectItem key={s} value={s}>{resolve(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Indlæser...</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground">Ingen godkendte/afviste sager fundet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("date")}>Dato <SortIcon col="date" /></TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("agent")}>Sælger <SortIcon col="agent" /></TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("opp")}>OPP <SortIcon col="opp" /></TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("type")}>Type <SortIcon col="type" /></TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("status")}>Status <SortIcon col="status" /></TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("deduction")}>Trækkes i <SortIcon col="deduction" /></TableHead>
                <TableHead>Behandlet af</TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("reviewed_at")}>Behandlet dato <SortIcon col="reviewed_at" /></TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => {
                const changeLog = changeLogMap[item.id];
                return (
                  <TableRow key={item.id}>
                    <TableCell>{item.saleDate ? format(new Date(item.saleDate), "dd-MM-yyyy") : "-"}</TableCell>
                    <TableCell>{resolve(item.agentName) || "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{item.opp || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {item.uploadType === "cancellation" ? "Annullering" : "Kurvrettelse"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.status === "approved" ? "default" : "destructive"}>
                        {item.status === "approved" ? "Godkendt" : "Afvist"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.status === "approved" && item.deductionPeriod ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="inline-flex items-center gap-1 text-sm hover:underline text-primary cursor-pointer bg-transparent border-none p-0">
                              <CalendarIcon className="h-3 w-3" />
                              {format(item.deductionPeriod.start, "d. MMM", { locale: da })} – {format(item.deductionPeriod.end, "d. MMM", { locale: da })}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={item.deductionDate ? new Date(item.deductionDate + "T00:00:00") : item.reviewedAt ? new Date(item.reviewedAt) : undefined}
                              onSelect={(date) => {
                                if (date) {
                                  updateDeductionDate.mutate({ id: item.id, date: format(date, "yyyy-MM-dd") });
                                }
                              }}
                              className="pointer-events-auto"
                              locale={da}
                            />
                          </PopoverContent>
                        </Popover>
                      ) : "-"}
                    </TableCell>
                    <TableCell>{item.reviewerName || "-"}</TableCell>
                    <TableCell>{item.reviewedAt ? format(new Date(item.reviewedAt), "dd-MM-yyyy HH:mm") : "-"}</TableCell>
                    <TableCell>
                      {changeLog && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Vil du rulle produktrettelsen tilbage?\n\n${changeLog.oldName} → ${changeLog.newName}\n\nDette gendanner det oprindelige produkt og genberegner priser.`)) {
                              rollbackMutation.mutate(item.id);
                            }
                          }}
                          disabled={rollbackMutation.isPending}
                          title={`Fortryd: ${changeLog.oldName} → ${changeLog.newName}`}
                        >
                          <Undo2 className="h-4 w-4 mr-1" />
                          Fortryd
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}