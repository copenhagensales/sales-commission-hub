import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, X, Pencil, Download, Clock, Users } from "lucide-react";
import { useTeamExtraWork, useUpdateExtraWork, ExtraWorkWithEmployee } from "@/hooks/useExtraWork";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, subDays } from "date-fns";
import { da } from "date-fns/locale";
import { usePermissions } from "@/hooks/usePositionPermissions";
import { useAuth } from "@/hooks/useAuth";

const STATUS_CONFIG = {
  pending: { label: "Afventer", variant: "secondary" as const },
  approved: { label: "Godkendt", variant: "default" as const },
  rejected: { label: "Afvist", variant: "destructive" as const },
};

export default function ExtraWorkAdmin() {
  const { scopeExtraWork, canViewExtraWorkAdmin } = usePermissions();
  const { user } = useAuth();
  
  // Filters
  const [employeeId, setEmployeeId] = useState<string>("");
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [statusFilter, setStatusFilter] = useState<string>("");

  // Edit dialog
  const [editEntry, setEditEntry] = useState<ExtraWorkWithEmployee | null>(null);
  const [editFromTime, setEditFromTime] = useState("");
  const [editToTime, setEditToTime] = useState("");
  const [editReason, setEditReason] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const updateMutation = useUpdateExtraWork();

  // Get team employees for filter
  const { data: teamEmployees } = useQuery({
    queryKey: ["team-employees-for-filter", user?.email],
    queryFn: async () => {
      if (!user?.email) return [];

      // Get current user's employee id
      const lowerEmail = user.email.toLowerCase();
      const { data: currentEmployee } = await supabase
        .from("employee_master_data")
        .select("id")
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .maybeSingle();

      let query = supabase
        .from("employee_master_data")
        .select("id, first_name, last_name")
        .eq("is_active", true)
        .order("first_name");

      // If scope is not "alt", filter to only their team
      if (currentEmployee && scopeExtraWork !== "alt") {
        query = query.eq("manager_id", currentEmployee.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user?.email && canViewExtraWorkAdmin,
  });

  // Get extra work entries
  const { data: extraWork, isLoading } = useTeamExtraWork({
    employeeId: employeeId || undefined,
    startDate,
    endDate,
    status: statusFilter || undefined,
  });

  const handleApprove = async (entry: ExtraWorkWithEmployee) => {
    await updateMutation.mutateAsync({
      id: entry.id,
      updates: { status: "approved" },
    });
  };

  const handleReject = async () => {
    if (!editEntry) return;
    await updateMutation.mutateAsync({
      id: editEntry.id,
      updates: { 
        status: "rejected",
        rejection_reason: rejectReason,
      },
    });
    setEditEntry(null);
    setRejectReason("");
  };

  const handleSaveEdit = async () => {
    if (!editEntry) return;
    await updateMutation.mutateAsync({
      id: editEntry.id,
      updates: {
        from_time: editFromTime,
        to_time: editToTime,
        reason: editReason,
        status: "approved",
      },
    });
    setEditEntry(null);
  };

  const openEditDialog = (entry: ExtraWorkWithEmployee) => {
    setEditEntry(entry);
    setEditFromTime(entry.from_time.slice(0, 5));
    setEditToTime(entry.to_time.slice(0, 5));
    setEditReason(entry.reason || "");
    setRejectReason("");
  };

  // Export to CSV
  const handleExport = () => {
    if (!extraWork || extraWork.length === 0) return;

    const headers = ["Medarbejder", "Dato", "Fra", "Til", "Timer", "Årsag", "Status"];
    const rows = extraWork.map((e) => [
      e.employee ? `${e.employee.first_name} ${e.employee.last_name}` : "Ukendt",
      format(parseISO(e.date), "yyyy-MM-dd"),
      e.from_time.slice(0, 5),
      e.to_time.slice(0, 5),
      Number(e.hours).toFixed(2),
      e.reason || "",
      STATUS_CONFIG[e.status].label,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `ekstra-arbejde-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  // Calculate summary stats
  const stats = {
    total: extraWork?.length || 0,
    pending: extraWork?.filter((e) => e.status === "pending").length || 0,
    approved: extraWork?.filter((e) => e.status === "approved").length || 0,
    rejected: extraWork?.filter((e) => e.status === "rejected").length || 0,
    totalApprovedHours: extraWork
      ?.filter((e) => e.status === "approved")
      .reduce((sum, e) => sum + Number(e.hours), 0) || 0,
  };

  if (!canViewExtraWorkAdmin) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Du har ikke adgang til denne side.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Ekstra arbejde - Godkendelse</h1>
            <p className="text-muted-foreground">
              Gennemgå og godkend medarbejderes ekstra arbejdstimer
            </p>
          </div>
          <Button variant="outline" onClick={handleExport} disabled={!extraWork?.length}>
            <Download className="h-4 w-4 mr-2" />
            Eksporter CSV
          </Button>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-muted-foreground">I alt</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
              <div className="text-sm text-muted-foreground">Afventer</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
              <div className="text-sm text-muted-foreground">Godkendt</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-destructive">{stats.rejected}</div>
              <div className="text-sm text-muted-foreground">Afvist</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats.totalApprovedHours.toFixed(1)}</div>
              <div className="text-sm text-muted-foreground">Godkendte timer</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filtre</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Medarbejder</Label>
              <Select value={employeeId || "all"} onValueChange={(v) => setEmployeeId(v === "all" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Alle medarbejdere" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle medarbejdere</SelectItem>
                    {teamEmployees?.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fra dato</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Til dato</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Alle statusser" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle statusser</SelectItem>
                    <SelectItem value="pending">Afventer</SelectItem>
                    <SelectItem value="approved">Godkendt</SelectItem>
                    <SelectItem value="rejected">Afvist</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="animate-pulse text-muted-foreground">Indlæser...</div>
            ) : !extraWork || extraWork.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Ingen ekstra arbejde fundet med de valgte filtre.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medarbejder</TableHead>
                    <TableHead>Dato</TableHead>
                    <TableHead>Tid</TableHead>
                    <TableHead>Timer</TableHead>
                    <TableHead>Årsag</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Handlinger</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {extraWork.map((entry) => {
                    const statusConfig = STATUS_CONFIG[entry.status];
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">
                          {entry.employee
                            ? `${entry.employee.first_name} ${entry.employee.last_name}`
                            : "Ukendt"}
                        </TableCell>
                        <TableCell>
                          {format(parseISO(entry.date), "d. MMM yyyy", { locale: da })}
                        </TableCell>
                        <TableCell>
                          {entry.from_time.slice(0, 5)} - {entry.to_time.slice(0, 5)}
                        </TableCell>
                        <TableCell>{Number(entry.hours).toFixed(1)}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {entry.reason || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {entry.status === "pending" && (
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleApprove(entry)}
                                title="Godkend"
                              >
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(entry)}
                                title="Rediger og godkend"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditEntry(entry);
                                  setRejectReason("");
                                }}
                                title="Afvis"
                              >
                                <X className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Edit/Reject Dialog */}
        <Dialog open={!!editEntry} onOpenChange={(open) => !open && setEditEntry(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editFromTime ? "Rediger og godkend" : "Afvis ekstra arbejde"}
              </DialogTitle>
            </DialogHeader>
            
            {editFromTime ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Fra kl.</Label>
                    <Input
                      type="time"
                      value={editFromTime}
                      onChange={(e) => setEditFromTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Til kl.</Label>
                    <Input
                      type="time"
                      value={editToTime}
                      onChange={(e) => setEditToTime(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Årsag</Label>
                  <Input
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditEntry(null)}>
                    Annuller
                  </Button>
                  <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
                    Gem og godkend
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Årsag til afvisning</Label>
                  <Textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Skriv en begrundelse..."
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditEntry(null)}>
                    Annuller
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={handleReject}
                    disabled={updateMutation.isPending}
                  >
                    Afvis
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
