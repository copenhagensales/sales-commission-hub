import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserCheck, Plus, Search, MoreHorizontal, Trash2, Pencil } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/calculations";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AddPersonnelDialog } from "./AddPersonnelDialog";
import { EditPersonnelDialog } from "./EditPersonnelDialog";
import { format, parseISO } from "date-fns";
import { da } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PersonnelSalary {
  id: string;
  employee_id: string;
  salary_type: string;
  monthly_salary: number;
  percentage_rate: number | null;
  minimum_salary: number | null;
  start_date: string | null;
  is_active: boolean;
  notes: string | null;
  employee: {
    first_name: string;
    last_name: string;
    job_title: string | null;
    salary_type: "provision" | "fixed" | "hourly" | null;
  } | null;
}

export function AssistantSalary() {
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedSalary, setSelectedSalary] = useState<PersonnelSalary | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: salaries = [], isLoading } = useQuery({
    queryKey: ["personnel-salaries", "assistant"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnel_salaries")
        .select(`
          id,
          employee_id,
          salary_type,
          monthly_salary,
          percentage_rate,
          minimum_salary,
          start_date,
          is_active,
          notes,
          employee:employee_master_data(first_name, last_name, job_title, salary_type)
        `)
        .eq("salary_type", "assistant")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as PersonnelSalary[];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("personnel_salaries")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personnel-salaries"] });
      toast({ title: "Status opdateret" });
    },
    onError: () => {
      toast({ title: "Fejl ved opdatering", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("personnel_salaries")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personnel-salaries"] });
      toast({ title: "Assistent fjernet fra lønlisten" });
    },
    onError: () => {
      toast({ title: "Fejl ved sletning", variant: "destructive" });
    },
  });

  const filteredSalaries = salaries.filter((s) => {
    if (!searchQuery) return true;
    const name = `${s.employee?.first_name || ""} ${s.employee?.last_name || ""}`.toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  // formatCurrency imported from @/lib/calculations

  const formatPercentage = (rate: number | null) => {
    if (rate === null || rate === 0) return "-";
    return `${rate}%`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return format(parseISO(dateStr), "d. MMM yyyy", { locale: da });
  };

  const handleEdit = (salary: PersonnelSalary) => {
    setSelectedSalary(salary);
    setEditDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <UserCheck className="h-5 w-5" />
          Assistent-lønninger
        </CardTitle>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Tilføj assistent
        </Button>
      </CardHeader>
      <CardContent>
        {salaries.length === 0 && !isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Ingen assistenter tilføjet</p>
            <p className="text-sm">Klik på "Tilføj assistent" for at komme i gang.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Søg assistent..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Badge variant="secondary">{salaries.length} assistenter</Badge>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Navn</TableHead>
                  <TableHead>Stilling</TableHead>
                  <TableHead>Startdato</TableHead>
                  <TableHead>Procentsats</TableHead>
                  <TableHead>Minimumsløn</TableHead>
                  <TableHead>Månedsløn</TableHead>
                  <TableHead>Aktiv</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSalaries.map((salary) => (
                  <TableRow key={salary.id}>
                    <TableCell className="font-medium">
                      {salary.employee?.first_name} {salary.employee?.last_name}
                    </TableCell>
                    <TableCell>{salary.employee?.job_title || "-"}</TableCell>
                    <TableCell>{formatDate(salary.start_date)}</TableCell>
                    <TableCell>{formatPercentage(salary.percentage_rate)}</TableCell>
                    <TableCell>{salary.minimum_salary ? formatCurrency(salary.minimum_salary) : "-"}</TableCell>
                    <TableCell>{formatCurrency(salary.monthly_salary)}</TableCell>
                    <TableCell>
                      <Switch
                        checked={salary.is_active}
                        onCheckedChange={(checked) =>
                          toggleMutation.mutate({ id: salary.id, is_active: checked })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(salary)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Rediger
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteMutation.mutate(salary.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Fjern fra liste
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>

      <AddPersonnelDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        salaryType="assistant"
        title="Tilføj assistent"
      />

      <EditPersonnelDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        salary={selectedSalary}
      />
    </Card>
  );
}
