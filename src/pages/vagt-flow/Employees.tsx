import { MainLayout } from "@/components/layout/MainLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Users, Phone, Mail, Edit, Plus, Trash2, ChevronLeft, ChevronRight, Calendar, CheckCircle2, XCircle, UserPlus, Key } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { startOfWeek, addWeeks, addDays, format, getWeek, getYear, parseISO, isWithinInterval } from "date-fns";
import { da } from "date-fns/locale";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["M", "T", "O", "T", "F", "L", "S"];

export default function VagtEmployees() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [showAbsenceDialog, setShowAbsenceDialog] = useState<any>(null);
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [referenceDate, setReferenceDate] = useState(new Date());

  const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
  const weekNumber = getWeek(referenceDate, { weekStartsOn: 1 });
  const year = getYear(referenceDate);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const [editForm, setEditForm] = useState({
    role: "employee" as "admin" | "planner" | "employee",
    is_active: true,
    team: "" as string,
  });

  const [absenceForm, setAbsenceForm] = useState({
    selectedDays: [] as number[],
    reason: "Ferie" as "Ferie" | "Syg" | "Barn syg" | "Andet",
    note: "",
  });
  const [absenceWeekDate, setAbsenceWeekDate] = useState(new Date());

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

  const { data: absences } = useQuery({
    queryKey: ["vagt-week-absences", year, weekNumber],
    queryFn: async () => {
      const weekStartStr = format(weekStart, "yyyy-MM-dd");
      const weekEndStr = format(addDays(weekStart, 6), "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("employee_absence")
        .select("*")
        .lte("start_date", weekEndStr)
        .gte("end_date", weekStartStr);

      if (error) throw error;
      return data;
    },
  });

  // Find absence ID for a specific employee and day
  const getAbsenceForDay = (employeeId: string, dayIndex: number) => {
    const date = weekDates[dayIndex];
    return absences?.find(a => {
      if (a.employee_id !== employeeId) return false;
      const absenceStart = parseISO(a.start_date);
      const absenceEnd = parseISO(a.end_date);
      return isWithinInterval(date, { start: absenceStart, end: absenceEnd });
    });
  };

  const toggleDayAbsenceMutation = useMutation({
    mutationFn: async (data: { employeeId: string; dayIndex: number; isAbsent: boolean; absenceId?: string }) => {
      const date = weekDates[data.dayIndex];
      const dateStr = format(date, "yyyy-MM-dd");

      if (data.isAbsent && data.absenceId) {
        // Remove absence - check if it's a single day or needs splitting
        const absence = absences?.find(a => a.id === data.absenceId);
        if (absence) {
          const absenceStart = absence.start_date;
          const absenceEnd = absence.end_date;
          
          if (absenceStart === absenceEnd) {
            // Single day absence - just delete it
            const { error } = await supabase.from("employee_absence").delete().eq("id", data.absenceId);
            if (error) throw error;
          } else if (absenceStart === dateStr) {
            // First day of multi-day - move start forward
            const newStart = format(addDays(date, 1), "yyyy-MM-dd");
            const { error } = await supabase.from("employee_absence").update({ start_date: newStart }).eq("id", data.absenceId);
            if (error) throw error;
          } else if (absenceEnd === dateStr) {
            // Last day of multi-day - move end backward
            const newEnd = format(addDays(date, -1), "yyyy-MM-dd");
            const { error } = await supabase.from("employee_absence").update({ end_date: newEnd }).eq("id", data.absenceId);
            if (error) throw error;
          } else {
            // Middle of multi-day - split into two
            const { error: updateError } = await supabase.from("employee_absence")
              .update({ end_date: format(addDays(date, -1), "yyyy-MM-dd") })
              .eq("id", data.absenceId);
            if (updateError) throw updateError;
            
            const { error: insertError } = await supabase.from("employee_absence").insert({
              employee_id: data.employeeId,
              start_date: format(addDays(date, 1), "yyyy-MM-dd"),
              end_date: absenceEnd,
              reason: absence.reason,
              status: absence.status,
              note: absence.note,
            });
            if (insertError) throw insertError;
          }
        }
      } else {
        // Add absence for this day
        const { error } = await supabase.from("employee_absence").insert({
          employee_id: data.employeeId,
          start_date: dateStr,
          end_date: dateStr,
          reason: "Andet" as const,
          status: "APPROVED",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vagt-week-absences"] });
      toast({ title: "Tilgængelighed opdateret" });
    },
    onError: (error: any) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
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

  const addAbsenceMutation = useMutation({
    mutationFn: async (data: { employee_id: string; selectedDays: number[]; reason: "Ferie" | "Syg" | "Barn syg" | "Andet"; note: string; weekStart: Date }) => {
      console.log("Adding absence with data:", data);
      
      if (!data.selectedDays || data.selectedDays.length === 0) {
        throw new Error("Ingen dage valgt");
      }
      
      // Create individual absences for each selected day
      const absencesToInsert = data.selectedDays.map(dayIndex => {
        const date = addDays(data.weekStart, dayIndex);
        const dateStr = format(date, "yyyy-MM-dd");
        return {
          employee_id: data.employee_id,
          start_date: dateStr,
          end_date: dateStr,
          reason: data.reason,
          note: data.note || null,
          status: "APPROVED",
        };
      });

      console.log("Absences to insert:", absencesToInsert);

      const { error } = await supabase.from("employee_absence").insert(absencesToInsert);
      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vagt-week-absences"] });
      setShowAbsenceDialog(null);
      setAbsenceForm({ selectedDays: [], reason: "Ferie", note: "" });
      toast({ title: "Fravær tilføjet" });
    },
    onError: (error: any) => {
      console.error("Mutation error:", error);
      toast({ title: "Fejl ved oprettelse af fravær", description: error.message, variant: "destructive" });
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

  const navigateWeek = (direction: "prev" | "next") => {
    setReferenceDate(addWeeks(referenceDate, direction === "next" ? 1 : -1));
  };

  const getEmployeeAbsenceDays = (employeeId: string) => {
    const employeeAbsences = absences?.filter(a => a.employee_id === employeeId && a.status === "APPROVED") || [];
    const absentDays: number[] = [];

    employeeAbsences.forEach(absence => {
      const absenceStart = parseISO(absence.start_date);
      const absenceEnd = parseISO(absence.end_date);

      weekDates.forEach((date, idx) => {
        if (isWithinInterval(date, { start: absenceStart, end: absenceEnd })) {
          absentDays.push(idx);
        }
      });
    });

    return absentDays;
  };

  const filteredEmployees = employees?.filter((emp) => {
    const matchesSearch = !searchQuery ||
      emp.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTeam = teamFilter === "all" || emp.team === teamFilter;

    return matchesSearch && matchesTeam;
  });

  const activeEmployees = filteredEmployees?.filter(e => e.is_active) || [];
  const availableCount = activeEmployees.filter(emp => {
    const absentDays = getEmployeeAbsenceDays(emp.id);
    return absentDays.length < 5; // Available if absent less than 5 days
  }).length;
  const unavailableCount = activeEmployees.length - availableCount;

  const roleLabels: Record<string, string> = {
    admin: "Admin",
    planner: "Planlægger",
    employee: "Medarbejder",
  };

  const roleBadgeColors: Record<string, string> = {
    admin: "bg-red-500 text-white",
    planner: "bg-blue-500 text-white",
    employee: "bg-green-500 text-white",
  };

  const teamColors: Record<string, string> = {
    Eesy: "bg-emerald-500 text-white",
    YouSee: "bg-cyan-600 text-white",
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Medarbejdere</h1>
            <p className="text-muted-foreground">Administrer medarbejdere og deres roller</p>
          </div>
          <div className="flex items-center gap-4">
            <Input
              placeholder="Søg medarbejder..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-[200px]"
            />
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Alle teams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle teams</SelectItem>
                <SelectItem value="Eesy">Eesy</SelectItem>
                <SelectItem value="YouSee">YouSee</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-5 w-5" />
              <span>{activeEmployees.length} medarbejdere</span>
            </div>
          </div>
        </div>

        {/* Week availability section */}
        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Tilgængelighed for uge</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigateWeek("prev")}>
                    <ChevronLeft className="h-4 w-4 mr-1" /> Forrige uge
                  </Button>
                  <div className="flex items-center gap-2 px-4 py-2 bg-background rounded-md border">
                    <Calendar className="h-4 w-4" />
                    <span className="font-medium">Uge {weekNumber}, {year}</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigateWeek("next")}>
                    Næste uge <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-green-200 bg-green-50">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="text-2xl font-bold text-green-600">{availableCount}</span>
                  <span className="text-sm text-green-600">Til rådighed</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 bg-red-50">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <span className="text-2xl font-bold text-red-600">{unavailableCount}</span>
                  <span className="text-sm text-red-600">Ikke til rådighed</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sort headers */}
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <button className="flex items-center gap-1 hover:text-foreground">
            Navn <span className="text-xs">↑</span>
          </button>
          <button className="flex items-center gap-1 hover:text-foreground">
            Team <span className="text-xs">↑↓</span>
          </button>
          <button className="flex items-center gap-1 hover:text-foreground">
            Rolle <span className="text-xs">↑↓</span>
          </button>
        </div>

        {/* Employee cards */}
        {isLoading ? (
          <p>Indlæser...</p>
        ) : (
          <div className="space-y-3">
            {filteredEmployees?.map((emp) => {
              const absentDays = getEmployeeAbsenceDays(emp.id);
              const isAvailable = absentDays.length < 5;

              return (
                <Card key={emp.id} className={cn(
                  "border-l-4 transition-all hover:shadow-md",
                  emp.team === "YouSee" ? "border-l-cyan-500" : 
                  emp.team === "Eesy" ? "border-l-emerald-500" : "border-l-gray-300"
                )}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-semibold text-lg">{emp.full_name}</span>
                          {emp.team && (
                            <Badge className={teamColors[emp.team] || "bg-gray-500 text-white"}>
                              {emp.team}
                            </Badge>
                          )}
                          <Badge className={roleBadgeColors[emp.role] || "bg-gray-500 text-white"}>
                            {roleLabels[emp.role] || emp.role}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4">
                          {/* Day circles - clickable */}
                          <div className="flex items-center gap-1">
                            {DAY_LABELS.map((label, idx) => {
                              const isAbsent = absentDays.includes(idx);
                              const absence = getAbsenceForDay(emp.id, idx);
                              return (
                                <button
                                  key={idx}
                                  onClick={() => toggleDayAbsenceMutation.mutate({
                                    employeeId: emp.id,
                                    dayIndex: idx,
                                    isAbsent,
                                    absenceId: absence?.id,
                                  })}
                                  disabled={toggleDayAbsenceMutation.isPending}
                                  className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all cursor-pointer hover:scale-110 hover:shadow-md",
                                    isAbsent
                                      ? "bg-red-100 text-red-600 hover:bg-red-200"
                                      : "bg-green-500 text-white hover:bg-green-600"
                                  )}
                                  title={isAbsent ? "Klik for at fjerne fravær" : "Klik for at tilføje fravær"}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                          <button
                            onClick={() => {
                              setShowAbsenceDialog(emp);
                              setAbsenceWeekDate(referenceDate);
                              setAbsenceForm({
                                selectedDays: [],
                                reason: "Ferie",
                                note: "",
                              });
                            }}
                            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                          >
                            <Plus className="h-4 w-4" /> Tilføj fravær
                          </button>
                        </div>
                        {emp.email && !emp.email.includes("@placeholder.local") && (
                          <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                            <Mail className="h-4 w-4" />
                            {emp.email}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          {isAvailable ? (
                            <>
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                              <span className="text-green-600 font-medium">Til rådighed</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="h-5 w-5 text-red-500" />
                              <span className="text-red-600 font-medium">Ikke til rådighed</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {emp.role === "admin" && (
                            <Button variant="outline" size="sm">
                              <Key className="h-4 w-4 mr-1" /> Skift adgangskode
                            </Button>
                          )}
                          {emp.role !== "admin" && (
                            <Button variant="outline" size="sm">
                              <UserPlus className="h-4 w-4 mr-1" /> Inviter
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => openEditDialog(emp)}>
                            <Edit className="h-4 w-4 mr-1" /> Rediger
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setShowDeleteDialog(emp.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
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

      {/* Add absence dialog */}
      <Dialog open={!!showAbsenceDialog} onOpenChange={() => setShowAbsenceDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tilføj fravær</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Employee name and week */}
            <div>
              <p className="font-semibold">{showAbsenceDialog?.full_name}</p>
              <p className="text-sm text-muted-foreground">
                Uge {getWeek(absenceWeekDate, { weekStartsOn: 1 })}, {getYear(absenceWeekDate)}
              </p>
            </div>

            {/* Day selector */}
            <div>
              <Label className="text-sm font-medium">Vælg dage</Label>
              <div className="mt-3">
                {/* Week navigation */}
                <div className="flex items-center justify-between mb-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setAbsenceWeekDate(addWeeks(absenceWeekDate, -1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium">
                    Uge {getWeek(absenceWeekDate, { weekStartsOn: 1 })}, {getYear(absenceWeekDate)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setAbsenceWeekDate(addWeeks(absenceWeekDate, 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                {/* Day circles */}
                <div className="flex justify-center gap-2">
                  {(() => {
                    const dialogWeekStart = startOfWeek(absenceWeekDate, { weekStartsOn: 1 });
                    const selectedDays = absenceForm.selectedDays || [];
                    return DAY_LABELS.map((label, idx) => {
                      const date = addDays(dialogWeekStart, idx);
                      const isSelected = selectedDays.includes(idx);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setAbsenceForm({
                                ...absenceForm,
                                selectedDays: selectedDays.filter(d => d !== idx),
                              });
                            } else {
                              setAbsenceForm({
                                ...absenceForm,
                                selectedDays: [...selectedDays, idx].sort(),
                              });
                            }
                          }}
                          className={cn(
                            "flex flex-col items-center transition-all",
                          )}
                        >
                          <div
                            className={cn(
                              "w-12 h-12 rounded-xl flex items-center justify-center text-lg font-semibold transition-all",
                              isSelected
                                ? "bg-emerald-600 text-white"
                                : "bg-muted hover:bg-muted/80 text-foreground"
                            )}
                          >
                            {label}
                          </div>
                          <span className="text-xs text-muted-foreground mt-1">
                            {format(date, "d/M")}
                          </span>
                        </button>
                      );
                    });
                  })()}
                </div>

                {/* Selected days summary */}
                {(absenceForm.selectedDays || []).length > 0 && (
                  <p className="text-sm text-center text-muted-foreground mt-3">
                    Valgte dage: {(absenceForm.selectedDays || []).map(idx => {
                      const dayNames = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];
                      return dayNames[idx];
                    }).join(", ")}
                  </p>
                )}
              </div>
            </div>

            {/* Type */}
            <div>
              <Label>Type</Label>
              <Select value={absenceForm.reason} onValueChange={(v: any) => setAbsenceForm({ ...absenceForm, reason: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ferie">Ferie</SelectItem>
                  <SelectItem value="Syg">Syg</SelectItem>
                  <SelectItem value="Barn syg">Barn syg</SelectItem>
                  <SelectItem value="Andet">Andet</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Note */}
            <div>
              <Label>Bemærkning (valgfri)</Label>
              <textarea
                value={absenceForm.note}
                onChange={(e) => setAbsenceForm({ ...absenceForm, note: e.target.value })}
                placeholder="Tilføj evt. en note..."
                className="mt-1 w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAbsenceDialog(null)}>Annuller</Button>
            <Button
              onClick={() => {
                const dialogWeekStart = startOfWeek(absenceWeekDate, { weekStartsOn: 1 });
                addAbsenceMutation.mutate({
                  employee_id: showAbsenceDialog?.id,
                  selectedDays: absenceForm.selectedDays || [],
                  reason: absenceForm.reason,
                  note: absenceForm.note,
                  weekStart: dialogWeekStart,
                });
              }}
              disabled={(absenceForm.selectedDays || []).length === 0 || addAbsenceMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Opret fravær
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
