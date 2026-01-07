import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Percent, User, Plus, Trash2 } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
}

interface SalaryScheme {
  id: string;
  name: string;
  description: string | null;
  scheme_type: string;
  percentage_value: number | null;
  fixed_amount: number | null;
  is_active: boolean;
}

interface EmployeeSalaryScheme {
  id: string;
  employee_id: string;
  salary_scheme_id: string;
  effective_from: string;
  effective_to: string | null;
  salary_schemes?: SalaryScheme;
  employee?: Employee;
}

const SalarySchemes = () => {
  const queryClient = useQueryClient();
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [selectedScheme, setSelectedScheme] = useState<string>("");

  // Fetch employees
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-for-salary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, job_title")
        .eq("is_active", true)
        .order("first_name");
      if (error) throw error;
      return data as Employee[];
    },
  });

  // Fetch salary schemes
  const { data: salarySchemes = [] } = useQuery({
    queryKey: ["salary-schemes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salary_schemes")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as SalaryScheme[];
    },
  });

  // Fetch employee salary scheme assignments
  const { data: employeeSchemes = [] } = useQuery({
    queryKey: ["employee-salary-schemes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_salary_schemes")
        .select(`
          *,
          salary_schemes (*)
        `)
        .is("effective_to", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      
      // Fetch employee data separately
      const employeeIds = data.map(d => d.employee_id);
      const { data: employeeData } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, job_title")
        .in("id", employeeIds);
      
      const employeeMap = new Map(employeeData?.map(e => [e.id, e]) || []);
      
      return data.map(d => ({
        ...d,
        employee: employeeMap.get(d.employee_id) as Employee | undefined
      })) as EmployeeSalaryScheme[];
    },
  });

  // Assign salary scheme mutation
  const assignMutation = useMutation({
    mutationFn: async ({ employeeId, schemeId }: { employeeId: string; schemeId: string }) => {
      const { error } = await supabase
        .from("employee_salary_schemes")
        .insert({
          employee_id: employeeId,
          salary_scheme_id: schemeId,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lønordning tildelt");
      queryClient.invalidateQueries({ queryKey: ["employee-salary-schemes"] });
      setSelectedEmployee("");
      setSelectedScheme("");
    },
    onError: (err) => {
      toast.error("Kunne ikke tildele lønordning: " + (err as Error).message);
    },
  });

  // Remove salary scheme mutation
  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("employee_salary_schemes")
        .update({ effective_to: new Date().toISOString().split("T")[0] })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lønordning fjernet");
      queryClient.invalidateQueries({ queryKey: ["employee-salary-schemes"] });
    },
    onError: (err) => {
      toast.error("Kunne ikke fjerne lønordning: " + (err as Error).message);
    },
  });

  const handleAssign = () => {
    if (!selectedEmployee || !selectedScheme) {
      toast.error("Vælg både medarbejder og lønordning");
      return;
    }
    assignMutation.mutate({ employeeId: selectedEmployee, schemeId: selectedScheme });
  };

  const getSchemeTypeBadge = (type: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      percentage_db: { label: "DB-procent", className: "bg-purple-100 text-purple-800" },
      fixed: { label: "Fast løn", className: "bg-blue-100 text-blue-800" },
      commission: { label: "Provision", className: "bg-green-100 text-green-800" },
      hourly: { label: "Timeløn", className: "bg-orange-100 text-orange-800" },
    };
    const variant = variants[type] || { label: type, className: "bg-gray-100 text-gray-800" };
    return <Badge className={variant.className}>{variant.label}</Badge>;
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <Percent className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Lønordninger</h1>
        </div>

        {/* Assignment Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Tildel lønordning
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Medarbejder</Label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vælg medarbejder" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name}
                        {emp.job_title && ` (${emp.job_title})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Lønordning</Label>
                <Select value={selectedScheme} onValueChange={setSelectedScheme}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vælg lønordning" />
                  </SelectTrigger>
                  <SelectContent>
                    {salarySchemes.map((scheme) => (
                      <SelectItem key={scheme.id} value={scheme.id}>
                        {scheme.name}
                        {scheme.percentage_value && ` (${scheme.percentage_value}%)`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button onClick={handleAssign} disabled={assignMutation.isPending}>
                  <Plus className="h-4 w-4 mr-2" />
                  Tildel
                </Button>
              </div>
            </div>

            {selectedScheme && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                {salarySchemes.find((s) => s.id === selectedScheme)?.description}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Available Schemes */}
        <Card>
          <CardHeader>
            <CardTitle>Tilgængelige lønordninger</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {salarySchemes.map((scheme) => (
                <div key={scheme.id} className="p-4 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{scheme.name}</span>
                    {getSchemeTypeBadge(scheme.scheme_type)}
                  </div>
                  <p className="text-sm text-muted-foreground">{scheme.description}</p>
                  {scheme.percentage_value && (
                    <p className="text-sm font-medium text-primary">
                      {scheme.percentage_value}% af teamets DB
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Current Assignments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Aktive tildelinger
            </CardTitle>
          </CardHeader>
          <CardContent>
            {employeeSchemes.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Ingen lønordninger tildelt endnu
              </p>
            ) : (
              <div className="space-y-3">
                {employeeSchemes.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="font-medium">
                          {assignment.employee?.first_name} {assignment.employee?.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {assignment.employee?.job_title || "Ingen stilling"}
                        </p>
                      </div>
                      <div>
                        {assignment.salary_schemes && getSchemeTypeBadge(assignment.salary_schemes.scheme_type)}
                      </div>
                      <div className="text-sm">
                        {assignment.salary_schemes?.name}
                        {assignment.salary_schemes?.percentage_value && (
                          <span className="ml-1 text-primary font-medium">
                            ({assignment.salary_schemes.percentage_value}%)
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMutation.mutate(assignment.id)}
                      disabled={removeMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default SalarySchemes;
