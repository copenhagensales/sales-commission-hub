/**
 * "Tilføj begivenhed"-formularen. Flyttet uændret fra forsiden, så Pulsen åbner præcis samme formular.
 */
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAddCompanyEvent, EMPTY_NEW_EVENT, type NewCompanyEvent } from "@/hooks/useCompanyEvents";

function useTeamsList() {
  return useQuery({
    queryKey: ["teams-list"],
    queryFn: async () => {
      const { data } = await supabase.from("teams").select("id, name").order("name");
      return data || [];
    },
    staleTime: 300000,
  });
}

interface AddEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: ReactNode;
}

export function AddEventDialog({ open, onOpenChange, trigger }: AddEventDialogProps) {
  const { user } = useAuth();
  const { data: teams = [] } = useTeamsList();
  const [newEvent, setNewEvent] = useState<NewCompanyEvent>({ ...EMPTY_NEW_EVENT, invited_teams: [] });
  const addEventMutation = useAddCompanyEvent(user?.id, () => {
    onOpenChange(false);
    setNewEvent({ ...EMPTY_NEW_EVENT, invited_teams: [] });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tilføj begivenhed</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4 max-h-[70vh] overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="title">Titel *</Label>
            <Input
              id="title"
              value={newEvent.title}
              onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Fx Fredagsbar"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Beskrivelse</Label>
            <Textarea
              id="description"
              value={newEvent.description}
              onChange={(e) => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
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
                onChange={(e) => setNewEvent(prev => ({ ...prev, event_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Tidspunkt</Label>
              <Input
                id="time"
                type="time"
                value={newEvent.event_time}
                onChange={(e) => setNewEvent(prev => ({ ...prev, event_time: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Sted</Label>
            <Input
              id="location"
              value={newEvent.location}
              onChange={(e) => setNewEvent(prev => ({ ...prev, location: e.target.value }))}
              placeholder="Fx Kontoret"
            />
          </div>

          {teams.length > 0 && (
            <div className="space-y-2">
              <Label>Inviter teams</Label>
              <div className="flex flex-wrap gap-3">
                {teams.map((team) => (
                  <label key={team.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={newEvent.invited_teams.includes(team.id)}
                      onCheckedChange={(checked) => {
                        setNewEvent(prev => ({
                          ...prev,
                          invited_teams: checked
                            ? [...prev.invited_teams, team.id]
                            : prev.invited_teams.filter(id => id !== team.id)
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
              onCheckedChange={(checked) => setNewEvent(prev => ({ ...prev, requires_registration: checked }))}
            />
          </div>

          <div className="flex items-center justify-between py-2">
            <Label htmlFor="show-popup" className="cursor-pointer">
              Vis popup-invitation ved login
            </Label>
            <Switch
              id="show-popup"
              checked={newEvent.show_popup}
              onCheckedChange={(checked) => setNewEvent(prev => ({ ...prev, show_popup: checked }))}
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
