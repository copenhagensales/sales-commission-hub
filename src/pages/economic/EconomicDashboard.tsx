import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, DollarSign, Target, Wallet, HelpCircle } from "lucide-react";
import { useEconomicSummary, useEconomicKategorier, useBaselineExclusions, usePosteringerEnriched } from "@/hooks/useEconomicData";
import { EconomicResultChart } from "@/components/economic/EconomicResultChart";
import { EconomicCategoryChart } from "@/components/economic/EconomicCategoryChart";
import { EconomicTopLists } from "@/components/economic/EconomicTopLists";
import { BaselineFilter } from "@/components/economic/BaselineFilter";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MainLayout } from "@/components/layout/MainLayout";

const formatDKK = (value: number) => {
  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency: "DKK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export default function EconomicDashboard() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  
  const { data: summary, isLoading } = useEconomicSummary(year);
  const { data: kategorier } = useEconomicKategorier();
  const { data: exclusions = [] } = useBaselineExclusions();
  const { data: posteringer } = usePosteringerEnriched({ year });
  
  // Calculate baseline (excluding selected categories)
  const baseline = useMemo(() => {
    if (!posteringer || !kategorier) return null;
    
    const excludedKategorier = new Set(exclusions);
    const filteredPosteringer = posteringer.filter(
      p => !excludedKategorier.has(p.kategori_id) && p.beloeb_dkk < 0 && !p.is_balance_account
    );
    
    const total = filteredPosteringer.reduce((sum, p) => sum + Math.abs(p.beloeb_dkk), 0);
    const months = new Set(filteredPosteringer.map(p => p.maaned)).size || 1;
    
    return {
      total,
      perMonth: total / months,
      months,
    };
  }, [posteringer, exclusions, kategorier]);
  
  // Burn rate (average net per month)
  const burnRate = useMemo(() => {
    if (!summary?.byMonth) return 0;
    const months = Object.values(summary.byMonth);
    if (months.length === 0) return 0;
    const totalNet = months.reduce((sum, m) => sum + m.resultat, 0);
    return totalNet / months.length;
  }, [summary]);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  return (
    <MainLayout>
      <TooltipProvider>
        <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Økonomi Dashboard</h1>
            <p className="text-muted-foreground">Overblik over virksomhedens økonomi</p>
          </div>
          <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026].map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Omsætning YTD</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatDKK(summary?.omsaetning || 0)}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Udgifter YTD</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatDKK(summary?.udgifter || 0)}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resultat YTD</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${(summary?.resultat || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatDKK(summary?.resultat || 0)}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1">
                Baseline / md
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Gennemsnitlige månedlige udgifter, ekskl. valgte kategorier (fx løn, transport). Brug filteret for at tilpasse.</p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <Target className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {formatDKK(baseline?.perMonth || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {baseline?.months} måneder
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1">
                Gns. netto / md
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Gennemsnitligt månedligt resultat (omsætning minus alle udgifter).</p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <Wallet className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${burnRate >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatDKK(burnRate)}
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Baseline Filter */}
        <BaselineFilter />
        
        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Resultat pr. måned</CardTitle>
            </CardHeader>
            <CardContent>
              <EconomicResultChart data={summary?.byMonth} />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Udgifter pr. kategori</CardTitle>
            </CardHeader>
            <CardContent>
              <EconomicCategoryChart data={summary?.byKategori} />
            </CardContent>
          </Card>
        </div>
        
        {/* Top Lists */}
          <EconomicTopLists 
            byKategori={summary?.byKategori} 
            posteringer={posteringer}
          />
        </div>
      </TooltipProvider>
    </MainLayout>
  );
}
