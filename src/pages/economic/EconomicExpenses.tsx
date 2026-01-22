import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronRight, Plus, Filter } from "lucide-react";
import { usePosteringerEnriched, useEconomicKategorier, useTeams, useCreateFordelingsregel, PosteringEnriched } from "@/hooks/useEconomicData";
import { BaselineFilter } from "@/components/economic/BaselineFilter";
import { toast } from "sonner";

const formatDKK = (value: number) => {
  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency: "DKK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

type PeriodFilter = "ytd" | "3m" | "custom";

export default function EconomicExpenses() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("ytd");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [kategoriFilter, setKategoriFilter] = useState<string>("all");
  const [expandedKategori, setExpandedKategori] = useState<string | null>(null);
  const [selectedPostering, setSelectedPostering] = useState<PosteringEnriched | null>(null);
  
  const { data: posteringer, isLoading } = usePosteringerEnriched({ year });
  const { data: kategorier } = useEconomicKategorier();
  const { data: teams } = useTeams();
  const createRegel = useCreateFordelingsregel();
  
  // Filter posteringer
  const filteredPosteringer = useMemo(() => {
    if (!posteringer) return [];
    
    let filtered = posteringer.filter(p => p.beloeb_dkk < 0); // Only expenses
    
    if (teamFilter !== "all") {
      filtered = filtered.filter(p => p.team_id === teamFilter);
    }
    
    if (kategoriFilter !== "all") {
      filtered = filtered.filter(p => p.kategori_id === kategoriFilter);
    }
    
    if (periodFilter === "3m") {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      filtered = filtered.filter(p => new Date(p.dato) >= threeMonthsAgo);
    }
    
    return filtered;
  }, [posteringer, teamFilter, kategoriFilter, periodFilter]);
  
  // Group by kategori and month
  const kategoriData = useMemo(() => {
    const grouped: Record<string, {
      kategori: string;
      kategori_id: string;
      byMonth: Record<string, number>;
      total: number;
      posteringer: PosteringEnriched[];
    }> = {};
    
    filteredPosteringer.forEach(p => {
      if (!grouped[p.kategori]) {
        grouped[p.kategori] = {
          kategori: p.kategori,
          kategori_id: p.kategori_id,
          byMonth: {},
          total: 0,
          posteringer: [],
        };
      }
      
      const amount = Math.abs(p.beloeb_dkk);
      grouped[p.kategori].total += amount;
      grouped[p.kategori].byMonth[p.maaned] = (grouped[p.kategori].byMonth[p.maaned] || 0) + amount;
      grouped[p.kategori].posteringer.push(p);
    });
    
    return Object.values(grouped).sort((a, b) => b.total - a.total);
  }, [filteredPosteringer]);
  
  // Get unique months for table headers
  const months = useMemo(() => {
    const monthSet = new Set<string>();
    filteredPosteringer.forEach(p => monthSet.add(p.maaned));
    return Array.from(monthSet).sort();
  }, [filteredPosteringer]);
  
  // Get top texts for drilldown
  const getTopTexts = (posteringer: PosteringEnriched[]) => {
    const textTotals: Record<string, { tekst: string; total: number; count: number }> = {};
    posteringer.forEach(p => {
      const tekst = p.tekst || "Ingen tekst";
      if (!textTotals[tekst]) {
        textTotals[tekst] = { tekst, total: 0, count: 0 };
      }
      textTotals[tekst].total += Math.abs(p.beloeb_dkk);
      textTotals[tekst].count += 1;
    });
    return Object.values(textTotals).sort((a, b) => b.total - a.total).slice(0, 10);
  };
  
  // Handle create rule from postering
  const handleCreateRule = async (postering: PosteringEnriched, targetKategoriId: string, targetTeamId?: string) => {
    if (!postering.tekst) {
      toast.error("Kan ikke oprette regel uden tekst");
      return;
    }
    
    // Extract a meaningful match value from the text
    const words = postering.tekst.split(/\s+/);
    const matchValue = words[0]?.toLowerCase() || postering.tekst.toLowerCase();
    
    try {
      await createRegel.mutateAsync({
        priority: 50,
        match_field: "tekst",
        match_operator: "contains",
        match_value: matchValue,
        kategori_id: targetKategoriId,
        team_id: targetTeamId || null,
        active_from: "2000-01-01",
        active_to: "2099-12-31",
        note: `Oprettet fra postering: ${postering.tekst}`,
        is_active: true,
      });
      toast.success("Regel oprettet!");
      setSelectedPostering(null);
    } catch (error) {
      toast.error("Kunne ikke oprette regel");
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Udgifter</h1>
          <p className="text-muted-foreground">Forstå hvor pengene går hen</p>
        </div>
      </div>
      
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filtre:</span>
            </div>
            
            <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as PeriodFilter)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ytd">År til dato</SelectItem>
                <SelectItem value="3m">Sidste 3 måneder</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026].map((y) => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Alle teams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle teams</SelectItem>
                {teams?.map((team) => (
                  <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={kategoriFilter} onValueChange={setKategoriFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Alle kategorier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle kategorier</SelectItem>
                {kategorier?.filter(k => k.is_expense).map((kat) => (
                  <SelectItem key={kat.id} value={kat.id}>{kat.navn}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      
      {/* Baseline */}
      <BaselineFilter />
      
      {/* Expenses Table */}
      <Card>
        <CardHeader>
          <CardTitle>Udgifter pr. kategori</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Kategori</TableHead>
                  {months.map(m => (
                    <TableHead key={m} className="text-right">{m}</TableHead>
                  ))}
                  <TableHead className="text-right font-bold">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kategoriData.map((row) => (
                  <>
                    <TableRow 
                      key={row.kategori_id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setExpandedKategori(expandedKategori === row.kategori_id ? null : row.kategori_id)}
                    >
                      <TableCell>
                        {expandedKategori === row.kategori_id ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{row.kategori}</TableCell>
                      {months.map(m => (
                        <TableCell key={m} className="text-right">
                          {row.byMonth[m] ? formatDKK(row.byMonth[m]) : "-"}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-bold">{formatDKK(row.total)}</TableCell>
                    </TableRow>
                    
                    {/* Drilldown */}
                    {expandedKategori === row.kategori_id && (
                      <TableRow>
                        <TableCell colSpan={months.length + 3}>
                          <div className="p-4 bg-muted/30 rounded-lg space-y-4">
                            <h4 className="font-medium">Top posteringstekster</h4>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Tekst</TableHead>
                                  <TableHead className="text-right">Antal</TableHead>
                                  <TableHead className="text-right">Beløb</TableHead>
                                  <TableHead className="w-32"></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {getTopTexts(row.posteringer).map((item, i) => (
                                  <TableRow key={i}>
                                    <TableCell className="font-mono text-sm">{item.tekst}</TableCell>
                                    <TableCell className="text-right">{item.count}</TableCell>
                                    <TableCell className="text-right">{formatDKK(item.total)}</TableCell>
                                    <TableCell>
                                      <Dialog>
                                        <DialogTrigger asChild>
                                          <Button 
                                            variant="outline" 
                                            size="sm"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedPostering(row.posteringer.find(p => p.tekst === item.tekst) || null);
                                            }}
                                          >
                                            <Plus className="h-3 w-3 mr-1" />
                                            Regel
                                          </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                          <DialogHeader>
                                            <DialogTitle>Opret fordelingsregel</DialogTitle>
                                          </DialogHeader>
                                          <CreateRuleDialog
                                            tekst={item.tekst}
                                            kategorier={kategorier || []}
                                            teams={teams || []}
                                            onSubmit={(kategoriId, teamId) => {
                                              const postering = row.posteringer.find(p => p.tekst === item.tekst);
                                              if (postering) {
                                                handleCreateRule(postering, kategoriId, teamId);
                                              }
                                            }}
                                          />
                                        </DialogContent>
                                      </Dialog>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Sub-component for rule creation dialog
function CreateRuleDialog({ 
  tekst, 
  kategorier, 
  teams,
  onSubmit 
}: { 
  tekst: string;
  kategorier: { id: string; navn: string }[];
  teams: { id: string; name: string }[];
  onSubmit: (kategoriId: string, teamId?: string) => void;
}) {
  const [matchValue, setMatchValue] = useState(tekst.split(/\s+/)[0]?.toLowerCase() || tekst.toLowerCase());
  const [selectedKategori, setSelectedKategori] = useState<string>("");
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  
  return (
    <div className="space-y-4">
      <div>
        <Label>Tekst matcher</Label>
        <p className="text-sm text-muted-foreground mb-2">
          Posteringer hvor teksten indeholder:
        </p>
        <Input
          value={matchValue}
          onChange={(e) => setMatchValue(e.target.value)}
          placeholder="Søgeord..."
        />
      </div>
      
      <div>
        <Label>Tildel kategori</Label>
        <Select value={selectedKategori} onValueChange={setSelectedKategori}>
          <SelectTrigger>
            <SelectValue placeholder="Vælg kategori..." />
          </SelectTrigger>
          <SelectContent>
            {kategorier.map((kat) => (
              <SelectItem key={kat.id} value={kat.id}>{kat.navn}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label>Tildel team (valgfrit)</Label>
        <Select value={selectedTeam} onValueChange={setSelectedTeam}>
          <SelectTrigger>
            <SelectValue placeholder="Vælg team..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Ingen specifik</SelectItem>
            {teams.map((team) => (
              <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <Button 
        className="w-full" 
        onClick={() => onSubmit(selectedKategori, selectedTeam === "none" ? undefined : selectedTeam)}
        disabled={!selectedKategori}
      >
        Opret regel
      </Button>
    </div>
  );
}
