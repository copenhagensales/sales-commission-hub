import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/calculations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Users, RefreshCw, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { AddSalaryAdditionDialog } from "@/components/salary/AddSalaryAdditionDialog";
import { SalaryAdditionCell } from "@/components/salary/SalaryAdditionCell";
import { useSellerSalariesCached } from "@/hooks/useSellerSalariesCached";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";
import { PayrollPeriodSelector } from "@/components/employee/PayrollPeriodSelector";
import { getPayrollPeriod } from "@/lib/calculations";

type SortKey = "name" | "team" | "commission" | "cancellations" | "vacationPay" | "diet" | "sickDays" | "dailyBonus" | "startupBonus" | "referralBonus";
type SortDir = "asc" | "desc";

export function SellerSalariesTab() {
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("commission");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  
  const [periodStart, setPeriodStart] = useState<Date>(() => getPayrollPeriod().start);
  const [periodEnd, setPeriodEnd] = useState<Date>(() => getPayrollPeriod().end);

  const handlePeriodChange = useCallback((start: Date, end: Date) => {
    setPeriodStart(start);
    setPeriodEnd(end);
  }, []);

  const handleSort = useCallback((key: SortKey) => {
    setSortKey(prev => {
      if (prev === key) {
        setSortDir(d => d === "asc" ? "desc" : "asc");
        return key;
      }
      setSortDir(key === "name" || key === "team" ? "asc" : "desc");
      return key;
    });
  }, []);

  const { sellerData, isLoading, lastUpdated } = useSellerSalariesCached(selectedTeam, periodStart, periodEnd);

  const { data: teams } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["teams-filter"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("teams") as any)
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const filteredData = useMemo(() => {
    const filtered = sellerData?.filter(seller =>
      seller.name.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    return [...filtered].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      const dir = sortDir === "asc" ? 1 : -1;
      if (typeof valA === "string" && typeof valB === "string") {
        return valA.localeCompare(valB, "da") * dir;
      }
      return ((valA as number) - (valB as number)) * dir;
    });
  }, [sellerData, searchQuery, sortKey, sortDir]);

  const totalCommission = filteredData.reduce((sum, s) => sum + s.commission, 0);
  const totalCancellations = filteredData.reduce((sum, s) => sum + s.cancellations, 0);
  const totalVacationPay = filteredData.reduce((sum, s) => sum + s.vacationPay, 0);
  const totalDiet = filteredData.reduce((sum, s) => sum + s.diet, 0);
  const totalSickDays = filteredData.reduce((sum, s) => sum + s.sickDays, 0);
  const totalDailyBonus = filteredData.reduce((sum, s) => sum + s.dailyBonus, 0);
  const totalStartupBonus = filteredData.reduce((sum, s) => sum + s.startupBonus, 0);
  const totalReferralBonus = filteredData.reduce((sum, s) => sum + s.referralBonus, 0);

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const SortableHead = ({ col, children, className }: { col: SortKey; children: React.ReactNode; className?: string }) => (
    <TableHead
      className={`cursor-pointer select-none hover:text-foreground transition-colors ${className || ""}`}
      onClick={() => handleSort(col)}
    >
      <span className="inline-flex items-center">
        {children}
        <SortIcon col={col} />
      </span>
    </TableHead>
  );

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 pb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <CardTitle className="text-base sm:text-lg">Sælgerlønninger</CardTitle>
          <Badge variant="secondary" className="gap-1 text-xs">
            <Users className="h-3 w-3" />
            {filteredData.length}
          </Badge>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <PayrollPeriodSelector onChange={handlePeriodChange} />
          <AddSalaryAdditionDialog
            employees={sellerData?.map(s => ({ id: s.id, name: s.name })) || []}
            periodStart={periodStart}
            periodEnd={periodEnd}
          />
          {lastUpdated && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <RefreshCw className="h-3 w-3" />
              Opdateret {format(lastUpdated, "HH:mm", { locale: da })}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-4">
          <Select value={selectedTeam} onValueChange={setSelectedTeam}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Vælg team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle teams</SelectItem>
              {teams?.map(team => (
                <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Søg sælger..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="rounded-md border overflow-x-auto">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Indlæser...</div>
          ) : filteredData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Ingen sælgere fundet</div>
          ) : isMobile ? (
            <div className="divide-y">
              {filteredData.map((seller) => (
                <div key={seller.id} className="p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className={`font-medium text-sm ${!seller.isActive ? "text-muted-foreground" : ""}`}>
                      {seller.name}
                      {seller.isFreelanceConsultant && <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0">Konsulent</Badge>}
                      {!seller.isActive && <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">Inaktiv</Badge>}
                    </span>
                    <span className="text-xs text-muted-foreground">{seller.team}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Provision</span>
                    <span>{formatCurrency(seller.commission)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Annulleringer</span>
                    <span>{formatCurrency(seller.cancellations)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Feriepenge</span>
                    <span>{formatCurrency(seller.vacationPay)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Diet</span>
                    <span>{formatCurrency(seller.diet)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Sygdom</span>
                    <span>{seller.sickDays} dage</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Dagsbonus</span>
                    <span>{formatCurrency(seller.dailyBonus)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Opstartsbonus</span>
                    <span>{formatCurrency(seller.startupBonus)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Henvisning</span>
                    <span>{formatCurrency(seller.referralBonus)}</span>
                  </div>
                </div>
              ))}
              <div className="p-3 bg-muted/50 font-medium space-y-0.5">
                <div className="flex justify-between text-xs"><span>Total provision</span><span>{formatCurrency(totalCommission)}</span></div>
                <div className="flex justify-between text-xs"><span>Total annulleringer</span><span>{formatCurrency(totalCancellations)}</span></div>
                <div className="flex justify-between text-xs"><span>Total feriepenge</span><span>{formatCurrency(totalVacationPay)}</span></div>
                <div className="flex justify-between text-xs"><span>Total diet</span><span>{formatCurrency(totalDiet)}</span></div>
                <div className="flex justify-between text-xs"><span>Total sygdom</span><span>{totalSickDays} dage</span></div>
                <div className="flex justify-between text-xs"><span>Total dagsbonus</span><span>{formatCurrency(totalDailyBonus)}</span></div>
                <div className="flex justify-between text-xs"><span>Total opstartsbonus</span><span>{formatCurrency(totalStartupBonus)}</span></div>
                <div className="flex justify-between text-xs"><span>Total henvisning</span><span>{formatCurrency(totalReferralBonus)}</span></div>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead col="name">Navn</SortableHead>
                  <SortableHead col="team">Team</SortableHead>
                  <SortableHead col="commission" className="text-right">Provision</SortableHead>
                  <SortableHead col="cancellations" className="text-right">Annulleringer</SortableHead>
                  <SortableHead col="vacationPay" className="text-right">Feriepenge</SortableHead>
                  <SortableHead col="diet" className="text-right">Diet</SortableHead>
                  <SortableHead col="sickDays" className="text-right">Sygdom</SortableHead>
                  <SortableHead col="dailyBonus" className="text-right">Dagsbonus</SortableHead>
                  <SortableHead col="startupBonus" className="text-right">Opstartsbonus</SortableHead>
                  <SortableHead col="referralBonus" className="text-right">Henvisning</SortableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((seller) => (
                  <TableRow key={seller.id}>
                    <TableCell className={`font-medium ${!seller.isActive ? "text-muted-foreground" : ""}`}>
                      {seller.name}
                      {seller.isFreelanceConsultant && <Badge variant="secondary" className="ml-2 text-[10px] px-1 py-0">Konsulent</Badge>}
                      {!seller.isActive && <Badge variant="outline" className="ml-2 text-[10px] px-1 py-0">Inaktiv</Badge>}
                    </TableCell>
                    <TableCell>{seller.team}</TableCell>
                    <SalaryAdditionCell value={seller.commission} columnKey="commission" items={seller.salaryAdditions?.commission} />
                    <SalaryAdditionCell value={seller.cancellations} columnKey="cancellations" items={seller.salaryAdditions?.cancellations} />
                    <SalaryAdditionCell value={seller.vacationPay} columnKey="vacationPay" items={seller.salaryAdditions?.vacationPay} />
                    <SalaryAdditionCell value={seller.diet} columnKey="diet" items={seller.salaryAdditions?.diet} />
                    <SalaryAdditionCell value={seller.sickDays} columnKey="sickDays" items={seller.salaryAdditions?.sickDays} isCurrency={false} />
                    <SalaryAdditionCell value={seller.dailyBonus} columnKey="dailyBonus" items={seller.salaryAdditions?.dailyBonus} />
                    <SalaryAdditionCell value={seller.startupBonus} columnKey="startupBonus" items={seller.salaryAdditions?.startupBonus} />
                    <SalaryAdditionCell value={seller.referralBonus} columnKey="referralBonus" items={seller.salaryAdditions?.referralBonus} />
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-medium">
                  <TableCell>Total</TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-right">{formatCurrency(totalCommission)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalCancellations)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalVacationPay)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalDiet)}</TableCell>
                  <TableCell className="text-right">{totalSickDays}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalDailyBonus)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalReferralBonus)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}