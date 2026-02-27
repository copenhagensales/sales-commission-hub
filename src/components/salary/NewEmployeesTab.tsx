import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PayrollPeriodSelector } from "@/components/employee/PayrollPeriodSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserCog } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { EmployeeProfileDialog } from "@/components/employee/EmployeeProfileDialog";

interface NewEmployee {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  employment_start_date: string | null;
  is_staff_employee: boolean | null;
  is_active: boolean | null;
  is_freelance_consultant: boolean | null;
  team_members: Array<{
    teams: {
      name: string;
    } | null;
  }>;
}

export function NewEmployeesTab() {
  const [periodStart, setPeriodStart] = useState<Date | null>(null);
  const [periodEnd, setPeriodEnd] = useState<Date | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handlePeriodChange = useCallback((start: Date, end: Date) => {
    setPeriodStart(start);
    setPeriodEnd(end);
  }, []);

  const { data: employees, isLoading } = useQuery({
    queryKey: ["new-employees", periodStart?.toISOString(), periodEnd?.toISOString()],
    queryFn: async () => {
      if (!periodStart || !periodEnd) return [];

      const startStr = format(periodStart, "yyyy-MM-dd");
      const endStr = format(periodEnd, "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("employee_master_data")
        .select(`
          id,
          first_name,
          last_name,
          job_title,
          employment_start_date,
          is_staff_employee,
          is_active,
          is_freelance_consultant,
          team_members(teams(name))
        `)
        .gte("employment_start_date", startStr)
        .lte("employment_start_date", endStr)
        .order("employment_start_date", { ascending: true });

      if (error) throw error;
      return data as NewEmployee[];
    },
    enabled: !!periodStart && !!periodEnd,
  });

  const regularEmployees = employees?.filter((e) => !e.is_staff_employee) ?? [];
  const staffEmployees = employees?.filter((e) => e.is_staff_employee) ?? [];

  const handleRowClick = (employeeId: string) => {
    setSelectedEmployeeId(employeeId);
    setDialogOpen(true);
  };

  const getTeamName = (employee: NewEmployee): string => {
    const teamMember = employee.team_members?.[0];
    return teamMember?.teams?.name ?? "-";
  };

  const formatStartDate = (dateStr: string | null): string => {
    if (!dateStr) return "-";
    return format(new Date(dateStr), "d. MMM yyyy", { locale: da });
  };

  const EmployeeTable = ({ 
    employees, 
    title, 
    icon: Icon,
    columnLabel 
  }: { 
    employees: NewEmployee[]; 
    title: string; 
    icon: React.ElementType;
    columnLabel: string;
  }) => (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Icon className="h-5 w-5" />
          {title} ({employees.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {employees.length === 0 ? (
          <p className="text-muted-foreground text-sm py-4 text-center">
            Ingen nye {title.toLowerCase()} i denne periode
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Navn</TableHead>
                <TableHead>Stilling</TableHead>
                <TableHead>Startdato</TableHead>
                <TableHead>{columnLabel}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow
                  key={employee.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleRowClick(employee.id)}
                >
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      {employee.first_name} {employee.last_name}
                      {employee.is_freelance_consultant && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-amber-500 text-white border-transparent hover:bg-amber-600">Freelance</Badge>
                      )}
                      {employee.is_active === false && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Inaktiv</Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>{employee.job_title ?? "-"}</TableCell>
                  <TableCell>{formatStartDate(employee.employment_start_date)}</TableCell>
                  <TableCell>{getTeamName(employee)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <PayrollPeriodSelector onChange={handlePeriodChange} />
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <div className="space-y-6">
          <EmployeeTable
            employees={regularEmployees}
            title="Medarbejdere"
            icon={Users}
            columnLabel="Team"
          />
          <EmployeeTable
            employees={staffEmployees}
            title="Stab"
            icon={UserCog}
            columnLabel="Afdeling"
          />
        </div>
      )}

      <EmployeeProfileDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen} 
        employeeId={selectedEmployeeId} 
      />
    </div>
  );
}
