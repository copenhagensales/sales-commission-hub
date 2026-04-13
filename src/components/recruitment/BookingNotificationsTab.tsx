import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Mail, Bell } from "lucide-react";

interface Recipient {
  id: string;
  email: string;
  name: string | null;
  notify_on_booking: boolean;
  notify_on_cancel: boolean;
  created_at: string;
}

export function BookingNotificationsTab() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const { data: recipients = [], isLoading } = useQuery({
    queryKey: ["booking-notification-recipients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_notification_recipients")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Recipient[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("booking_notification_recipients")
        .insert({ email: newEmail.trim(), name: newName.trim() || null });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-notification-recipients"] });
      setNewName("");
      setNewEmail("");
      toast.success("Modtager tilføjet");
    },
    onError: () => toast.error("Kunne ikke tilføje modtager"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("booking_notification_recipients")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-notification-recipients"] });
      toast.success("Modtager fjernet");
    },
    onError: () => toast.error("Kunne ikke fjerne modtager"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: boolean }) => {
      const { error } = await supabase
        .from("booking_notification_recipients")
        .update({ [field]: value })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-notification-recipients"] });
    },
    onError: () => toast.error("Kunne ikke opdatere"),
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    addMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Email-notifikationer
          </CardTitle>
          <CardDescription>
            Tilføj modtagere der skal have besked når en kandidat booker eller afmelder en samtale.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Add form */}
          <form onSubmit={handleAdd} className="flex items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="notif-name">Navn</Label>
              <Input
                id="notif-name"
                placeholder="F.eks. Oscar"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-48"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notif-email">Email *</Label>
              <Input
                id="notif-email"
                type="email"
                required
                placeholder="email@firma.dk"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-64"
              />
            </div>
            <Button type="submit" disabled={addMutation.isPending || !newEmail.trim()} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Tilføj
            </Button>
          </form>

          {/* Recipients list */}
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Indlæser...</p>
          ) : recipients.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ingen modtagere tilføjet endnu.</p>
          ) : (
            <div className="border rounded-lg divide-y">
              {/* Header */}
              <div className="grid grid-cols-[1fr_1fr_120px_120px_48px] gap-4 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
                <span>Navn</span>
                <span>Email</span>
                <span className="text-center">Ny booking</span>
                <span className="text-center">Afmelding</span>
                <span />
              </div>
              {recipients.map((r) => (
                <div key={r.id} className="grid grid-cols-[1fr_1fr_120px_120px_48px] gap-4 px-4 py-3 items-center">
                  <span className="text-sm font-medium truncate">{r.name || "—"}</span>
                  <span className="text-sm text-muted-foreground truncate flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    {r.email}
                  </span>
                  <div className="flex justify-center">
                    <Switch
                      checked={r.notify_on_booking}
                      onCheckedChange={(val) =>
                        toggleMutation.mutate({ id: r.id, field: "notify_on_booking", value: val })
                      }
                    />
                  </div>
                  <div className="flex justify-center">
                    <Switch
                      checked={r.notify_on_cancel}
                      onCheckedChange={(val) =>
                        toggleMutation.mutate({ id: r.id, field: "notify_on_cancel", value: val })
                      }
                    />
                  </div>
                  <div className="flex justify-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(r.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
