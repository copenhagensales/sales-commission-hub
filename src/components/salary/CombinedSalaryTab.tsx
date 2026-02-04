import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/utils/supabasePagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, DollarSign, Users, Briefcase, UserCheck } from "lucide-react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { da } from "date-fns/locale";

interface SalaryEntry {
  id: string;
  name: string;
  type: "sælger" | "teamleder" | "assistent" | "stab";
  amount: number;
}

export function CombinedSalaryTab() {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const { data, isLoading } = useQuery({
    queryKey: ["combined-salaries", monthStart.toISOString(), monthEnd.toISOString()],
    queryFn: async () => {
      const entries: SalaryEntry[] = [];

      // 1. Get seller commissions (non-staff employees)
      const { data: employees } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name")
        .eq("is_active", true)
        .eq("is_staff_employee", false);

      const employeeIds = employees?.map(e => e.id) || [];

      const { data: agentMappings } = await supabase
        .from("employee_agent_mapping")
        .select("employee_id, agent_id, agents(email, external_dialer_id)")
        .in("employee_id", employeeIds);

      // Use paginated fetch to bypass 1000-row limit
      const saleItems = await fetchAllRows<{
        id: string;
        quantity: number;
        mapped_commission: number;
        sales: { sale_datetime: string; agent_email: string; agent_external_id: string };
      }>(
        "sale_items",
        "id, quantity, mapped_commission, sales!inner(sale_datetime, agent_email, agent_external_id)",
        (query) =>
          query
            .gte("sales.sale_datetime", monthStart.toISOString())
            .lte("sales.sale_datetime", monthEnd.toISOString()),
        { orderBy: "id", ascending: true }
      );

      employees?.forEach(emp => {
        const empAgents = agentMappings?.filter(am => am.employee_id === emp.id) || [];
        const agentEmails = empAgents.map(a => a.agents?.email?.toLowerCase()).filter(Boolean);
        const agentExtIds = empAgents.map(a => a.agents?.external_dialer_id).filter(Boolean);

        const empSales = saleItems?.filter(si => {
          const email = si.sales?.agent_email?.toLowerCase();
          const extId = si.sales?.agent_external_id;
          return agentEmails.includes(email) || agentExtIds.includes(extId);
        }) || [];

        const commission = empSales.reduce((sum, si) => sum + (Number(si.mapped_commission) || 0), 0);

        if (commission > 0) {
          entries.push({
            id: emp.id,
            name: `${emp.first_name} ${emp.last_name}`,
            type: "sælger",
            amount: commission,
          });
        }
      });

      // 2. Get personnel salaries (staff employees)
      const { data: personnelSalaries } = await supabase
        .from("personnel_salaries")
        .select(`
          id,
          employee_id,
          salary_type,
          monthly_salary,
          percentage_rate,
          minimum_salary,
          employee:employee_id(first_name, last_name)
        `)
        .eq("is_active", true);

      personnelSalaries?.forEach(ps => {
        const emp = ps.employee as { first_name: string; last_name: string } | null;
        if (!emp) return;

        let typeLabel: "teamleder" | "assistent" | "stab" = "stab";
        if (ps.salary_type === "team_leader") typeLabel = "teamleder";
        else if (ps.salary_type === "assistant") typeLabel = "assistent";

        // For team leaders, the salary would be calculated from DB
        // For now, use monthly_salary as placeholder
        const amount = Number(ps.monthly_salary) || 0;

        if (amount > 0) {
          entries.push({
            id: ps.id,
            name: `${emp.first_name} ${emp.last_name}`,
            type: typeLabel,
            amount,
          });
        }
      });

      return entries.sort((a, b) => b.amount - a.amount);
    },
  });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }).format(amount);

  const getTypeColor = (type: SalaryEntry["type"]) => {
    switch (type) {
      case "sælger": return "bg-blue-100 text-blue-800";
      case "teamleder": return "bg-purple-100 text-purple-800";
      case "assistent": return "bg-green-100 text-green-800";
      case "stab": return "bg-orange-100 text-orange-800";
    }
  };

  const getTypeLabel = (type: SalaryEntry["type"]) => {
    switch (type) {
      case "sælger": return "Sælger";
      case "teamleder": return "Teamleder";
      case "assistent": return "Assistent";
      case "stab": return "Stab";
    }
  };

  // Calculate totals by type
  const totals = data?.reduce(
    (acc, entry) => {
      acc[entry.type] = (acc[entry.type] || 0) + entry.amount;
      acc.total += entry.amount;
      return acc;
    },
    { sælger: 0, teamleder: 0, assistent: 0, stab: 0, total: 0 } as Record<string, number>
  ) || { sælger: 0, teamleder: 0, assistent: 0, stab: 0, total: 0 };

  const kpiCards = [
    { label: "Sælgerlønninger", value: totals.sælger, icon: Users, color: "text-blue-600" },
    { label: "Teamledere", value: totals.teamleder, icon: UserCheck, color: "text-purple-600" },
    { label: "Assistenter", value: totals.assistent, icon: Briefcase, color: "text-green-600" },
    { label: "Stab", value: totals.stab, icon: Briefcase, color: "text-orange-600" },
  ];

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                {kpi.label}
              </div>
              <p className="text-2xl font-bold">{formatCurrency(kpi.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Total Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <span className="font-medium">TOTAL LØNUDBETALING</span>
            </div>
            <span className="text-2xl font-bold text-primary">{formatCurrency(totals.total)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Detailed list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Samlet lønoversigt</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Period selector */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[120px] text-center font-medium capitalize">
              {format(currentMonth, "MMMM yyyy", { locale: da })}
            </span>
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Navn</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Beløb</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      Indlæser...
                    </TableCell>
                  </TableRow>
                ) : !data?.length ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      Ingen lønudbetalinger fundet
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {data.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">{entry.name}</TableCell>
                        <TableCell>
                          <Badge className={getTypeColor(entry.type)} variant="secondary">
                            {getTypeLabel(entry.type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(entry.amount)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-medium">
                      <TableCell colSpan={2}>Total</TableCell>
                      <TableCell className="text-right">{formatCurrency(totals.total)}</TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
