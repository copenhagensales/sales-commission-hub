import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { differenceInMonths, differenceInDays } from "date-fns";
import { Users } from "lucide-react";

interface TeamEmployeeListProps {
  teamName: string;
}

function formatTenure(employmentStartDate: string | null): string {
  if (!employmentStartDate) return "Ukendt";
  
  const startDate = new Date(employmentStartDate);
  const now = new Date();
  const months = differenceInMonths(now, startDate);
  const days = differenceInDays(now, startDate);
  
  if (months < 1) {
    return `${days} dage`;
  }
  
  if (months < 12) {
    return `${months} mdr`;
  }
  
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  
  if (remainingMonths === 0) {
    return `${years} år`;
  }
  
  return `${years} år ${remainingMonths} mdr`;
}

export function TeamEmployeeList({ teamName }: TeamEmployeeListProps) {
  const { data: employees, isLoading } = useQuery({
    queryKey: ["team-employee-list", teamName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select(`
          employee_id,
          teams!inner(name),
          employee_master_data!inner(
            id,
            first_name,
            last_name,
            employment_start_date,
            is_active
          )
        `)
        .ilike("teams.name", `%${teamName}%`);
      
      if (error) throw error;
      
      // Filter active employees and sort by tenure (longest first)
      return data
        .filter((tm: any) => tm.employee_master_data?.is_active)
        .map((tm: any) => ({
          id: tm.employee_master_data.id,
          name: `${tm.employee_master_data.first_name} ${tm.employee_master_data.last_name}`.trim(),
          employmentStartDate: tm.employee_master_data.employment_start_date,
          teamName: tm.teams.name,
        }))
        .sort((a: any, b: any) => {
          if (!a.employmentStartDate) return 1;
          if (!b.employmentStartDate) return -1;
          return new Date(a.employmentStartDate).getTime() - new Date(b.employmentStartDate).getTime();
        });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            {teamName} - Medarbejdere
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-pulse text-muted-foreground">Indlæser...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5" />
          {employees?.[0]?.teamName || teamName} - Medarbejdere ({employees?.length || 0})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Navn</TableHead>
              <TableHead>Ansat siden</TableHead>
              <TableHead className="text-right">Anciennitet</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees?.map((employee: any) => (
              <TableRow key={employee.id}>
                <TableCell className="font-medium">{employee.name}</TableCell>
                <TableCell>
                  {employee.employmentStartDate 
                    ? new Date(employee.employmentStartDate).toLocaleDateString("da-DK")
                    : "Ukendt"}
                </TableCell>
                <TableCell className="text-right">
                  {formatTenure(employee.employmentStartDate)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}