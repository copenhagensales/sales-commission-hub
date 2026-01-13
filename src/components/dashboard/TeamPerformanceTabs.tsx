import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ClientSalesData {
  clientName: string;
  sales: { day: number; week: number; month: number };
}

interface TeamData {
  id: string;
  name: string;
  employeeCount: number;
  sales: { day: number; week: number; month: number };
  clients?: ClientSalesData[];
  sick: { day: number; week: number; month: number };
  vacation: { day: number; week: number; month: number };
  workDays?: { day: number; week: number; month: number; totalWeek?: number; totalMonth?: number };
}

interface TeamPerformanceTabsProps {
  data: TeamData[];
}

type Period = "day" | "week" | "month";

export function TeamPerformanceTabs({ data }: TeamPerformanceTabsProps) {
  const [period, setPeriod] = useState<Period>("day");

  if (!data || data.length === 0) return null;

  const periodLabels = {
    day: "I dag",
    week: "Denne uge",
    month: "Denne måned",
  };

  const getSalesValue = (team: TeamData) => team.sales[period];
  const getSickValue = (team: TeamData) => team.sick[period];
  const getVacationValue = (team: TeamData) => team.vacation[period];
  const getWorkDays = (team: TeamData) => team.workDays?.[period] || 1;
  const getTotalWeekWorkDays = () => data[0]?.workDays?.totalWeek || 5;
  const getTotalMonthWorkDays = () => data[0]?.workDays?.totalMonth || 1;
  const getTotalPeriodWorkDays = () => period === "month" ? getTotalMonthWorkDays() : getTotalWeekWorkDays();

  // Calculate forecast (for week and month view)
  const getForecast = (salesSoFar: number, workDaysSoFar: number): number | null => {
    if (period === "day") return null;
    if (workDaysSoFar === 0) return 0;
    const totalWorkDays = getTotalPeriodWorkDays();
    return Math.round((salesSoFar / workDaysSoFar) * totalWorkDays);
  };

  const showForecast = period !== "day";

  // Get client sales for a team
  const getClientSales = (team: TeamData) => {
    if (!team.clients || team.clients.length <= 1) return null;
    return team.clients.filter(c => c.sales[period] > 0);
  };

  // Calculate possible work days for a team in this period
  const getPossibleWorkDays = (team: TeamData) => {
    const workDays = getWorkDays(team);
    return team.employeeCount * workDays;
  };

  const formatAbsence = (count: number, possibleDays: number) => {
    if (count === 0) return { display: "-", percentage: 0, count: 0 };
    const percentage = possibleDays > 0 ? Math.round((count / possibleDays) * 100) : 0;
    return { display: `${percentage}%`, fullDisplay: `${percentage}% (${count})`, percentage, count };
  };

  // Get work days from first team (same for all)
  const workDaysInPeriod = data[0]?.workDays?.[period] || 1;

  // Calculate totals
  const totalEmp = data.reduce((sum, t) => sum + t.employeeCount, 0);
  const totalSales = data.reduce((sum, t) => sum + getSalesValue(t), 0);
  const totalSick = data.reduce((sum, t) => sum + getSickValue(t), 0);
  const totalVacation = data.reduce((sum, t) => sum + getVacationValue(t), 0);
  const totalPossibleDays = totalEmp * workDaysInPeriod;

  // Sort by sales descending
  const sortedData = [...data].sort((a, b) => getSalesValue(b) - getSalesValue(a));

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2 bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <TrendingUp className="h-5 w-5 text-primary" />
            Team Performance
          </CardTitle>
          <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <TabsList className="h-8 bg-background/80">
              <TabsTrigger value="day" className="text-xs px-3 h-7 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Dag
              </TabsTrigger>
              <TabsTrigger value="week" className="text-xs px-3 h-7 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Uge
              </TabsTrigger>
              <TabsTrigger value="month" className="text-xs px-3 h-7 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Mdr
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <TooltipProvider>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="font-semibold text-foreground pl-4">Team</TableHead>
                  <TableHead className="text-center font-semibold text-foreground w-20">Salg</TableHead>
                  {showForecast && (
                    <TableHead className="text-center font-semibold text-foreground w-24">
                      <Tooltip>
                        <TooltipTrigger className="cursor-help">Forecast</TooltipTrigger>
                        <TooltipContent>Fremskrivning baseret på salg/arbejdsdag</TooltipContent>
                      </Tooltip>
                    </TableHead>
                  )}
                  <TableHead className="text-center font-semibold text-foreground w-20">Syg</TableHead>
                  <TableHead className="text-center font-semibold text-foreground w-20 pr-4">Ferie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.map((team, index) => {
                  const possibleDays = getPossibleWorkDays(team);
                  const sick = formatAbsence(getSickValue(team), possibleDays);
                  const vacation = formatAbsence(getVacationValue(team), possibleDays);
                  const clientSales = getClientSales(team);
                  const teamForecast = getForecast(getSalesValue(team), getWorkDays(team));
                  const isTopTeam = index === 0 && getSalesValue(team) > 0;
                  
                  return (
                    <TableRow key={team.id} className={isTopTeam ? "bg-emerald-50/50 dark:bg-emerald-950/20" : ""}>
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-2">
                          {isTopTeam && <span className="text-sm">🏆</span>}
                          <span className="font-medium">{team.name}</span>
                          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {team.employeeCount}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex flex-col items-center">
                              <span className={`text-lg font-bold tabular-nums ${getSalesValue(team) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                                {getSalesValue(team)}
                              </span>
                            </div>
                          </TooltipTrigger>
                          {clientSales && clientSales.length > 0 && (
                            <TooltipContent>
                              <div className="space-y-1">
                                {clientSales.map((client) => (
                                  <p key={client.clientName} className="text-xs">
                                    {client.clientName}: <span className="font-semibold">{client.sales[period]}</span>
                                  </p>
                                ))}
                              </div>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TableCell>
                      {showForecast && teamForecast !== null && (
                        <TableCell className="text-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-base font-semibold text-primary tabular-nums">
                                {teamForecast}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-medium">{getSalesValue(team)} salg / {getWorkDays(team)} dage</p>
                              <p className="text-xs text-muted-foreground">
                                = {(getSalesValue(team) / (getWorkDays(team) || 1)).toFixed(1)} salg/dag × {getTotalPeriodWorkDays()} dage
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                      )}
                      <TableCell className="text-center">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={`text-sm tabular-nums ${
                              sick.percentage > 20 
                                ? 'text-rose-600 dark:text-rose-400 font-semibold' 
                                : sick.percentage > 0 
                                  ? 'text-rose-500/80' 
                                  : 'text-muted-foreground'
                            }`}>
                              {sick.fullDisplay || sick.display}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{getSickValue(team)} sygedage af {possibleDays} mulige</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="text-center pr-4">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={`text-sm tabular-nums ${vacation.percentage > 0 ? 'text-blue-500' : 'text-muted-foreground'}`}>
                              {vacation.fullDisplay || vacation.display}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{getVacationValue(team)} feriedage af {possibleDays} mulige</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {/* Total row */}
                <TableRow className="bg-muted/60 font-semibold border-t-2 border-border">
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">Total</span>
                      <span className="text-xs text-muted-foreground bg-background px-1.5 py-0.5 rounded font-normal">
                        {totalEmp}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {totalSales}
                    </span>
                  </TableCell>
                  {showForecast && (
                    <TableCell className="text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-base font-bold text-primary tabular-nums">
                            {getForecast(totalSales, workDaysInPeriod)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-medium">{totalSales} salg / {workDaysInPeriod} dage</p>
                          <p className="text-xs text-muted-foreground">
                            = {(totalSales / (workDaysInPeriod || 1)).toFixed(1)} salg/dag × {getTotalPeriodWorkDays()} dage
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                  )}
                  <TableCell className="text-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={`text-sm tabular-nums ${totalSick > 0 ? 'text-rose-500 font-medium' : 'text-muted-foreground'}`}>
                          {totalPossibleDays > 0 ? `${Math.round((totalSick / totalPossibleDays) * 100)}% (${totalSick})` : '-'}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{totalSick} sygedage af {totalPossibleDays} mulige</p>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className="text-center pr-4">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={`text-sm tabular-nums ${totalVacation > 0 ? 'text-blue-500 font-medium' : 'text-muted-foreground'}`}>
                          {totalPossibleDays > 0 ? `${Math.round((totalVacation / totalPossibleDays) * 100)}% (${totalVacation})` : '-'}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{totalVacation} feriedage af {totalPossibleDays} mulige</p>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </TooltipProvider>
        <div className="px-4 py-2 text-xs text-muted-foreground border-t bg-muted/20 flex items-center justify-between">
          <span>{periodLabels[period]}</span>
          <span>
            {workDaysInPeriod}{showForecast ? `/${getTotalPeriodWorkDays()}` : ""} arbejdsdage
          </span>
        </div>
      </CardContent>
    </Card>
  );
}