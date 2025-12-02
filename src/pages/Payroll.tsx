import { MainLayout } from "@/components/layout/MainLayout";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Download, Plus, Eye, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subMonths, setDate } from "date-fns";
import { da } from "date-fns/locale";

interface PayrollRunWithDetails {
  id: string;
  period_start: string;
  period_end: string;
  status: "draft" | "approved" | "exported";
  created_at: string;
  payroll_lines: { total_payout: number | null }[];
}

// Helper to calculate the current payroll period (15th to 14th)
const getCurrentPayrollPeriod = () => {
  const now = new Date();
  const currentDay = now.getDate();
  
  let periodStart: Date;
  let periodEnd: Date;
  
  if (currentDay >= 15) {
    // We're in the period that started on the 15th of this month
    periodStart = setDate(now, 15);
    periodEnd = setDate(new Date(now.getFullYear(), now.getMonth() + 1, 14), 14);
  } else {
    // We're in the period that started on the 15th of last month
    periodStart = setDate(subMonths(now, 1), 15);
    periodEnd = setDate(now, 14);
  }
  
  return { periodStart, periodEnd };
};

export default function Payroll() {
  const { data: payrollRuns, isLoading } = useQuery({
    queryKey: ['payroll-runs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_runs')
        .select(`
          id,
          period_start,
          period_end,
          status,
          created_at,
          payroll_lines(total_payout)
        `)
        .order('period_start', { ascending: false });
      
      if (error) throw error;
      return data as unknown as PayrollRunWithDetails[];
    }
  });

  const { data: activeAgentCount } = useQuery({
    queryKey: ['active-agents-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('agents')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);
      
      if (error) throw error;
      return count || 0;
    }
  });

  const currentPeriod = getCurrentPayrollPeriod();
  
  // Calculate totals for the current/latest draft period
  const latestDraft = payrollRuns?.find(r => r.status === 'draft');
  const latestDraftTotal = latestDraft?.payroll_lines?.reduce(
    (sum, line) => sum + (line.total_payout || 0), 
    0
  ) || 0;

  // Previous period total for comparison
  const previousApproved = payrollRuns?.find(r => r.status === 'approved' || r.status === 'exported');
  const previousTotal = previousApproved?.payroll_lines?.reduce(
    (sum, line) => sum + (line.total_payout || 0),
    0
  ) || 0;

  const percentageChange = previousTotal > 0 
    ? ((latestDraftTotal - previousTotal) / previousTotal * 100).toFixed(0)
    : 0;

  const formatPeriodDisplay = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${format(startDate, 'd. MMM', { locale: da })} - ${format(endDate, 'd. MMM yyyy', { locale: da })}`;
  };

  const formatCurrentPeriodMonth = () => {
    const { periodStart, periodEnd } = currentPeriod;
    // Show the month where the period ends (main month)
    return format(periodEnd, 'MMMM yyyy', { locale: da });
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Lønkørsler</h1>
            <p className="mt-1 text-muted-foreground">
              Administrer lønberegninger og eksporter data
            </p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Ny lønkørsel
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">Aktuel periode</p>
            <p className="mt-1 text-2xl font-bold text-foreground capitalize">
              {formatCurrentPeriodMonth()}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {format(currentPeriod.periodStart, 'd. MMM', { locale: da })} - {format(currentPeriod.periodEnd, 'd. MMM', { locale: da })}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">Total lønsum (kladde)</p>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {latestDraftTotal.toLocaleString("da-DK")} kr
            </p>
            {previousTotal > 0 && (
              <p className={`mt-2 text-sm ${Number(percentageChange) >= 0 ? 'text-success' : 'text-danger'}`}>
                {Number(percentageChange) >= 0 ? '+' : ''}{percentageChange}% vs. forrige periode
              </p>
            )}
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">Antal medarbejdere</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{activeAgentCount || 0}</p>
            <p className="mt-2 text-sm text-muted-foreground">Aktive agenter</p>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !payrollRuns || payrollRuns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <p>Ingen lønkørsler fundet</p>
              <p className="text-sm">Opret en ny lønkørsel for at komme i gang</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Periode</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground">Agenter</TableHead>
                  <TableHead className="text-muted-foreground">Total lønsum</TableHead>
                  <TableHead className="text-muted-foreground text-right">Handlinger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrollRuns.map((run) => {
                  const totalPayout = run.payroll_lines?.reduce(
                    (sum, line) => sum + (line.total_payout || 0),
                    0
                  ) || 0;
                  const agentCount = run.payroll_lines?.length || 0;

                  return (
                    <TableRow 
                      key={run.id} 
                      className="border-border hover:bg-muted/50"
                    >
                      <TableCell className="text-foreground font-medium">
                        {formatPeriodDisplay(run.period_start, run.period_end)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={run.status} />
                      </TableCell>
                      <TableCell className="text-foreground">
                        {agentCount}
                      </TableCell>
                      <TableCell className="text-foreground font-semibold">
                        {totalPayout.toLocaleString("da-DK")} kr
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" className="gap-1">
                            <Eye className="h-4 w-4" />
                            Vis
                          </Button>
                          {run.status === "approved" && (
                            <Button variant="outline" size="sm" className="gap-1">
                              <Download className="h-4 w-4" />
                              CSV
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
