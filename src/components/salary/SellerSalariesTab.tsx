import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Search, Users } from "lucide-react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { da } from "date-fns/locale";

export function SellerSalariesTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const { data: teams } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["teams-filter"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("teams") as any)
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch seller salaries (non-staff employees)
  const { data: sellerData, isLoading } = useQuery({
    queryKey: ["seller-salaries", monthStart.toISOString(), monthEnd.toISOString(), selectedTeam],
    queryFn: async () => {
      // Get non-staff employees
      const { data: employees, error: empError } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, team_id")
        .eq("is_active", true)
        .eq("is_staff_employee", false);
      if (empError) throw empError;

      // Get team names separately
      const teamIds = [...new Set(employees?.map(e => e.team_id).filter(Boolean) as string[])];
      const { data: teamsData } = await supabase
        .from("teams")
        .select("id, name")
        .in("id", teamIds);

      // Filter by selected team if needed
      let filteredEmployees = employees || [];
      if (selectedTeam !== "all") {
        filteredEmployees = filteredEmployees.filter(e => e.team_id === selectedTeam);
      }

      // Get sales data for these employees via agent mapping
      const employeeIds = employees?.map(e => e.id) || [];
      
      const { data: agentMappings } = await supabase
        .from("employee_agent_mapping")
        .select("employee_id, agent_id, agents(id, email, external_dialer_id)")
        .in("employee_id", employeeIds);

      // Get sale items for the period
      const { data: saleItems } = await supabase
        .from("sale_items")
        .select(`
          id,
          quantity,
          mapped_commission,
          sales!inner(
            id,
            sale_datetime,
            agent_email,
            agent_external_id
          )
        `)
        .gte("sales.sale_datetime", monthStart.toISOString())
        .lte("sales.sale_datetime", monthEnd.toISOString());

      // Calculate per employee
      const employeeStats = filteredEmployees.map(emp => {
        const empAgents = agentMappings?.filter(am => am.employee_id === emp.id) || [];
        const agentEmails = empAgents.map(a => (a.agents as { email?: string } | null)?.email?.toLowerCase()).filter(Boolean);
        const agentExternalIds = empAgents.map(a => (a.agents as { external_dialer_id?: string } | null)?.external_dialer_id).filter(Boolean);

        const empSales = saleItems?.filter(si => {
          const sale = si.sales as { agent_email?: string; agent_external_id?: string } | null;
          const saleEmail = sale?.agent_email?.toLowerCase();
          const saleExtId = sale?.agent_external_id;
          return agentEmails.includes(saleEmail) || agentExternalIds.includes(saleExtId);
        }) || [];

        const totalSales = empSales.reduce((sum, si) => sum + (si.quantity || 1), 0);
        const totalCommission = empSales.reduce((sum, si) => sum + (Number(si.mapped_commission) || 0), 0);

        const teamData = teamsData?.find(t => t.id === emp.team_id);

        return {
          id: emp.id,
          name: `${emp.first_name} ${emp.last_name}`,
          team: teamData?.name || "Ikke tildelt",
          teamId: emp.team_id,
          sales: totalSales,
          commission: totalCommission,
        };
      });

      return employeeStats.sort((a, b) => b.commission - a.commission);
    },
  });

  const filteredData = sellerData?.filter(seller =>
    seller.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const totalSales = filteredData.reduce((sum, s) => sum + s.sales, 0);
  const totalCommission = filteredData.reduce((sum, s) => sum + s.commission, 0);

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }).format(amount);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-3">
          <CardTitle>Sælgerlønninger</CardTitle>
          <Badge variant="secondary" className="gap-1">
            <Users className="h-3 w-3" />
            {filteredData.length} sælgere
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Period selector and filters */}
        <div className="flex flex-wrap items-center gap-4">
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

          <Select value={selectedTeam} onValueChange={setSelectedTeam}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Vælg team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle teams</SelectItem>
              {teams?.map(team => (
                <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Søg sælger..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Navn</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="text-right">Salg</TableHead>
                <TableHead className="text-right">Provision</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Indlæser...
                  </TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Ingen sælgere fundet
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {filteredData.map((seller) => (
                    <TableRow key={seller.id}>
                      <TableCell className="font-medium">{seller.name}</TableCell>
                      <TableCell>{seller.team}</TableCell>
                      <TableCell className="text-right">{seller.sales}</TableCell>
                      <TableCell className="text-right">{formatCurrency(seller.commission)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-medium">
                    <TableCell>Total</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right">{totalSales}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totalCommission)}</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
