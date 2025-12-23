import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calculator, TrendingDown, Users, DollarSign, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Normalize team names
const normalizeTeamName = (name: string | null): string => {
  if (!name) return "Ukendt";
  const lower = name.toLowerCase().trim();
  if (lower.includes("eesy fm") || lower === "eesy fm") return "Eesy FM";
  if (lower.includes("eesy tm") || lower === "eesy tm") return "Eesy TM";
  if (lower.includes("fieldmarketing")) return "Fieldmarketing";
  if (lower.includes("relatel")) return "Relatel";
  if (lower.includes("tdc erhverv")) return "TDC Erhverv";
  if (lower.includes("united")) return "United";
  if (lower.includes("stab")) return "Stab";
  return name;
};

const EXCLUDED_TEAMS = ["Stab", "Ukendt"];

export function ChurnCalculator() {
  const [targetChurnRate, setTargetChurnRate] = useState(34);
  const [recruitmentCostPerEmployee, setRecruitmentCostPerEmployee] = useState(20000);

  // Fetch current churn data
  const { data: churnData, isLoading } = useQuery({
    queryKey: ["churn-calculator-data"],
    queryFn: async () => {
      // Team memberships for filtering
      const { data: teamMemberships, error: tmError } = await supabase
        .from("team_members")
        .select("employee_id, team:teams(name)");
      if (tmError) throw tmError;

      // Current active employees
      const { data: currentEmployees, error: currError } = await supabase
        .from("employee_master_data")
        .select("id, employment_start_date")
        .eq("is_active", true);
      if (currError) throw currError;

      // Historical employees
      const { data: historicalData, error: histError } = await supabase
        .from("historical_employment")
        .select("id, team_name, tenure_days, start_date, end_date");
      if (histError) throw histError;

      // Map employee_id to team name
      const employeeTeamMap = new Map<string, string>();
      (teamMemberships || []).forEach((tm: { employee_id: string; team: { name: string } | null }) => {
        if (tm.team?.name && !employeeTeamMap.has(tm.employee_id)) {
          employeeTeamMap.set(tm.employee_id, tm.team.name);
        }
      });

      // Count current employees
      let currentCount = 0;
      (currentEmployees || []).forEach(emp => {
        const teamName = normalizeTeamName(employeeTeamMap.get(emp.id) || null);
        if (EXCLUDED_TEAMS.includes(teamName)) return;
        currentCount++;
      });

      // Count historical employees and 60-day exits
      let historicalCount = 0;
      let exits60Days = 0;
      let exits2025 = 0;

      (historicalData || []).forEach(emp => {
        const teamName = normalizeTeamName(emp.team_name);
        if (EXCLUDED_TEAMS.includes(teamName)) return;

        historicalCount++;
        if (emp.tenure_days <= 60) {
          exits60Days++;
          // Check if from 2025
          const startYear = emp.start_date ? new Date(emp.start_date).getFullYear() : null;
          if (startYear === 2025) {
            exits2025++;
          }
        }
      });

      const totalCount = currentCount + historicalCount;
      const churnRate = totalCount > 0 ? (exits60Days / totalCount) * 100 : 0;

      // Annual hire estimate based on historical data
      const annualHires = Math.round(historicalCount * 0.8); // Rough estimate

      return {
        currentChurnRate: Math.round(churnRate * 10) / 10,
        totalEmployees: totalCount,
        exits60Days,
        exits2025,
        currentEmployees: currentCount,
        historicalCount,
        annualHires
      };
    }
  });

  const calculations = useMemo(() => {
    if (!churnData) return null;

    const currentChurnRate = churnData.currentChurnRate;
    const totalEmployees = churnData.totalEmployees;
    const exits60Days = churnData.exits60Days;

    // Calculate how many would have stayed with lower churn
    const currentExits = exits60Days;
    const targetExits = Math.round((targetChurnRate / 100) * totalEmployees);
    const employeesRetained = Math.max(0, currentExits - targetExits);

    // Annual projections (rough estimate based on 2025 pace)
    const monthsInYear = 12;
    const currentMonth = new Date().getMonth() + 1;
    const annualizedExits = Math.round((churnData.exits2025 / currentMonth) * monthsInYear);
    const annualizedTargetExits = Math.round((targetChurnRate / currentChurnRate) * annualizedExits);
    const annualRetention = Math.max(0, annualizedExits - annualizedTargetExits);

    // Cost savings
    const totalSavings = employeesRetained * recruitmentCostPerEmployee;
    const annualSavings = annualRetention * recruitmentCostPerEmployee;

    // Additional metrics
    const churnReduction = currentChurnRate - targetChurnRate;
    const percentageImprovement = currentChurnRate > 0 ? (churnReduction / currentChurnRate) * 100 : 0;

    return {
      currentChurnRate,
      targetChurnRate,
      churnReduction,
      percentageImprovement,
      employeesRetained,
      annualRetention,
      totalSavings,
      annualSavings,
      currentExits,
      targetExits
    };
  }, [churnData, targetChurnRate, recruitmentCostPerEmployee]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('da-DK', {
      style: 'currency',
      currency: 'DKK',
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Churn-kalkulator
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-10 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Churn-kalkulator
        </CardTitle>
        <CardDescription>
          Se besparelser ved at reducere 60-dages churn fra {churnData?.currentChurnRate}% til din målsætning
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">
                Mål for churn-rate: {targetChurnRate}%
              </Label>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-xs text-muted-foreground">10%</span>
                <Slider
                  value={[targetChurnRate]}
                  onValueChange={(value) => setTargetChurnRate(value[0])}
                  min={10}
                  max={Math.min(50, churnData?.currentChurnRate || 45)}
                  step={1}
                  className="flex-1"
                />
                <span className="text-xs text-muted-foreground">{Math.min(50, churnData?.currentChurnRate || 45)}%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Nuværende: {churnData?.currentChurnRate}% → Mål: {targetChurnRate}%
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recruitment-cost" className="text-sm font-medium">
              Rekrutteringsomkostning pr. medarbejder (DKK)
            </Label>
            <Input
              id="recruitment-cost"
              type="number"
              value={recruitmentCostPerEmployee}
              onChange={(e) => setRecruitmentCostPerEmployee(Number(e.target.value))}
              min={0}
              step={1000}
            />
            <p className="text-xs text-muted-foreground">
              Inkl. annoncering, onboarding, tabt produktivitet
            </p>
          </div>
        </div>

        {/* Results */}
        {calculations && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
            <div className="bg-primary/5 rounded-lg p-4">
              <div className="flex items-center gap-2 text-primary mb-2">
                <TrendingDown className="h-4 w-4" />
                <span className="text-sm font-medium">Churn-reduktion</span>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {calculations.churnReduction.toFixed(1)} pp
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {calculations.percentageImprovement.toFixed(0)}% forbedring
              </p>
            </div>

            <div className="bg-green-500/10 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-600 mb-2">
                <Users className="h-4 w-4" />
                <span className="text-sm font-medium">Flere fastholdt</span>
              </div>
              <div className="text-2xl font-bold text-foreground">
                +{calculations.employeesRetained}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Medarbejdere historisk set
              </p>
            </div>

            <div className="bg-green-500/10 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-600 mb-2">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">Årlig fastholdelse</span>
              </div>
              <div className="text-2xl font-bold text-foreground">
                +{calculations.annualRetention}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Medarbejdere pr. år fremadrettet
              </p>
            </div>

            <div className="bg-yellow-500/10 rounded-lg p-4">
              <div className="flex items-center gap-2 text-yellow-600 mb-2">
                <DollarSign className="h-4 w-4" />
                <span className="text-sm font-medium">Årlig besparelse</span>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {formatCurrency(calculations.annualSavings)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                I rekrutteringsomkostninger
              </p>
            </div>
          </div>
        )}

        {/* Summary */}
        {calculations && (
          <div className="bg-muted/50 rounded-lg p-4 mt-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Ved at reducere churn fra</span>
              <Badge variant="outline">{calculations.currentChurnRate}%</Badge>
              <span className="text-sm text-muted-foreground">til</span>
              <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-200">{calculations.targetChurnRate}%</Badge>
              <span className="text-sm text-muted-foreground">ville I have fastholdt</span>
              <Badge className="bg-primary">{calculations.employeesRetained} medarbejdere</Badge>
              <span className="text-sm text-muted-foreground">historisk og spare</span>
              <Badge className="bg-green-600">{formatCurrency(calculations.annualSavings)}/år</Badge>
            </div>
          </div>
        )}

        {/* Benchmark info */}
        <div className="text-xs text-muted-foreground border-t pt-4">
          <strong>Benchmark:</strong> En sund 60-dages churn-rate ligger typisk mellem 15-25%. 
          Jeres nuværende rate på {churnData?.currentChurnRate}% indikerer potentiale for forbedring i onboarding og tidlig fastholdelse.
        </div>
      </CardContent>
    </Card>
  );
}
