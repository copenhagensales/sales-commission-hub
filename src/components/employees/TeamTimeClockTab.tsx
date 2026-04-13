import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEmployeeTimeClocks } from "@/hooks/useEmployeeTimeClocks";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Clock, Pencil } from "lucide-react";

interface Props {
  teamId: string | null;
  teamMemberIds: string[];
}

const CLOCK_TYPE_LABELS: Record<string, { label: string; description: string; color: string }> = {
  override: {
    label: "Overskrivende",
    description: "Timer fra stempelur overskriver vagtplan",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  },
  documentation: {
    label: "Dokumentation",
    description: "Kun fremmøde-registrering, vagtplan-timer bruges",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  },
  revenue: {
    label: "Omsætning/time",
    description: "CPO/time beregning med provision pr. time",
    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  },
};

export function TeamTimeClockTab({ teamId, teamMemberIds }: Props) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingClock, setEditingClock] = useState<string | null>(null);
  const [form, setForm] = useState({
    employeeId: "",
    clientId: "",
    clockType: "" as "override" | "documentation" | "revenue" | "",
    hourlyRate: 0,
  });

  const { clocks, isLoading, createClock, updateClock, deleteClock, isCreating } = useEmployeeTimeClocks({
    activeOnly: true,
  });

  // Filter clocks to team members only
  const teamClocks = clocks.filter((c) => teamMemberIds.includes(c.employee_id));

  // Fetch employees for display
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-for-clocks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name")
        .eq("is_active", true)
        .order("first_name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch clients for display
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-clocks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const employeeMap = employees.reduce((acc, e) => {
    acc[e.id] = `${e.first_name} ${e.last_name}`;
    return acc;
  }, {} as Record<string, string>);

  const clientMap = clients.reduce((acc, c) => {
    acc[c.id] = c.name;
    return acc;
  }, {} as Record<string, string>);

  const teamEmployees = employees.filter((e) => teamMemberIds.includes(e.id));

  const resetForm = () => {
    setForm({ employeeId: "", clientId: "", clockType: "", hourlyRate: 0 });
    setEditingClock(null);
  };

  const handleSave = () => {
    if (!form.employeeId || !form.clockType) return;

    if (editingClock) {
      updateClock({
        id: editingClock,
        clockType: form.clockType as "override" | "documentation" | "revenue",
        hourlyRate: form.hourlyRate,
      });
    } else {
      createClock({
        employeeId: form.employeeId,
        clientId: form.clientId || null,
        clockType: form.clockType as "override" | "documentation" | "revenue",
        hourlyRate: form.hourlyRate,
      });
    }
    setAddDialogOpen(false);
    resetForm();
  };

  const openEdit = (clock: typeof teamClocks[0]) => {
    setEditingClock(clock.id);
    setForm({
      employeeId: clock.employee_id,
      clientId: clock.client_id || "",
      clockType: clock.clock_type,
      hourlyRate: clock.hourly_rate,
    });
    setAddDialogOpen(true);
  };

  if (!teamId) {
    return (
      <div className="py-12 text-center">
        <Clock className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-muted-foreground">Gem teamet først for at administrere stempelure</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Administrer stempelure for teamets medarbejdere
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            resetForm();
            setAddDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Tilføj stempelur
        </Button>
      </div>

      {/* Clock type legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(CLOCK_TYPE_LABELS).map(([key, { label, description, color }]) => (
          <div key={key} className="flex items-center gap-2 text-xs">
            <Badge className={`${color} border-0`}>{label}</Badge>
            <span className="text-muted-foreground">{description}</span>
          </div>
        ))}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Indlæser...</p>
      ) : teamClocks.length === 0 ? (
        <div className="py-12 text-center border rounded-lg border-dashed">
          <Clock className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Ingen stempelure oprettet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Tilføj et stempelur for at styre timekilde for medarbejdere
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Medarbejder</TableHead>
                <TableHead className="text-xs">Kunde</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Timesats</TableHead>
                <TableHead className="text-xs w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamClocks.map((clock) => {
                const typeInfo = CLOCK_TYPE_LABELS[clock.clock_type];
                return (
                  <TableRow key={clock.id}>
                    <TableCell className="text-sm font-medium">
                      {employeeMap[clock.employee_id] || clock.employee_id}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {clock.client_id ? (clientMap[clock.client_id] || "–") : "Alle kunder"}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${typeInfo?.color} border-0 text-xs`}>
                        {typeInfo?.label || clock.clock_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {clock.clock_type === "revenue" && clock.hourly_rate > 0
                        ? `${clock.hourly_rate} DKK/time`
                        : "–"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEdit(clock)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => deleteClock(clock.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={addDialogOpen} onOpenChange={(open) => { if (!open) { resetForm(); } setAddDialogOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {editingClock ? "Rediger stempelur" : "Tilføj stempelur"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Employee selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Medarbejder *</Label>
              <Select
                value={form.employeeId}
                onValueChange={(v) => setForm({ ...form, employeeId: v })}
                disabled={!!editingClock}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Vælg medarbejder..." />
                </SelectTrigger>
                <SelectContent>
                  {teamEmployees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Client selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Kunde (valgfri)</Label>
              <Select
                value={form.clientId || "__all__"}
                onValueChange={(v) => setForm({ ...form, clientId: v === "__all__" ? "" : v })}
                disabled={!!editingClock}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Alle kunder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Alle kunder</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Vælg en specifik kunde eller "Alle kunder" for globalt stempelur
              </p>
            </div>

            {/* Clock type */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Stempelur-type *</Label>
              <Select
                value={form.clockType}
                onValueChange={(v) => setForm({ ...form, clockType: v as any })}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Vælg type..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CLOCK_TYPE_LABELS).map(([key, { label, description }]) => (
                    <SelectItem key={key} value={key}>
                      <div>
                        <span className="font-medium">{label}</span>
                        <span className="text-muted-foreground ml-2 text-xs">— {description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Hourly rate (only for revenue) */}
            {form.clockType === "revenue" && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Provision pr. time (DKK)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.hourlyRate || ""}
                  onChange={(e) => setForm({ ...form, hourlyRate: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">
                  Medarbejderen modtager denne provision pr. registreret time
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => { setAddDialogOpen(false); resetForm(); }}>
              Annuller
            </Button>
            <Button
              onClick={handleSave}
              disabled={!form.employeeId || !form.clockType || isCreating}
            >
              {isCreating ? "Gemmer..." : editingClock ? "Gem ændringer" : "Opret stempelur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
