import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCanAccess } from "@/hooks/useSystemRoles";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Shield, CheckCircle2, XCircle, AlertTriangle, Search, Users } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { da } from "date-fns/locale";
import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";

interface EmployeeWithStatus {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  manager_id: string | null;
  completion: {
    passed_at: string;
    isExpired: boolean;
    daysUntilExpiry: number;
  } | null;
  totalAttempts: number;
  wrongAnswersBeforePass: number;
}

export default function CodeOfConductAdmin() {
  const { isOwner, isTeamlederOrAbove } = useCanAccess();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  // Get current user's employee ID for teamleder filtering
  const { data: currentEmployeeId } = useQuery({
    queryKey: ["current-employee-id", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const { data } = await supabase
        .from("employee_master_data")
        .select("id")
        .or(`private_email.eq.${user.email},work_email.eq.${user.email}`)
        .maybeSingle();
      return data?.id || null;
    },
    enabled: !!user?.email,
  });

  // Fetch all Salgskonsulenter with their Code of Conduct status
  const { data: employees, isLoading } = useQuery({
    queryKey: ["code-of-conduct-admin", currentEmployeeId, isOwner],
    queryFn: async () => {
      // Get all Salgskonsulenter
      let query = supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, job_title, manager_id")
        .eq("is_active", true)
        .eq("job_title", "Salgskonsulent");

      // If not owner, filter by manager_id (teamleder can only see their team)
      if (!isOwner && currentEmployeeId) {
        query = query.eq("manager_id", currentEmployeeId);
      }

      const { data: employeesData, error } = await query.order("first_name");
      if (error) throw error;

      if (!employeesData || employeesData.length === 0) return [];

      const employeeIds = employeesData.map(e => e.id);

      // Get completions for all employees
      const { data: completions } = await supabase
        .from("code_of_conduct_completions")
        .select("employee_id, passed_at")
        .in("employee_id", employeeIds);

      // Get all attempts for statistics
      const { data: attempts } = await supabase
        .from("code_of_conduct_attempts")
        .select("employee_id, passed, wrong_question_numbers")
        .in("employee_id", employeeIds);

      // Build employee status map
      const completionMap = new Map(
        (completions || []).map(c => [c.employee_id, c])
      );

      // Calculate attempt statistics per employee
      const attemptStats = new Map<string, { total: number; wrongBeforePass: number }>();
      for (const attempt of attempts || []) {
        const current = attemptStats.get(attempt.employee_id) || { total: 0, wrongBeforePass: 0 };
        current.total += 1;
        if (!attempt.passed && attempt.wrong_question_numbers) {
          current.wrongBeforePass += (attempt.wrong_question_numbers as number[]).length;
        }
        attemptStats.set(attempt.employee_id, current);
      }

      return employeesData.map(emp => {
        const completion = completionMap.get(emp.id);
        const stats = attemptStats.get(emp.id) || { total: 0, wrongBeforePass: 0 };

        let completionStatus = null;
        if (completion) {
          const passedDate = new Date(completion.passed_at);
          const daysSincePassed = differenceInDays(new Date(), passedDate);
          const daysUntilExpiry = 60 - daysSincePassed; // 2 months
          completionStatus = {
            passed_at: completion.passed_at,
            isExpired: daysSincePassed >= 60, // 2 months
            daysUntilExpiry: Math.max(0, daysUntilExpiry),
          };
        }

        return {
          id: emp.id,
          first_name: emp.first_name,
          last_name: emp.last_name,
          job_title: emp.job_title,
          manager_id: emp.manager_id,
          completion: completionStatus,
          totalAttempts: stats.total,
          wrongAnswersBeforePass: stats.wrongBeforePass,
        } as EmployeeWithStatus;
      });
    },
    enabled: isTeamlederOrAbove && !!currentEmployeeId,
  });

  // Filter employees by search
  const filteredEmployees = useMemo(() => {
    if (!employees) return [];
    if (!searchQuery.trim()) return employees;

    const query = searchQuery.toLowerCase();
    return employees.filter(emp => 
      `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(query)
    );
  }, [employees, searchQuery]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (!employees) return { total: 0, passed: 0, expired: 0, notStarted: 0 };

    return {
      total: employees.length,
      passed: employees.filter(e => e.completion && !e.completion.isExpired).length,
      expired: employees.filter(e => e.completion?.isExpired).length,
      notStarted: employees.filter(e => !e.completion).length,
    };
  }, [employees]);

  if (!isTeamlederOrAbove) {
    return (
      <MainLayout>
        <div className="container mx-auto">
          <Card>
            <CardContent className="py-12 text-center">
              <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Du har ikke adgang til denne side.</p>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Code of Conduct Overblik</h1>
          <p className="text-muted-foreground">
            {isOwner ? "Alle salgskonsulenter" : "Dit team"}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Salgskonsulenter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{stats.total}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Bestået
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="text-2xl font-bold">{stats.passed}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Udløbet
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <span className="text-2xl font-bold">{stats.expired}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ikke påbegyndt
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              <span className="text-2xl font-bold">{stats.notStarted}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Søg efter medarbejder..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Employee Table */}
      <Card>
        <CardHeader>
          <CardTitle>Status oversigt</CardTitle>
          <CardDescription>
            Oversigt over Code of Conduct & GDPR test resultater
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">
              Indlæser...
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              Ingen salgskonsulenter fundet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medarbejder</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sidst bestået</TableHead>
                  <TableHead className="text-right">Forsøg</TableHead>
                  <TableHead className="text-right">Forkerte svar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">
                      {employee.first_name} {employee.last_name}
                    </TableCell>
                    <TableCell>
                      {employee.completion ? (
                        employee.completion.isExpired ? (
                          <Badge variant="outline" className="border-amber-500 text-amber-600">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Udløbet
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-green-500 text-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Bestået ({employee.completion.daysUntilExpiry}d)
                          </Badge>
                        )
                      ) : (
                        <Badge variant="outline" className="border-destructive text-destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          Ikke påbegyndt
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {employee.completion ? (
                        format(new Date(employee.completion.passed_at), "d. MMM yyyy", { locale: da })
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {employee.totalAttempts || 0}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={employee.wrongAnswersBeforePass > 0 ? "text-amber-600 font-medium" : ""}>
                        {employee.wrongAnswersBeforePass || 0}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  </MainLayout>
  );
}
