import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";

interface CreateCohortDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const clientCampaigns = [
  "TDC Erhverv",
  "Codan",
  "Tryg",
  "Relatel",
  "ASE",
  "Fieldmarketing",
  "Andet",
];

export function CreateCohortDialog({ open, onOpenChange }: CreateCohortDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    name: "",
    start_date: "",
    start_time: "10:00",
    team_id: "",
    client_campaign: "",
    location: "",
    notes: "",
    max_capacity: "",
  });

  // Get current employee ID
  const { data: currentEmployee } = useQuery({
    queryKey: ["current-employee", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const { data } = await supabase
        .from("employee_master_data")
        .select("id")
        .or(`private_email.ilike.${user.email.toLowerCase()},work_email.ilike.${user.email.toLowerCase()}`)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.email,
  });

  // Fetch teams for dropdown
  const { data: teams = [] } = useQuery({
    queryKey: ["teams-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Generate name if empty
      let name = data.name;
      if (!name && data.start_date) {
        const dateStr = format(new Date(data.start_date), "d. MMMM yyyy", { locale: da });
        name = data.client_campaign 
          ? `${data.client_campaign} - ${dateStr}`
          : `Opstart ${dateStr}`;
      }

      const { error } = await supabase.from("onboarding_cohorts").insert({
        name,
        start_date: data.start_date,
        start_time: data.start_time || null,
        team_id: data.team_id || null,
        client_campaign: data.client_campaign || null,
        location: data.location || null,
        notes: data.notes || null,
        max_capacity: data.max_capacity ? parseInt(data.max_capacity) : null,
        created_by: currentEmployee?.id || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Opstartshold oprettet" });
      queryClient.invalidateQueries({ queryKey: ["onboarding-cohorts"] });
      onOpenChange(false);
      setFormData({
        name: "",
        start_date: "",
        start_time: "10:00",
        team_id: "",
        client_campaign: "",
        location: "",
        notes: "",
        max_capacity: "",
      });
    },
    onError: (error) => {
      toast({
        title: "Fejl ved oprettelse",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.start_date) {
      toast({
        title: "Vælg en dato",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Opret opstartshold</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Opstartsdato *</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="start_time">Tidspunkt</Label>
              <Input
                id="start_time"
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Holdnavn (valgfrit)</Label>
            <Input
              id="name"
              placeholder="Genereres automatisk fra dato og kampagne"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client_campaign">Klient/Kampagne</Label>
            <Select
              value={formData.client_campaign}
              onValueChange={(value) => setFormData({ ...formData, client_campaign: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Vælg kampagne..." />
              </SelectTrigger>
              <SelectContent>
                {clientCampaigns.map((campaign) => (
                  <SelectItem key={campaign} value={campaign}>
                    {campaign}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="team_id">Team</Label>
            <Select
              value={formData.team_id}
              onValueChange={(value) => setFormData({ ...formData, team_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Vælg team..." />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Lokation</Label>
            <Input
              id="location"
              placeholder="Fx Kontoret, Amaliegade 28"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="max_capacity">Max kapacitet (valgfrit)</Label>
            <Input
              id="max_capacity"
              type="number"
              min="1"
              placeholder="Ingen grænse"
              value={formData.max_capacity}
              onChange={(e) => setFormData({ ...formData, max_capacity: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Noter</Label>
            <Textarea
              id="notes"
              placeholder="Ekstra info om onboarding..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuller
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Opretter..." : "Opret hold"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
