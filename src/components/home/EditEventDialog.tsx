import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface EditEventDialogProps {
  event: {
    id: string;
    title: string;
    event_date: string;
    event_time: string | null;
    location: string | null;
    description: string | null;
    show_popup: boolean;
    requires_registration: boolean;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditEventDialog({ event, open, onOpenChange }: EditEventDialogProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: "",
    event_date: "",
    event_time: "",
    location: "",
    description: "",
    show_popup: false,
    requires_registration: false,
    invited_teams: [] as string[],
  });

  // Fetch teams
  const { data: teams = [] } = useQuery({
    queryKey: ["teams-for-event-edit"],
    queryFn: async () => {
      const { data } = await supabase.from("teams").select("id, name").order("name");
      return data || [];
    },
    enabled: open,
  });

  // Fetch current team invitations for event
  const { data: currentInvitations = [] } = useQuery({
    queryKey: ["event-team-invitations", event?.id],
    queryFn: async () => {
      if (!event?.id) return [];
      const { data } = await supabase
        .from("event_team_invitations")
        .select("team_id")
        .eq("event_id", event.id);
      return (data || []).map(d => d.team_id);
    },
    enabled: !!event?.id && open,
  });

  useEffect(() => {
    if (event && open) {
      setForm({
        title: event.title,
        event_date: event.event_date,
        event_time: event.event_time || "",
        location: event.location || "",
        description: event.description || "",
        show_popup: event.show_popup,
        requires_registration: event.requires_registration ?? false,
        invited_teams: currentInvitations,
      });
    }
  }, [event, open, currentInvitations]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!event) return;
      const { error } = await supabase
        .from("company_events")
        .update({
          title: form.title,
          event_date: form.event_date,
          event_time: form.event_time || null,
          location: form.location || null,
          description: form.description || null,
          show_popup: form.show_popup,
          requires_registration: form.requires_registration,
        })
        .eq("id", event.id);
      if (error) throw error;

      // Update team invitations: delete old, insert new
      const { error: delError } = await supabase
        .from("event_team_invitations")
        .delete()
        .eq("event_id", event.id);
      if (delError) throw delError;

      if (form.invited_teams.length > 0) {
        const { error: insError } = await supabase
          .from("event_team_invitations")
          .insert(form.invited_teams.map(teamId => ({
            event_id: event.id,
            team_id: teamId,
          })));
        if (insError) throw insError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["home-company-events"] });
      queryClient.invalidateQueries({ queryKey: ["event-team-invitations"] });
      onOpenChange(false);
      toast.success("Begivenhed opdateret");
    },
    onError: () => {
      toast.error("Kunne ikke opdatere begivenhed");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rediger begivenhed</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4 max-h-[70vh] overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="edit-title">Titel *</Label>
            <Input
              id="edit-title"
              value={form.title}
              onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-description">Beskrivelse</Label>
            <Textarea
              id="edit-description"
              value={form.description}
              onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-date">Dato *</Label>
              <Input
                id="edit-date"
                type="date"
                value={form.event_date}
                onChange={(e) => setForm(prev => ({ ...prev, event_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-time">Tidspunkt</Label>
              <Input
                id="edit-time"
                type="time"
                value={form.event_time}
                onChange={(e) => setForm(prev => ({ ...prev, event_time: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-location">Sted</Label>
            <Input
              id="edit-location"
              value={form.location}
              onChange={(e) => setForm(prev => ({ ...prev, location: e.target.value }))}
            />
          </div>

          {teams.length > 0 && (
            <div className="space-y-2">
              <Label>Inviter teams</Label>
              <div className="flex flex-wrap gap-3">
                {teams.map((team) => (
                  <label key={team.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={form.invited_teams.includes(team.id)}
                      onCheckedChange={(checked) => {
                        setForm(prev => ({
                          ...prev,
                          invited_teams: checked
                            ? [...prev.invited_teams, team.id]
                            : prev.invited_teams.filter(id => id !== team.id),
                        }));
                      }}
                    />
                    <span className="text-sm">{team.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between py-2">
            <Label htmlFor="edit-requires-registration" className="cursor-pointer">
              Kræver tilmelding
            </Label>
            <Switch
              id="edit-requires-registration"
              checked={form.requires_registration}
              onCheckedChange={(checked) => setForm(prev => ({ ...prev, requires_registration: checked }))}
            />
          </div>

          <div className="flex items-center justify-between py-2">
            <Label htmlFor="edit-show-popup" className="cursor-pointer">
              Vis popup-invitation ved login
            </Label>
            <Switch
              id="edit-show-popup"
              checked={form.show_popup}
              onCheckedChange={(checked) => setForm(prev => ({ ...prev, show_popup: checked }))}
            />
          </div>

          <Button
            className="w-full"
            onClick={() => updateMutation.mutate()}
            disabled={!form.title || !form.event_date || updateMutation.isPending}
          >
            {updateMutation.isPending ? "Gemmer..." : "Gem ændringer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
