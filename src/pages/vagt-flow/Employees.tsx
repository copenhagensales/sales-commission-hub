import { MainLayout } from "@/components/layout/MainLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Users, Phone, Mail, Edit, Plus, Trash2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function VagtEmployees() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [editForm, setEditForm] = useState({
    role: "employee" as "admin" | "planner" | "employee",
    is_active: true,
    team: "" as string,
  });

  const [newEmployeeForm, setNewEmployeeForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    role: "employee" as "admin" | "planner" | "employee",
    team: "" as string,
    is_active: true,
  });

  const { data: employees, isLoading } = useQuery({
    queryKey: ["vagt-all-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee")
        .select("*")
        .order("full_name");

      if (error) throw error;
      return data;
    },
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: async (data: { id: string; role: any; is_active: boolean; team: any }) => {
      const { error } = await supabase
        .from("employee")
        .update({
          role: data.role,
          is_active: data.is_active,
          team: data.team || null,
        })
        .eq("id", data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vagt-all-employees"] });
      setSelectedEmployee(null);
      toast({ title: "Medarbejder opdateret" });
    },
  });

  const addEmployeeMutation = useMutation({
    mutationFn: async (data: typeof newEmployeeForm) => {
      const employeeId = crypto.randomUUID();

      const { error } = await supabase.from("employee").insert({
        id: employeeId,
        full_name: data.full_name,
        email: data.email || `temp-${employeeId}@placeholder.local`,
        phone: data.phone || null,
        role: data.role,
        team: data.team || null,
        is_active: data.is_active,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vagt-all-employees"] });
      setShowAddDialog(false);
      setNewEmployeeForm({
        full_name: "",
        email: "",
        phone: "",
        role: "employee",
        team: "",
        is_active: true,
      });
      toast({ title: "Medarbejder tilføjet" });
    },
    onError: (error: any) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const deleteEmployeeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employee").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vagt-all-employees"] });
      setShowDeleteDialog(null);
      toast({ title: "Medarbejder slettet" });
    },
  });

  const openEditDialog = (employee: any) => {
    setSelectedEmployee(employee);
    setEditForm({
      role: employee.role,
      is_active: employee.is_active,
      team: employee.team || "",
    });
  };

  const handleUpdate = () => {
    if (!selectedEmployee) return;
    updateEmployeeMutation.mutate({
      id: selectedEmployee.id,
      role: editForm.role,
      is_active: editForm.is_active,
      team: editForm.team,
    });
  };

  const filteredEmployees = employees?.filter((emp) => {
    const matchesSearch = !searchQuery ||
      emp.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTeam = teamFilter === "all" || emp.team === teamFilter;

    return matchesSearch && matchesTeam;
  });

  const roleLabels: Record<string, string> = {
    admin: "Administrator",
    planner: "Planlægger",
    employee: "Medarbejder",
  };

  const teamColors: Record<string, string> = {
    Eesy: "bg-orange-500",
    YouSee: "bg-blue-600",
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Medarbejdere</h1>
            <p className="text-muted-foreground">Administrer medarbejdere og teams</p>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" /> Ny medarbejder
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4 mb-6">
              <Input
                placeholder="Søg efter navn eller email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
              />
              <Select value={teamFilter} onValueChange={setTeamFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Alle teams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle teams</SelectItem>
                  <SelectItem value="Eesy">Eesy</SelectItem>
                  <SelectItem value="YouSee">YouSee</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <p>Indlæser...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Navn</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Rolle</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees?.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">{emp.full_name}</TableCell>
                      <TableCell>{emp.email}</TableCell>
                      <TableCell>{emp.phone || "-"}</TableCell>
                      <TableCell>
                        {emp.team ? (
                          <Badge className={`${teamColors[emp.team] || "bg-gray-500"} text-white`}>
                            {emp.team}
                          </Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{roleLabels[emp.role] || emp.role}</TableCell>
                      <TableCell>
                        <Badge variant={emp.is_active ? "default" : "secondary"}>
                          {emp.is_active ? "Aktiv" : "Inaktiv"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(emp)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setShowDeleteDialog(emp.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!selectedEmployee} onOpenChange={() => setSelectedEmployee(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rediger medarbejder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Rolle</Label>
              <Select value={editForm.role} onValueChange={(v: any) => setEditForm({ ...editForm, role: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="planner">Planlægger</SelectItem>
                  <SelectItem value="employee">Medarbejder</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Team</Label>
              <Select value={editForm.team} onValueChange={(v) => setEditForm({ ...editForm, team: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Vælg team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Eesy">Eesy</SelectItem>
                  <SelectItem value="YouSee">YouSee</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={editForm.is_active} onCheckedChange={(c) => setEditForm({ ...editForm, is_active: c })} />
              <Label>Aktiv</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedEmployee(null)}>Annuller</Button>
            <Button onClick={handleUpdate} disabled={updateEmployeeMutation.isPending}>Gem</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ny medarbejder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Navn *</Label>
              <Input value={newEmployeeForm.full_name} onChange={(e) => setNewEmployeeForm({ ...newEmployeeForm, full_name: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={newEmployeeForm.email} onChange={(e) => setNewEmployeeForm({ ...newEmployeeForm, email: e.target.value })} />
            </div>
            <div>
              <Label>Telefon</Label>
              <Input value={newEmployeeForm.phone} onChange={(e) => setNewEmployeeForm({ ...newEmployeeForm, phone: e.target.value })} />
            </div>
            <div>
              <Label>Team</Label>
              <Select value={newEmployeeForm.team} onValueChange={(v) => setNewEmployeeForm({ ...newEmployeeForm, team: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Vælg team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Eesy">Eesy</SelectItem>
                  <SelectItem value="YouSee">YouSee</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Rolle</Label>
              <Select value={newEmployeeForm.role} onValueChange={(v: any) => setNewEmployeeForm({ ...newEmployeeForm, role: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="planner">Planlægger</SelectItem>
                  <SelectItem value="employee">Medarbejder</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Annuller</Button>
            <Button onClick={() => addEmployeeMutation.mutate(newEmployeeForm)} disabled={!newEmployeeForm.full_name || addEmployeeMutation.isPending}>
              Opret
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet medarbejder?</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på at du vil slette denne medarbejder? Alle tilknyttede vagter vil også blive slettet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => showDeleteDialog && deleteEmployeeMutation.mutate(showDeleteDialog)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Slet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
