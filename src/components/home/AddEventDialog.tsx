import { useState } from "react";
import { Plus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const EMPTY_EVENT = {
  title: "",
  event_date: "",
  event_time: "",
  location: "",
  description: "",
  show_popup: false,
  requires_registration: false,
  invited_teams: [] as string[],
};

export function AddEventDialog() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newEvent, setNewEvent] = useState(EMPTY_EVENT);

  const { data: teams = [] } = useQuery({
    queryKey: ["teams-list"],
    queryFn: async () => {
      const { data } = await supabase.from("teams").select("id, name").order("name");
      return data || [];
    },
    staleTime: 300000,
  });

  const addEventMutation = useMutation({
    mutationFn: async (event: typeof EMPTY_EVENT) => {
      const { data: createdEvent, error } = await supabase
        .from("company_events")
        .insert({
          title: event.title,
          event_date: event.event_date,
          event_time: event.event_time || null,
          location: event.location || null,
          description: event.description || null,
          show_popup: event.show_popup,
          requires_registration: event.requires_registration,
          created_by: user?.id,
        })
        .select()
        .single();
      if (error) throw error;

      if (event.invited_teams.length > 0 && createdEvent) {
        const { error: invError } = await supabase.from("event_team_invitations").insert(
          event.invited_teams.map((teamId) => ({
            event_id: createdEvent.id,
            team_id: teamId,
          }))
        );
        if (invError) throw invError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["home-company-events"] });
      setOpen(false);
      setNewEvent(EMPTY_EVENT);
      toast.success("Begivenhed tilføjet");
    },
    onError: () => {
      toast.error("Kunne ikke tilføje begivenhed");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Tilføj begivenhed">
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tilføj begivenhed</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pt-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titel *</Label>
            <Input
              id="title"
              value={newEvent.title}
              onChange={(e) => setNewEvent((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Fx Fredagsbar"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Beskrivelse</Label>
            <Textarea
              id="description"
              value={newEvent.description}
              onChange={(e) => setNewEvent((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Beskriv begivenheden..."
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Dato *</Label>
              <Input
                id="date"
                type="date"
                value={newEvent.event_date}
                onChange={(e) => setNewEvent((prev) => ({ ...prev, event_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Tidspunkt</Label>
              <Input
                id="time"
                type="time"
                value={newEvent.event_time}
                onChange={(e) => setNewEvent((prev) => ({ ...prev, event_time: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Sted</Label>
            <Input
              id="location"
              value={newEvent.location}
              onChange={(e) => setNewEvent((prev) => ({ ...prev, location: e.target.value }))}
              placeholder="Fx Kontoret"
            />
          </div>

          {teams.length > 0 && (
            <div className="space-y-2">
              <Label>Inviter teams</Label>
              <div className="flex flex-wrap gap-3">
                {teams.map((team) => (
                  <label key={team.id} className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={newEvent.invited_teams.includes(team.id)}
                      onCheckedChange={(checked) => {
                        setNewEvent((prev) => ({
                          ...prev,
                          invited_teams: checked
                            ? [...prev.invited_teams, team.id]
                            : prev.invited_teams.filter((id) => id !== team.id),
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
            <Label htmlFor="requires-registration" className="cursor-pointer">
              Kræver tilmelding
            </Label>
            <Switch
              id="requires-registration"
              checked={newEvent.requires_registration}
              onCheckedChange={(checked) =>
                setNewEvent((prev) => ({ ...prev, requires_registration: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between py-2">
            <Label htmlFor="show-popup" className="cursor-pointer">
              Vis popup-invitation ved login
            </Label>
            <Switch
              id="show-popup"
              checked={newEvent.show_popup}
              onCheckedChange={(checked) =>
                setNewEvent((prev) => ({ ...prev, show_popup: checked }))
              }
            />
          </div>

          <Button
            className="w-full"
            onClick={() => addEventMutation.mutate(newEvent)}
            disabled={!newEvent.title || !newEvent.event_date || addEventMutation.isPending}
          >
            {addEventMutation.isPending ? "Tilføjer..." : "Tilføj begivenhed"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
