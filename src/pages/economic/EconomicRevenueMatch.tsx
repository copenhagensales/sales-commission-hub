import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Scale, Save, Plus, Trash2, AlertTriangle, CheckCircle2, AlertCircle } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const formatDKK = (value: number) =>
  new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

const formatPct = (value: number) =>
  new Intl.NumberFormat("da-DK", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value / 100);

// Hook: fetch client mappings
function useClientMappings() {
  return useQuery({
    queryKey: ["economic-client-mapping"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("economic_client_mapping")
        .select("*, clients(id, name)")
        .order("match_pattern");
      if (error) throw error;
      return data;
    },
  });
}

// Hook: fetch clients
function useClients() {
  return useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

// Hook: fetch konto 1010 posteringer for revenue
function useRevenuePosteringer(year: number) {
  return useQuery({
    queryKey: ["revenue-posteringer", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("economic_posteringer")
        .select("tekst, beloeb_dkk, dato")
        .eq("konto_nr", 1010)
        .gte("dato", `${year}-01-01`)
        .lte("dato", `${year}-12-31`)
        .order("dato");
      if (error) throw error;
      // Derive month from dato
      return (data || []).map((r) => ({
        ...r,
        maaned: r.dato ? r.dato.substring(0, 7) : "",
      }));
    },
  });
}

// Hook: fetch system revenue via get_sales_aggregates_v2
function useSystemRevenue(year: number) {
  return useQuery({
    queryKey: ["system-revenue-by-client", year],
    queryFn: async () => {
      const startDate = `${year}-01-01T00:00:00+01:00`;
      const endDate = `${year}-12-31T23:59:59+01:00`;
      
      // Get all clients first
      const { data: clients, error: clientsError } = await supabase
        .from("clients")
        .select("id, name");
      if (clientsError) throw clientsError;

      // For each client, get monthly revenue
      const results: Record<string, Record<string, number>> = {};
      
      for (const client of clients || []) {
        const { data, error } = await supabase.rpc("get_sales_aggregates_v2", {
          p_start: startDate,
          p_end: endDate,
          p_client_id: client.id,
          p_group_by: "date",
        });
        if (error) throw error;
        
        if (data && data.length > 0) {
          results[client.id] = {};
          for (const row of data) {
            // group_key is date string like "2025-01-15"
            const month = row.group_key?.substring(0, 7); // "2025-01"
            if (month) {
              results[client.id][month] = (results[client.id][month] || 0) + Number(row.total_revenue || 0);
            }
          }
        }
      }
      
      return { byClientMonth: results, clients };
    },
  });
}

// Extract unique text prefixes from posteringer
function extractPrefixes(posteringer: Array<{ tekst: string | null }>): string[] {
  const prefixes = new Set<string>();
  posteringer.forEach((p) => {
    if (p.tekst) {
      // Pattern: "KUNDENAVN: beskrivelse" -> extract "KUNDENAVN"
      const colonIdx = p.tekst.indexOf(":");
      if (colonIdx > 0) {
        prefixes.add(p.tekst.substring(0, colonIdx).trim());
      } else {
        // Use first 20 chars as fallback
        prefixes.add(p.tekst.substring(0, 20).trim());
      }
    }
  });
  return Array.from(prefixes).sort();
}

export default function EconomicRevenueMatch() {
  const [year, setYear] = useState(2025);
  const [newPattern, setNewPattern] = useState("");
  const [newClientId, setNewClientId] = useState("");
  const queryClient = useQueryClient();

  const { data: mappings, isLoading: mappingsLoading } = useClientMappings();
  const { data: clients } = useClients();
  const { data: posteringer, isLoading: postLoading } = useRevenuePosteringer(year);
  const { data: systemRevenue, isLoading: sysLoading } = useSystemRevenue(year);

  // Save mapping mutation
  const saveMappingMutation = useMutation({
    mutationFn: async ({ match_pattern, client_id }: { match_pattern: string; client_id: string }) => {
      const { error } = await supabase
        .from("economic_client_mapping")
        .upsert({ match_pattern, client_id }, { onConflict: "id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["economic-client-mapping"] });
      toast.success("Mapping gemt");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addMappingMutation = useMutation({
    mutationFn: async ({ match_pattern, client_id }: { match_pattern: string; client_id: string }) => {
      const { error } = await supabase
        .from("economic_client_mapping")
        .insert({ match_pattern, client_id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["economic-client-mapping"] });
      setNewPattern("");
      setNewClientId("");
      toast.success("Mapping tilføjet");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMappingMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("economic_client_mapping")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["economic-client-mapping"] });
      toast.success("Mapping slettet");
    },
  });

  // Extract unmapped prefixes
  const allPrefixes = useMemo(() => {
    if (!posteringer) return [];
    return extractPrefixes(posteringer);
  }, [posteringer]);

  const mappedPatterns = useMemo(() => {
    return new Set((mappings || []).map((m) => m.match_pattern.toLowerCase()));
  }, [mappings]);

  const unmappedPrefixes = useMemo(() => {
    return allPrefixes.filter((p) => !mappedPatterns.has(p.toLowerCase()));
  }, [allPrefixes, mappedPatterns]);

  // Build deviation table
  const deviationData = useMemo(() => {
    if (!posteringer || !systemRevenue || !mappings) return [];

    const clientMap = new Map((clients || []).map((c) => [c.id, c.name]));

    // Aggregate faktureret per client per month using mappings
    const invoicedByClientMonth: Record<string, Record<string, number>> = {};

    posteringer.forEach((p) => {
      if (!p.tekst) return;
      const month = p.maaned; // "2025-01" format
      
      // Find matching mapping
      const mapping = mappings.find((m) =>
        p.tekst!.toLowerCase().includes(m.match_pattern.toLowerCase())
      );
      if (!mapping || !mapping.client_id) return;

      const cid = mapping.client_id;
      if (!invoicedByClientMonth[cid]) invoicedByClientMonth[cid] = {};
      invoicedByClientMonth[cid][month] = (invoicedByClientMonth[cid][month] || 0) + Math.abs(p.beloeb_dkk);
    });

    // Collect all client-months
    const allClientIds = new Set<string>([
      ...Object.keys(invoicedByClientMonth),
      ...Object.keys(systemRevenue.byClientMonth),
    ]);

    const rows: Array<{
      clientId: string;
      clientName: string;
      month: string;
      invoiced: number;
      system: number;
      deviation: number;
      deviationPct: number;
    }> = [];

    allClientIds.forEach((cid) => {
      const allMonths = new Set<string>([
        ...Object.keys(invoicedByClientMonth[cid] || {}),
        ...Object.keys(systemRevenue.byClientMonth[cid] || {}),
      ]);

      allMonths.forEach((month) => {
        const invoiced = invoicedByClientMonth[cid]?.[month] || 0;
        const system = systemRevenue.byClientMonth[cid]?.[month] || 0;
        if (invoiced === 0 && system === 0) return;
        
        const deviation = invoiced - system;
        const deviationPct = system > 0 ? ((invoiced - system) / system) * 100 : invoiced > 0 ? 100 : 0;

        rows.push({
          clientId: cid,
          clientName: clientMap.get(cid) || "Ukendt",
          month,
          invoiced,
          system,
          deviation,
          deviationPct,
        });
      });
    });

    return rows.sort((a, b) => a.month.localeCompare(b.month) || a.clientName.localeCompare(b.clientName));
  }, [posteringer, systemRevenue, mappings, clients]);

  // Totals
  const totals = useMemo(() => {
    const totalInvoiced = deviationData.reduce((s, r) => s + r.invoiced, 0);
    const totalSystem = deviationData.reduce((s, r) => s + r.system, 0);
    return {
      invoiced: totalInvoiced,
      system: totalSystem,
      deviation: totalInvoiced - totalSystem,
      deviationPct: totalSystem > 0 ? ((totalInvoiced - totalSystem) / totalSystem) * 100 : 0,
    };
  }, [deviationData]);

  const getDeviationColor = (pct: number) => {
    const absPct = Math.abs(pct);
    if (absPct < 5) return "text-green-600";
    if (absPct < 15) return "text-yellow-600";
    return "text-red-600";
  };

  const getDeviationIcon = (pct: number) => {
    const absPct = Math.abs(pct);
    if (absPct < 5) return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (absPct < 15) return <AlertCircle className="h-4 w-4 text-yellow-600" />;
    return <AlertTriangle className="h-4 w-4 text-red-600" />;
  };

  const isLoading = mappingsLoading || postLoading || sysLoading;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Scale className="h-8 w-8" />
              Faktura vs. System
            </h1>
            <p className="text-muted-foreground">Sammenlign faktureret omsætning med systemets registrerede omsætning</p>
          </div>
          <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026].map((y) => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Mapping Editor */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Kundemapping</CardTitle>
            <p className="text-sm text-muted-foreground">
              Kobl e-conomic fakturatekst til interne kunder. Mønstret matches mod posteringstekst (contains).
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Existing mappings */}
            {mappings && mappings.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tekstmønster</TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappings.map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono text-sm">{m.match_pattern}</TableCell>
                      <TableCell>
                        <Select
                          value={m.client_id || ""}
                          onValueChange={(cid) =>
                            saveMappingMutation.mutate({ match_pattern: m.match_pattern, client_id: cid })
                          }
                        >
                          <SelectTrigger className="w-56">
                            <SelectValue placeholder="Vælg kunde..." />
                          </SelectTrigger>
                          <SelectContent>
                            {(clients || []).map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMappingMutation.mutate(m.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {/* Add new mapping */}
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium mb-1 block">Tekstmønster</label>
                <Input
                  value={newPattern}
                  onChange={(e) => setNewPattern(e.target.value)}
                  placeholder="f.eks. TDC ERHVERV"
                />
              </div>
              <div className="w-56">
                <label className="text-sm font-medium mb-1 block">Kunde</label>
                <Select value={newClientId} onValueChange={setNewClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vælg kunde..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(clients || []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => {
                  if (newPattern && newClientId) {
                    addMappingMutation.mutate({ match_pattern: newPattern, client_id: newClientId });
                  }
                }}
                disabled={!newPattern || !newClientId}
              >
                <Plus className="h-4 w-4 mr-1" />
                Tilføj
              </Button>
            </div>

            {/* Unmapped prefixes suggestion */}
            {unmappedPrefixes.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium mb-2 text-muted-foreground">Umappede tekstpræfikser fundet:</p>
                <div className="flex flex-wrap gap-2">
                  {unmappedPrefixes.map((p) => (
                    <Badge
                      key={p}
                      variant="outline"
                      className="cursor-pointer hover:bg-accent"
                      onClick={() => setNewPattern(p)}
                    >
                      {p}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Deviation Report */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Afvigelsesrapport</CardTitle>
            <p className="text-sm text-muted-foreground">
              Faktureret (e-conomic konto 1010) vs. System (registreret omsætning) per kunde per måned
            </p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-center py-8">Indlæser data...</p>
            ) : deviationData.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Ingen data. Tilføj kundemappings ovenfor for at se afvigelser.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Måned</TableHead>
                      <TableHead>Kunde</TableHead>
                      <TableHead className="text-right">Faktureret</TableHead>
                      <TableHead className="text-right">System</TableHead>
                      <TableHead className="text-right">Afvigelse</TableHead>
                      <TableHead className="text-right">%</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deviationData.map((row, i) => (
                      <TableRow key={`${row.clientId}-${row.month}-${i}`}>
                        <TableCell className="font-mono text-sm">{row.month}</TableCell>
                        <TableCell className="font-medium">{row.clientName}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatDKK(row.invoiced)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatDKK(row.system)}</TableCell>
                        <TableCell className={cn("text-right tabular-nums font-medium", getDeviationColor(row.deviationPct))}>
                          {row.deviation > 0 ? "+" : ""}{formatDKK(row.deviation)}
                        </TableCell>
                        <TableCell className={cn("text-right tabular-nums", getDeviationColor(row.deviationPct))}>
                          {formatPct(row.deviationPct)}
                        </TableCell>
                        <TableCell>{getDeviationIcon(row.deviationPct)}</TableCell>
                      </TableRow>
                    ))}
                    {/* Total row */}
                    <TableRow className="font-bold border-t-2">
                      <TableCell colSpan={2}>Total</TableCell>
                      <TableCell className="text-right tabular-nums">{formatDKK(totals.invoiced)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatDKK(totals.system)}</TableCell>
                      <TableCell className={cn("text-right tabular-nums", getDeviationColor(totals.deviationPct))}>
                        {totals.deviation > 0 ? "+" : ""}{formatDKK(totals.deviation)}
                      </TableCell>
                      <TableCell className={cn("text-right tabular-nums", getDeviationColor(totals.deviationPct))}>
                        {formatPct(totals.deviationPct)}
                      </TableCell>
                      <TableCell />
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
