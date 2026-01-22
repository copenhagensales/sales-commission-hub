import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Percent, TrendingUp, Calculator } from "lucide-react";
import { useEconomicBudget, useEconomicKategorier, useTeams, useUpdateBudgetLine, usePosteringerEnriched } from "@/hooks/useEconomicData";
import { toast } from "sonner";

const formatDKK = (value: number) => {
  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency: "DKK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];

export default function EconomicBudget() {
  const [budgetYear, setBudgetYear] = useState(2026);
  const [compareYear, setCompareYear] = useState(2025);
  const [viewMode, setViewMode] = useState<"month" | "year">("month");
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  
  const { data: budget, isLoading: budgetLoading } = useEconomicBudget(budgetYear);
  const { data: kategorier } = useEconomicKategorier();
  const { data: teams } = useTeams();
  const { data: faktisk } = usePosteringerEnriched({ year: compareYear });
  const updateBudget = useUpdateBudgetLine();
  
  // Calculate actual data by kategori and month
  const faktiskByKategori = useMemo(() => {
    if (!faktisk) return {};
    
    const result: Record<string, Record<number, number>> = {};
    faktisk.filter(p => p.beloeb_dkk < 0).forEach(p => {
      if (!result[p.kategori_id]) {
        result[p.kategori_id] = {};
      }
      const month = parseInt(p.maaned.split("-")[1]);
      result[p.kategori_id][month] = (result[p.kategori_id][month] || 0) + Math.abs(p.beloeb_dkk);
    });
    return result;
  }, [faktisk]);
  
  // Build budget grid data
  const gridData = useMemo(() => {
    if (!kategorier) return [];
    
    return kategorier.filter(k => k.is_expense).map(kat => {
      const row: { kategori: string; kategori_id: string; months: number[]; total: number } = {
        kategori: kat.navn,
        kategori_id: kat.id,
        months: Array(12).fill(0),
        total: 0,
      };
      
      // Fill from budget
      budget?.filter(b => b.kategori_id === kat.id && (selectedTeam === "all" || b.team_id === selectedTeam))
        .forEach(b => {
          row.months[b.month - 1] += b.amount;
          row.total += b.amount;
        });
      
      return row;
    });
  }, [kategorier, budget, selectedTeam]);
  
  // Copy from actual (YTD/12)
  const copyFromActualYearly = async () => {
    if (!kategorier || !faktiskByKategori) return;
    
    const monthlyBudgets: { year: number; month: number; kategori_id: string; amount: number; team_id: string | null }[] = [];
    
    kategorier.filter(k => k.is_expense).forEach(kat => {
      const yearTotal = Object.values(faktiskByKategori[kat.id] || {}).reduce((sum, v) => sum + v, 0);
      const monthlyAmount = yearTotal / 12;
      
      for (let m = 1; m <= 12; m++) {
        monthlyBudgets.push({
          year: budgetYear,
          month: m,
          kategori_id: kat.id,
          amount: Math.round(monthlyAmount),
          team_id: selectedTeam === "all" ? null : selectedTeam,
        });
      }
    });
    
    try {
      for (const line of monthlyBudgets) {
        await updateBudget.mutateAsync(line);
      }
      toast.success(`Kopieret budget fra ${compareYear} (årligt gennemsnit)`);
    } catch (error) {
      toast.error("Fejl ved kopiering af budget");
    }
  };
  
  // Copy from last 3 months average
  const copyFrom3MonthsAverage = async () => {
    if (!kategorier || !faktiskByKategori) return;
    
    const recentMonths = [10, 11, 12]; // Oct, Nov, Dec of compare year
    const monthlyBudgets: { year: number; month: number; kategori_id: string; amount: number; team_id: string | null }[] = [];
    
    kategorier.filter(k => k.is_expense).forEach(kat => {
      const threeMonthTotal = recentMonths.reduce((sum, m) => sum + (faktiskByKategori[kat.id]?.[m] || 0), 0);
      const monthlyAmount = threeMonthTotal / 3;
      
      for (let m = 1; m <= 12; m++) {
        monthlyBudgets.push({
          year: budgetYear,
          month: m,
          kategori_id: kat.id,
          amount: Math.round(monthlyAmount),
          team_id: selectedTeam === "all" ? null : selectedTeam,
        });
      }
    });
    
    try {
      for (const line of monthlyBudgets) {
        await updateBudget.mutateAsync(line);
      }
      toast.success("Kopieret budget fra sidste 3 måneders gennemsnit");
    } catch (error) {
      toast.error("Fejl ved kopiering af budget");
    }
  };
  
  // Calculate variance
  const varianceData = useMemo(() => {
    if (!gridData || !faktiskByKategori) return [];
    
    return gridData.map(row => {
      const faktiskTotal = Object.values(faktiskByKategori[row.kategori_id] || {}).reduce((sum, v) => sum + v, 0);
      const variance = row.total - faktiskTotal;
      const variancePct = faktiskTotal > 0 ? ((row.total - faktiskTotal) / faktiskTotal) * 100 : 0;
      
      return {
        ...row,
        faktisk: faktiskTotal,
        variance,
        variancePct,
      };
    }).sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
  }, [gridData, faktiskByKategori]);
  
  if (budgetLoading) {
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
          <h1 className="text-3xl font-bold">Budget {budgetYear}</h1>
          <p className="text-muted-foreground">Planlæg årets udgifter</p>
        </div>
        
        <div className="flex gap-2">
          <Select value={budgetYear.toString()} onValueChange={(v) => setBudgetYear(parseInt(v))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
              <SelectItem value="2027">2027</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Hurtige handlinger</CardTitle>
          <CardDescription>Kopier eller juster budget baseret på historiske data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button variant="outline" onClick={copyFromActualYearly}>
              <Copy className="h-4 w-4 mr-2" />
              Kopiér fra {compareYear} (årligt gns.)
            </Button>
            
            <Button variant="outline" onClick={copyFrom3MonthsAverage}>
              <Calculator className="h-4 w-4 mr-2" />
              Kopiér fra sidste 3 mdr. gns.
            </Button>
            
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
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
          </div>
        </CardContent>
      </Card>
      
      {/* Tabs */}
      <Tabs defaultValue="grid" className="space-y-4">
        <TabsList>
          <TabsTrigger value="grid">Budget Grid</TabsTrigger>
          <TabsTrigger value="variance">Afvigelser</TabsTrigger>
        </TabsList>
        
        <TabsContent value="grid">
          <Card>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background">Kategori</TableHead>
                      {MONTHS.map((m, i) => (
                        <TableHead key={i} className="text-right min-w-20">{m}</TableHead>
                      ))}
                      <TableHead className="text-right font-bold">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gridData.map((row) => (
                      <TableRow key={row.kategori_id}>
                        <TableCell className="sticky left-0 bg-background font-medium">
                          {row.kategori}
                        </TableCell>
                        {row.months.map((amount, i) => (
                          <TableCell key={i} className="text-right">
                            <Input
                              type="number"
                              value={amount || ""}
                              onChange={(e) => {
                                const newAmount = parseFloat(e.target.value) || 0;
                                updateBudget.mutate({
                                  year: budgetYear,
                                  month: i + 1,
                                  kategori_id: row.kategori_id,
                                  amount: newAmount,
                                  team_id: selectedTeam === "all" ? null : selectedTeam,
                                  note: null,
                                });
                              }}
                              className="w-24 text-right"
                            />
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-bold">
                          {formatDKK(row.total)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="variance">
          <Card>
            <CardHeader>
              <CardTitle>Budget vs Faktisk ({compareYear})</CardTitle>
              <CardDescription>Top 10 afvigelser</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kategori</TableHead>
                    <TableHead className="text-right">Budget {budgetYear}</TableHead>
                    <TableHead className="text-right">Faktisk {compareYear}</TableHead>
                    <TableHead className="text-right">Afvigelse</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {varianceData.slice(0, 10).map((row) => (
                    <TableRow key={row.kategori_id}>
                      <TableCell className="font-medium">{row.kategori}</TableCell>
                      <TableCell className="text-right">{formatDKK(row.total)}</TableCell>
                      <TableCell className="text-right">{formatDKK(row.faktisk)}</TableCell>
                      <TableCell className={`text-right ${row.variance > 0 ? "text-red-600" : "text-green-600"}`}>
                        {formatDKK(row.variance)}
                      </TableCell>
                      <TableCell className={`text-right ${row.variancePct > 0 ? "text-red-600" : "text-green-600"}`}>
                        {row.variancePct > 0 ? "+" : ""}{row.variancePct.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
