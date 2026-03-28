import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Bell, Send, Trash2, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function ComplianceNotifications() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [isSending, setIsSending] = useState(false);

  const handleSendNow = async () => {
    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-compliance-reviews");
      if (error) throw error;
      if (data?.message === "No recipients") {
        toast.info("Ingen modtagere konfigureret");
      } else if (data?.message === "No active recipients") {
        toast.info("Ingen aktive modtagere fundet");
      } else if (data?.message === "No alerts") {
        toast.info("Ingen compliance-advarsler at sende");
      } else {
        toast.success(`Email sendt til ${data?.recipients ?? 0} modtager(e) med ${data?.alerts ?? 0} advarsel(er)`);
      }
    } catch (err) {
      console.error("Send compliance email error:", err);
      toast.error("Kunne ikke sende compliance-email");
    } finally {
      setIsSending(false);
    }
  };

  // Fetch current recipients with employee info
  const { data: recipients = [], isLoading: loadingRecipients } = useQuery({
    queryKey: ["compliance-notification-recipients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compliance_notification_recipients")
        .select("id, employee_id, created_at");
      if (error) throw error;

      // Fetch employee details
      if (!data?.length) return [];
      const employeeIds = data.map((r) => r.employee_id);
      const { data: employees } = await supabase
        .from("agents")
        .select("id, name, email")
        .in("id", employeeIds);

      return data.map((r) => ({
        ...r,
        employee: employees?.find((e) => e.id === r.employee_id),
      }));
    },
  });

  // Fetch available employees (active, not already recipients)
  const { data: availableEmployees = [] } = useQuery({
    queryKey: ["compliance-available-employees", recipients],
    queryFn: async () => {
      const existingIds = recipients.map((r) => r.employee_id);
      const { data, error } = await supabase
        .from("agents")
        .select("id, name, email")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []).filter((e) => !existingIds.includes(e.id));
    },
  });

  const addMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      const { error } = await supabase
        .from("compliance_notification_recipients")
        .insert({ employee_id: employeeId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compliance-notification-recipients"] });
      setSelectedEmployeeId("");
      toast.success("Modtager tilføjet");
    },
    onError: () => toast.error("Kunne ikke tilføje modtager"),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("compliance_notification_recipients")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compliance-notification-recipients"] });
      toast.success("Modtager fjernet");
    },
    onError: () => toast.error("Kunne ikke fjerne modtager"),
  });

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto space-y-6 p-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/compliance")}
          className="gap-2 text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Tilbage til oversigt
        </Button>

        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Bell className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">
              Notifikationsmodtagere
            </h1>
            <Badge
              variant="outline"
              className="bg-red-500/10 text-red-700 border-red-500/30"
            >
              Admin
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Administrer hvem der modtager compliance-relaterede notifikationer,
            fx GDPR-påmindelser og deadlines. Emails sendes automatisk hver mandag kl. 08:00.
          </p>
          <Button
            onClick={handleSendNow}
            disabled={isSending}
            variant="outline"
            className="gap-2 mt-2"
          >
            <Send className="h-4 w-4" />
            {isSending ? "Sender..." : "Send compliance-email nu"}
          </Button>
        </div>

        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="text-sm font-medium text-foreground mb-1 block">
                  Tilføj modtager
                </label>
                <Select
                  value={selectedEmployeeId}
                  onValueChange={setSelectedEmployeeId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Vælg medarbejder..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableEmployees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name} ({emp.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() =>
                  selectedEmployeeId && addMutation.mutate(selectedEmployeeId)
                }
                disabled={!selectedEmployeeId || addMutation.isPending}
                className="gap-2"
              >
                <UserPlus className="h-4 w-4" /> Tilføj
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {loadingRecipients ? (
              <p className="p-4 text-sm text-muted-foreground">Indlæser...</p>
            ) : recipients.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground italic">
                Ingen modtagere tilføjet endnu.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Navn</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipients.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {r.employee?.name ?? "Ukendt"}
                      </TableCell>
                      <TableCell>{r.employee?.email ?? "-"}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeMutation.mutate(r.id)}
                          disabled={removeMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
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
