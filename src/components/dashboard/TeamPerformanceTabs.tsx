import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ClientData {
  clientId: string;
  clientName: string;
  employeeCount: number;
  sales: { day: number; week: number; month: number };
  sick: { day: number; week: number; month: number };
  vacation: { day: number; week: number; month: number };
  workDays?: { day: number; week: number; month: number };
}

interface TeamPerformanceTabsProps {
  data: ClientData[];
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

  const getSalesValue = (client: ClientData) => client.sales[period];
  const getSickValue = (client: ClientData) => client.sick[period];
  const getVacationValue = (client: ClientData) => client.vacation[period];
  const getWorkDays = (client: ClientData) => client.workDays?.[period] || 1;

  // Calculate possible work days for a client in this period
  const getPossibleWorkDays = (client: ClientData) => {
    const workDays = getWorkDays(client);
    return client.employeeCount * workDays;
  };

  const formatAbsence = (count: number, possibleDays: number) => {
    if (count === 0) return { display: "-", percentage: 0, count: 0 };
    const percentage = possibleDays > 0 ? Math.round((count / possibleDays) * 100) : 0;
    return { display: `${percentage}% (${count})`, percentage, count };
  };

  // Get work days from first client (same for all)
  const workDaysInPeriod = data[0]?.workDays?.[period] || 1;

  // Calculate totals
  const totalEmp = data.reduce((sum, c) => sum + c.employeeCount, 0);
  const totalSales = data.reduce((sum, c) => sum + getSalesValue(c), 0);
  const totalSick = data.reduce((sum, c) => sum + getSickValue(c), 0);
  const totalVacation = data.reduce((sum, c) => sum + getVacationValue(c), 0);
  const totalPossibleDays = totalEmp * workDaysInPeriod;

  // Sort by sales descending
  const sortedData = [...data].sort((a, b) => getSalesValue(b) - getSalesValue(a));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-5 w-5 text-primary" />
            Salg per kunde
          </CardTitle>
          <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <TabsList className="h-8">
              <TabsTrigger value="day" className="text-xs px-3 h-7">
                Dag
              </TabsTrigger>
              <TabsTrigger value="week" className="text-xs px-3 h-7">
                Uge
              </TabsTrigger>
              <TabsTrigger value="month" className="text-xs px-3 h-7">
                Måned
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <TooltipProvider>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-semibold">Kunde</TableHead>
                <TableHead className="text-center font-semibold w-24">
                  <span className="flex items-center justify-center gap-1">
                    📈 Salg
                  </span>
                </TableHead>
                <TableHead className="text-center font-semibold w-28">
                  <span className="flex items-center justify-center gap-1">
                    🤒 Sygdom
                  </span>
                </TableHead>
                <TableHead className="text-center font-semibold w-28">
                  <span className="flex items-center justify-center gap-1">
                    🌴 Ferie
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.map((client) => {
                const possibleDays = getPossibleWorkDays(client);
                const sick = formatAbsence(getSickValue(client), possibleDays);
                const vacation = formatAbsence(getVacationValue(client), possibleDays);
                
                return (
                  <TableRow key={client.clientId}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>{client.clientName}</span>
                        <span className="text-xs text-muted-foreground">({client.employeeCount})</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`text-lg font-bold ${getSalesValue(client) > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                        {getSalesValue(client)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="inline-flex items-center gap-1.5">
                            {sick.percentage > 20 ? (
                              <span className="inline-flex items-center gap-1 bg-rose-500/15 text-rose-600 px-2 py-0.5 rounded-full text-sm font-medium">
                                {sick.display}
                              </span>
                            ) : sick.percentage > 0 ? (
                              <span className="text-sm text-rose-500">{sick.display}</span>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{getSickValue(client)} sygedage ud af {possibleDays} mulige arbejdsdage</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="inline-flex items-center gap-1.5">
                            {vacation.percentage > 0 ? (
                              <span className="text-sm text-blue-500">{vacation.display}</span>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{getVacationValue(client)} feriedage ud af {possibleDays} mulige arbejdsdage</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
              {/* Total row */}
              <TableRow className="bg-muted/50 font-semibold border-t-2">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span>Total</span>
                    <span className="text-xs text-muted-foreground font-normal">({totalEmp})</span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-lg font-bold text-emerald-600">
                    {totalSales}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={`text-sm ${totalSick > 0 ? 'text-rose-500 font-medium' : 'text-muted-foreground'}`}>
                        {totalPossibleDays > 0 ? `${Math.round((totalSick / totalPossibleDays) * 100)}% (${totalSick})` : '-'}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{totalSick} sygedage ud af {totalPossibleDays} mulige arbejdsdage</p>
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell className="text-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={`text-sm ${totalVacation > 0 ? 'text-blue-500 font-medium' : 'text-muted-foreground'}`}>
                        {totalPossibleDays > 0 ? `${Math.round((totalVacation / totalPossibleDays) * 100)}% (${totalVacation})` : '-'}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{totalVacation} feriedage ud af {totalPossibleDays} mulige arbejdsdage</p>
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TooltipProvider>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {periodLabels[period]} • {workDaysInPeriod} arbejdsdag{workDaysInPeriod !== 1 ? 'e' : ''} i perioden • Sorteret efter salg
        </p>
      </CardContent>
    </Card>
  );
}