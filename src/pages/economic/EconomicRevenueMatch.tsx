import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Scale, Plus, Trash2, AlertTriangle, CheckCircle2, AlertCircle, Search, Eye, ArrowRight, Info } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const formatDKK = (value: number) =>
  new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

const formatPct = (value: number) =>
  new Intl.NumberFormat("da-DK", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value / 100);

const MONTHS = [
  { value: "01", label: "Jan" }, { value: "02", label: "Feb" }, { value: "03", label: "Mar" },
  { value: "04", label: "Apr" }, { value: "05", label: "Maj" }, { value: "06", label: "Jun" },
  { value: "07", label: "Jul" }, { value: "08", label: "Aug" }, { value: "09", label: "Sep" },
  { value: "10", label: "Okt" }, { value: "11", label: "Nov" }, { value: "12", label: "Dec" },
];

interface Postering {
  loebe_nr: number;
  tekst: string | null;
  beloeb_dkk: number;
  dato: string;
  faktura_nr: number | null;
  bilags_nr: number | null;
  antal: number | null;
  kunde_nr: number | null;
  leverandoer_nr: number | null;
  posterings_type: string | null;
  forfalds_dato: string | null;
  maaned: string;
}

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

// Hook: fetch detailed konto 1010 posteringer
function useRevenuePosteringer(year: number) {
  return useQuery({
    queryKey: ["revenue-posteringer-detail", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("economic_posteringer")
        .select("loebe_nr, tekst, beloeb_dkk, dato, faktura_nr, bilags_nr, antal, kunde_nr, leverandoer_nr, posterings_type, forfalds_dato")
        .eq("konto_nr", 1010)
        .gte("dato", `${year}-01-01`)
        .lte("dato", `${year}-12-31`)
        .order("dato", { ascending: false });
      if (error) throw error;
      // Faktura for fx januar sendes d. 1/2 – tilhører foregående måned
      return (data || []).map((r) => {
        const d = new Date(r.dato + "T00:00:00");
        // Undtagelse: faktura 940 tilhører sin egen måned (ikke -1)
        if (String(r.faktura_nr) !== "940") {
          d.setMonth(d.getMonth() - 1);
        }
        const adjustedMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        return { ...r, maaned: adjustedMonth };
      }) as Postering[];
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
      const { data: clients, error: clientsError } = await supabase
        .from("clients")
        .select("id, name");
      if (clientsError) throw clientsError;

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
            const month = row.group_key?.substring(0, 7);
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

function wordsMatch(text: string, pattern: string): boolean {
  const textLower = text.toLowerCase();
  const words = pattern.toLowerCase().split(/\s+/).filter(Boolean);
  return words.every(word => textLower.includes(word));
}

function matchPostering(p: Postering, mappings: any[]): { mapping: any; matchType: string } | null {
  if (!p.tekst) return null;
  for (const m of mappings) {
    if (wordsMatch(p.tekst, m.match_pattern)) {
      return { mapping: m, matchType: "words" };
    }
  }
  return null;
}

export default function EconomicRevenueMatch() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [searchText, setSearchText] = useState("");
  const [showUnmappedOnly, setShowUnmappedOnly] = useState(false);
  const [newPattern, setNewPattern] = useState("");
  const [newClientId, setNewClientId] = useState("");
  const [detailPostering, setDetailPostering] = useState<Postering | null>(null);
  const [activeTab, setActiveTab] = useState("posteringer");
  const queryClient = useQueryClient();

  const { data: mappings, isLoading: mappingsLoading } = useClientMappings();
  const { data: clients } = useClients();
  const { data: posteringer, isLoading: postLoading } = useRevenuePosteringer(year);
  const { data: systemRevenue, isLoading: sysLoading } = useSystemRevenue(year);

  // Mutations
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
      const { error } = await supabase.from("economic_client_mapping").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["economic-client-mapping"] });
      toast.success("Mapping slettet");
    },
  });

  const saveMappingMutation = useMutation({
    mutationFn: async ({ id, client_id }: { id: string; client_id: string }) => {
      const { error } = await supabase
        .from("economic_client_mapping")
        .update({ client_id })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["economic-client-mapping"] });
      toast.success("Mapping opdateret");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Available months from data
  const availableMonths = useMemo(() => {
    if (!posteringer) return [];
    const months = new Set(posteringer.map(p => p.maaned));
    return Array.from(months).sort();
  }, [posteringer]);

  // Filter posteringer
  const filteredPosteringer = useMemo(() => {
    if (!posteringer) return [];
    let filtered = posteringer;

    if (selectedMonths.length > 0) {
      filtered = filtered.filter(p => selectedMonths.includes(p.maaned));
    }
    if (searchText) {
      const lower = searchText.toLowerCase();
      filtered = filtered.filter(p =>
        (p.tekst && p.tekst.toLowerCase().includes(lower)) ||
        (p.faktura_nr && p.faktura_nr.toString().includes(lower)) ||
        (p.bilags_nr && p.bilags_nr.toString().includes(lower))
      );
    }
    if (showUnmappedOnly && mappings) {
      filtered = filtered.filter(p => !matchPostering(p, mappings));
    }
    return filtered;
  }, [posteringer, selectedMonths, searchText, showUnmappedOnly, mappings]);

  // Match preview for new pattern
  const matchPreview = useMemo(() => {
    if (!newPattern || !posteringer) return null;
    const matched = posteringer.filter(p => p.tekst && wordsMatch(p.tekst, newPattern));
    const months = new Set(matched.map(p => p.maaned));
    const totalAmount = matched.reduce((s, p) => s + (-p.beloeb_dkk), 0);
    const examples = [...new Set(matched.map(p => p.tekst).filter(Boolean))].slice(0, 5);
    return {
      count: matched.length,
      months: Array.from(months).sort(),
      totalAmount,
      examples,
    };
  }, [newPattern, posteringer]);

  // Related posteringer for detail view (same faktura_nr or bilags_nr)
  const relatedPosteringer = useMemo(() => {
    if (!detailPostering || !posteringer) return [];
    return posteringer.filter(p =>
      p.loebe_nr !== detailPostering.loebe_nr && (
        (detailPostering.faktura_nr && p.faktura_nr === detailPostering.faktura_nr) ||
        (detailPostering.bilags_nr && p.bilags_nr === detailPostering.bilags_nr)
      )
    );
  }, [detailPostering, posteringer]);

  // Deviation data
  const deviationData = useMemo(() => {
    if (!posteringer || !systemRevenue || !mappings) return [];
    const clientMap = new Map((clients || []).map(c => [c.id, c.name]));
    const invoicedByClientMonth: Record<string, Record<string, number>> = {};
    const invoicesByClientMonth: Record<string, Record<string, Set<string>>> = {};

    posteringer.forEach(p => {
      if (!p.tekst) return;
      const month = p.maaned;
      const match = matchPostering(p, mappings);
      if (!match || !match.mapping.client_id) return;
      const cid = match.mapping.client_id;
      if (!invoicedByClientMonth[cid]) invoicedByClientMonth[cid] = {};
      invoicedByClientMonth[cid][month] = (invoicedByClientMonth[cid][month] || 0) + (-p.beloeb_dkk);
      if (!invoicesByClientMonth[cid]) invoicesByClientMonth[cid] = {};
      if (!invoicesByClientMonth[cid][month]) invoicesByClientMonth[cid][month] = new Set();
      if (p.faktura_nr) invoicesByClientMonth[cid][month].add(String(p.faktura_nr));
    });

    const allClientIds = new Set<string>([
      ...Object.keys(invoicedByClientMonth),
      ...Object.keys(systemRevenue.byClientMonth),
    ]);

    const rows: Array<{
      clientId: string; clientName: string; month: string;
      invoiced: number; system: number; deviation: number; deviationPct: number;
      invoiceNrs: string[];
    }> = [];

    allClientIds.forEach(cid => {
      const allMonths = new Set<string>([
        ...Object.keys(invoicedByClientMonth[cid] || {}),
        ...Object.keys(systemRevenue.byClientMonth[cid] || {}),
      ]);
      allMonths.forEach(month => {
        if (selectedMonths.length > 0 && !selectedMonths.includes(month)) return;
        const invoiced = invoicedByClientMonth[cid]?.[month] || 0;
        const system = systemRevenue.byClientMonth[cid]?.[month] || 0;
        if (invoiced === 0 && system === 0) return;
        const deviation = invoiced - system;
        const deviationPct = system > 0 ? ((invoiced - system) / system) * 100 : invoiced > 0 ? 100 : 0;
        const invoiceNrs = Array.from(invoicesByClientMonth[cid]?.[month] || []).sort();
        rows.push({ clientId: cid, clientName: clientMap.get(cid) || "Ukendt", month, invoiced, system, deviation, deviationPct, invoiceNrs });
      });
    });

    return rows.sort((a, b) => a.month.localeCompare(b.month) || a.clientName.localeCompare(b.clientName));
  }, [posteringer, systemRevenue, mappings, clients, selectedMonths]);

  const totals = useMemo(() => {
    const totalInvoiced = deviationData.reduce((s, r) => s + r.invoiced, 0);
    const totalSystem = deviationData.reduce((s, r) => s + r.system, 0);
    return {
      invoiced: totalInvoiced, system: totalSystem,
      deviation: totalInvoiced - totalSystem,
      deviationPct: totalSystem > 0 ? ((totalInvoiced - totalSystem) / totalSystem) * 100 : 0,
    };
  }, [deviationData]);

  const getDeviationColor = (pct: number) => {
    const absPct = Math.abs(pct);
    if (absPct < 5) return "text-emerald-600 dark:text-emerald-400";
    if (absPct < 15) return "text-amber-600 dark:text-amber-400";
    return "text-destructive";
  };

  const getDeviationIcon = (pct: number) => {
    const absPct = Math.abs(pct);
    if (absPct < 5) return <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
    if (absPct < 15) return <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
    return <AlertTriangle className="h-4 w-4 text-destructive" />;
  };

  const toggleMonth = (month: string) => {
    setSelectedMonths(prev =>
      prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month]
    );
  };

  const isLoading = mappingsLoading || postLoading || sysLoading;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
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
              {[2024, 2025, 2026].map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Month filter */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm font-medium text-muted-foreground mr-2">Måneder:</span>
          {availableMonths.length > 0 ? availableMonths.map(m => {
            const monthNum = m.substring(5, 7);
            const label = MONTHS.find(mm => mm.value === monthNum)?.label || monthNum;
            const isActive = selectedMonths.includes(m);
            return (
              <Badge
                key={m}
                variant={isActive ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleMonth(m)}
              >
                {label} {m.substring(0, 4)}
              </Badge>
            );
          }) : (
            <span className="text-sm text-muted-foreground">Indlæser...</span>
          )}
          {selectedMonths.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedMonths([])}>
              Nulstil
            </Button>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="posteringer">Posteringer & Mapping</TabsTrigger>
            <TabsTrigger value="afvigelse">Afvigelsesrapport</TabsTrigger>
          </TabsList>

          {/* Tab 1: Posteringer + Mapping */}
          <TabsContent value="posteringer" className="space-y-6">
            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  placeholder="Søg i tekst, fakturanr, bilagsnr..."
                  className="pl-9"
                />
              </div>
              <Badge
                variant={showUnmappedOnly ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setShowUnmappedOnly(!showUnmappedOnly)}
              >
                Kun umappede
              </Badge>
              <span className="text-sm text-muted-foreground">
                {filteredPosteringer.length} posteringer
              </span>
            </div>

            {/* Posteringer table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dato</TableHead>
                        <TableHead>Tekst</TableHead>
                        <TableHead>Fakturanr.</TableHead>
                        <TableHead>Bilagsnr.</TableHead>
                        <TableHead className="text-right">Antal</TableHead>
                        <TableHead className="text-right">Beløb</TableHead>
                        <TableHead>Mappet til</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {postLoading ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Indlæser...</TableCell>
                        </TableRow>
                      ) : filteredPosteringer.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Ingen posteringer fundet</TableCell>
                        </TableRow>
                      ) : filteredPosteringer.slice(0, 200).map(p => {
                        const match = mappings ? matchPostering(p, mappings) : null;
                        return (
                          <TableRow
                            key={p.loebe_nr}
                            className={cn(
                              "cursor-pointer hover:bg-muted/50",
                              !match && "bg-amber-50/50 dark:bg-amber-950/20"
                            )}
                            onClick={() => setDetailPostering(p)}
                          >
                            <TableCell className="font-mono text-xs whitespace-nowrap">{p.dato}</TableCell>
                            <TableCell className="max-w-[300px] truncate text-sm" title={p.tekst || ""}>
                              {p.tekst || <span className="text-muted-foreground italic">Ingen tekst</span>}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{p.faktura_nr || "–"}</TableCell>
                            <TableCell className="font-mono text-xs">{p.bilags_nr || "–"}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{p.antal ?? "–"}</TableCell>
                            <TableCell className="text-right font-mono text-sm whitespace-nowrap">
                              {formatDKK(p.beloeb_dkk)}
                            </TableCell>
                            <TableCell>
                              {match ? (
                                <Badge variant="secondary" className="text-xs">
                                  {(match.mapping as any).clients?.name || "Ukendt"}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700">
                                  Umappet
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {filteredPosteringer.length > 200 && (
                    <p className="text-center text-sm text-muted-foreground py-3">
                      Viser 200 af {filteredPosteringer.length} posteringer. Brug filtre til at indsnævre.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Mapping Editor */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Kundemapping</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Kobl fakturatekst til interne kunder. Mønstret matches som "contains" mod posteringstekst.
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
                        <TableHead className="text-right">Hits</TableHead>
                        <TableHead className="w-20" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mappings.map((m: any) => {
                        const hitCount = posteringer
                          ? posteringer.filter(p => p.tekst && wordsMatch(p.tekst, m.match_pattern)).length
                          : 0;
                        return (
                          <TableRow key={m.id}>
                            <TableCell className="font-mono text-sm">{m.match_pattern}</TableCell>
                            <TableCell>
                              <Select
                                value={m.client_id || ""}
                                onValueChange={(cid) => saveMappingMutation.mutate({ id: m.id, client_id: cid })}
                              >
                                <SelectTrigger className="w-56">
                                  <SelectValue placeholder="Vælg kunde..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {(clients || []).map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">{hitCount}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => deleteMappingMutation.mutate(m.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}

                {/* Add new mapping with preview */}
                <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                  <p className="text-sm font-medium">Tilføj ny mapping</p>
                  <div className="flex gap-2 items-end flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <label className="text-xs font-medium mb-1 block text-muted-foreground">Tekstmønster</label>
                      <Input
                        value={newPattern}
                        onChange={e => setNewPattern(e.target.value)}
                        placeholder="f.eks. EESY: Pop-up Coop"
                      />
                    </div>
                    <div className="w-56">
                      <label className="text-xs font-medium mb-1 block text-muted-foreground">Kunde</label>
                      <Select value={newClientId} onValueChange={setNewClientId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Vælg kunde..." />
                        </SelectTrigger>
                        <SelectContent>
                          {(clients || []).map(c => (
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

                  {/* Match preview */}
                  {matchPreview && newPattern.length >= 2 && (
                    <div className="bg-background border rounded-md p-3 space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Info className="h-4 w-4 text-primary" />
                        Match-preview
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Posteringer:</span>{" "}
                          <span className="font-medium">{matchPreview.count}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Beløb:</span>{" "}
                          <span className="font-medium">{formatDKK(matchPreview.totalAmount)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Måneder:</span>{" "}
                          <span className="font-medium">{matchPreview.months.join(", ") || "–"}</span>
                        </div>
                      </div>
                      {matchPreview.examples.length > 0 && (
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <span className="font-medium">Eksempler:</span>
                          {matchPreview.examples.map((ex, i) => (
                            <div key={i} className="font-mono truncate">{ex}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Deviation Report */}
          <TabsContent value="afvigelse" className="space-y-4">
            {/* Unmapped summary */}
            {!isLoading && posteringer && mappings && (() => {
              const filtered = selectedMonths.length > 0
                ? posteringer.filter(p => selectedMonths.includes(p.maaned))
                : posteringer;
              const unmapped = filtered.filter(p => !matchPostering(p, mappings));
              const unmappedTotal = unmapped.reduce((s, p) => s + (-p.beloeb_dkk), 0);
              const uniqueTexts = [...new Set(unmapped.map(p => p.tekst).filter(Boolean))].sort();
              if (unmapped.length === 0) return null;
              return (
                <Card className="border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="h-5 w-5" />
                      {unmapped.length} umappede posteringer ({formatDKK(unmappedTotal)})
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {unmapped.length} af {filtered.length} posteringer er ikke koblet til en kunde
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {uniqueTexts.slice(0, 30).map((txt, i) => (
                        <Badge key={i} variant="outline" className="text-xs font-mono">
                          {txt}
                        </Badge>
                      ))}
                      {uniqueTexts.length > 30 && (
                        <Badge variant="outline" className="text-xs">+{uniqueTexts.length - 30} mere</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Afvigelsesrapport</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Faktureret (konto 1010) vs. System (registreret omsætning) per kunde per måned
                </p>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-muted-foreground text-center py-8">Indlæser data...</p>
                ) : deviationData.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Ingen data. Tilføj kundemappings for at se afvigelser.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Måned</TableHead>
                          <TableHead>Kunde</TableHead>
                          <TableHead>Fakturanr.</TableHead>
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
                            <TableCell className="text-sm text-muted-foreground">{row.invoiceNrs.join(", ") || "–"}</TableCell>
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
                        <TableRow className="font-bold border-t-2">
                          <TableCell colSpan={3}>Total</TableCell>
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
          </TabsContent>
        </Tabs>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!detailPostering} onOpenChange={(open) => !open && setDetailPostering(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Posteringsdetaljer</DialogTitle>
            <DialogDescription>Fuld information om denne postering</DialogDescription>
          </DialogHeader>
          {detailPostering && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground block text-xs">Tekst</span>
                  <span className="font-medium">{detailPostering.tekst || "–"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Beløb</span>
                  <span className="font-medium">{formatDKK(detailPostering.beloeb_dkk)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Dato</span>
                  <span className="font-mono">{detailPostering.dato}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Forfaldsdato</span>
                  <span className="font-mono">{detailPostering.forfalds_dato || "–"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Fakturanr.</span>
                  <span className="font-mono">{detailPostering.faktura_nr || "–"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Bilagsnr.</span>
                  <span className="font-mono">{detailPostering.bilags_nr || "–"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Kundenr.</span>
                  <span className="font-mono">{detailPostering.kunde_nr || "–"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Leverandørnr.</span>
                  <span className="font-mono">{detailPostering.leverandoer_nr || "–"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Antal</span>
                  <span className="font-mono">{detailPostering.antal ?? "–"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Posteringstype</span>
                  <span className="font-mono">{detailPostering.posterings_type || "–"}</span>
                </div>
              </div>

              {/* Map directly from detail */}
              {detailPostering.tekst && (
                <div className="border-t pt-3 space-y-2">
                  <p className="text-sm font-medium flex items-center gap-1">
                    <ArrowRight className="h-4 w-4" /> Hurtig-mapping
                  </p>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Input
                        value={newPattern || detailPostering.tekst.split(":")[0]?.trim() || detailPostering.tekst}
                        onChange={e => setNewPattern(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <Select value={newClientId} onValueChange={setNewClientId}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Vælg kunde..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(clients || []).map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={() => {
                        const pattern = newPattern || detailPostering.tekst?.split(":")[0]?.trim() || "";
                        if (pattern && newClientId) {
                          addMappingMutation.mutate({ match_pattern: pattern, client_id: newClientId });
                          setDetailPostering(null);
                        }
                      }}
                      disabled={!newClientId}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Related posteringer */}
              {relatedPosteringer.length > 0 && (
                <div className="border-t pt-3 space-y-2">
                  <p className="text-sm font-medium">Relaterede posteringer (samme faktura/bilag)</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {relatedPosteringer.map(rp => (
                      <div key={rp.loebe_nr} className="text-xs flex justify-between bg-muted/50 rounded px-2 py-1">
                        <span className="truncate flex-1">{rp.tekst || "–"}</span>
                        <span className="font-mono ml-2">{formatDKK(rp.beloeb_dkk)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
