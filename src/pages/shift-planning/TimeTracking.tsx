import { useState } from "react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { da } from "date-fns/locale";
import { Clock, ChevronLeft, ChevronRight, Filter, AlertTriangle } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDepartments } from "@/hooks/useShiftPlanning";

interface TimeEntryWithDetails {
  id: string;
  employee_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  actual_hours: number | null;
  note: string | null;
  shift: {
    id: string;
    start_time: string;
    end_time: string;
    planned_hours: number | null;
  } | null;
  employee: {
    id: string;
    first_name: string;
    last_name: string;
    department: string | null;
  };
}

export default function TimeTracking() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");

  const { data: departments } = useDepartments();

  const monthStart = format(startOfMonth(currentMonth), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");

  const { data: timeEntries, isLoading } = useQuery({
    queryKey: ["all-time-entries", monthStart, monthEnd, selectedDepartment],
    queryFn: async () => {
      // If team is selected, first get team member IDs
      let teamMemberIds: string[] | null = null;
      if (selectedDepartment && selectedDepartment !== "all") {
        const { data: teamMembers, error: tmError } = await supabase
          .from("team_members")
          .select("employee_id")
          .eq("team_id", selectedDepartment);
        
        if (tmError) throw tmError;
        teamMemberIds = teamMembers?.map(tm => tm.employee_id) || [];
      }

      let query = supabase
        .from("time_entry")
        .select(`
          *,
          shift(*),
          employee:employee_master_data(id, first_name, last_name, department)
        `)
        .gte("date", monthStart)
        .lte("date", monthEnd)
        .order("date", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      // Filter by team membership
      let filtered = data as TimeEntryWithDetails[];
      if (teamMemberIds !== null) {
        filtered = filtered.filter(e => teamMemberIds!.includes(e.employee_id));
      }
      return filtered;
    },
  });

  const totalActualHours = timeEntries?.reduce((sum, e) => sum + (e.actual_hours || 0), 0) || 0;
  const totalPlannedHours = timeEntries?.reduce((sum, e) => sum + (e.shift?.planned_hours || 0), 0) || 0;
  const hoursDifference = totalActualHours - totalPlannedHours;

  const getTimeDifference = (entry: TimeEntryWithDetails) => {
    if (!entry.shift || !entry.actual_hours) return null;
    const diff = entry.actual_hours - (entry.shift.planned_hours || 0);
    return diff;
  };

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Tidsregistrering</h1>
            <p className="text-muted-foreground">
              Overblik over stemplinger og timer
            </p>
          </div>
          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Alle afdelinger" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle afdelinger</SelectItem>
              {departments?.map(team => (
                <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            {format(subMonths(currentMonth, 1), "MMMM", { locale: da })}
          </Button>
          <h2 className="text-lg font-semibold">
            {format(currentMonth, "MMMM yyyy", { locale: da })}
          </h2>
          <Button
            variant="outline"
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
          >
            {format(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1), "MMMM", { locale: da })}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Registreringer</p>
              <p className="text-2xl font-bold">{timeEntries?.length || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Planlagte timer</p>
              <p className="text-2xl font-bold">{totalPlannedHours.toFixed(1)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Faktiske timer</p>
              <p className="text-2xl font-bold">{totalActualHours.toFixed(1)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Difference</p>
              <p className={`text-2xl font-bold ${hoursDifference > 0 ? "text-green-600" : hoursDifference < 0 ? "text-red-600" : ""}`}>
                {hoursDifference > 0 ? "+" : ""}{hoursDifference.toFixed(1)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Time Entries Table */}
        <Card>
          <CardHeader>
            <CardTitle>Stemplinger</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Indlæser...</div>
            ) : timeEntries && timeEntries.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dato</TableHead>
                    <TableHead>Medarbejder</TableHead>
                    <TableHead>Afdeling</TableHead>
                    <TableHead>Planlagt</TableHead>
                    <TableHead>Stemplet ind</TableHead>
                    <TableHead>Stemplet ud</TableHead>
                    <TableHead>Faktisk</TableHead>
                    <TableHead>Difference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timeEntries.map(entry => {
                    const diff = getTimeDifference(entry);
                    return (
                      <TableRow key={entry.id}>
                        <TableCell>{format(new Date(entry.date), "d. MMM", { locale: da })}</TableCell>
                        <TableCell>{entry.employee?.first_name} {entry.employee?.last_name}</TableCell>
                        <TableCell>{entry.employee?.department || "-"}</TableCell>
                        <TableCell>
                          {entry.shift ? (
                            <span>{entry.shift.start_time.slice(0, 5)} - {entry.shift.end_time.slice(0, 5)}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {entry.clock_in ? format(new Date(entry.clock_in), "HH:mm") : "-"}
                        </TableCell>
                        <TableCell>
                          {entry.clock_out ? format(new Date(entry.clock_out), "HH:mm") : (
                            <Badge variant="secondary">Aktiv</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {entry.actual_hours?.toFixed(1) || "-"}
                        </TableCell>
                        <TableCell>
                          {diff !== null && (
                            <Badge variant={diff > 0 ? "default" : diff < 0 ? "destructive" : "secondary"}>
                              {diff > 0 ? "+" : ""}{diff.toFixed(1)}t
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Ingen stemplinger i denne periode
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
