import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface EditBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: any;
}

export function EditBookingDialog({ open, onOpenChange, booking }: EditBookingDialogProps) {
  const queryClient = useQueryClient();
  const [clientId, setClientId] = useState<string>("");
  const [campaignId, setCampaignId] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    if (booking) {
      setClientId(booking.client_id || "");
      setCampaignId(booking.campaign_id || "");
      setStatus(booking.status || "Bekræftet");
    }
  }, [booking]);

  // Fetch fieldmarketing clients
  const { data: clients } = useQuery({
    queryKey: ["fieldmarketing-clients-for-edit"],
    queryFn: async () => {
      const { data: team } = await supabase
        .from("teams")
        .select("id")
        .ilike("name", "%fieldmarketing%")
        .single();

      if (!team) return [];

      const { data: teamClients } = await supabase
        .from("team_clients")
        .select("client_id, clients(id, name)")
        .eq("team_id", team.id);

      return teamClients?.map((tc: any) => tc.clients).filter(Boolean) || [];
    },
    enabled: open,
  });

  // Fetch campaigns based on selected client
  const { data: campaigns } = useQuery({
    queryKey: ["campaigns-for-edit", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data } = await supabase
        .from("client_campaigns")
        .select("id, name")
        .eq("client_id", clientId)
        .order("name");
      return data || [];
    },
    enabled: open && !!clientId,
  });

  const updateBookingMutation = useMutation({
    mutationFn: async (updates: {
      client_id: string | null;
      campaign_id: string | null;
      status: "Planlagt" | "Bekræftet" | "Afsluttet" | "Aflyst";
    }) => {
      const { error } = await supabase
        .from("booking")
        .update(updates)
        .eq("id", booking.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vagt-bookings-list"] });
      toast.success("Booking opdateret");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error("Fejl ved opdatering: " + error.message);
    },
  });

  const handleSave = () => {
    updateBookingMutation.mutate({
      client_id: clientId || null,
      campaign_id: campaignId || null,
      status: status as "Planlagt" | "Bekræftet" | "Afsluttet" | "Aflyst",
    });
  };

  if (!booking) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Rediger booking</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Lokation</Label>
            <p className="text-sm text-muted-foreground">{booking.location?.name}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="client">Kunde</Label>
            <Select value={clientId} onValueChange={(v) => {
              setClientId(v);
              setCampaignId(""); // Reset campaign when client changes
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Vælg kunde" />
              </SelectTrigger>
              <SelectContent>
                {clients?.map((client: any) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="campaign">Kampagne</Label>
            <Select value={campaignId || "none"} onValueChange={(v) => setCampaignId(v === "none" ? "" : v)} disabled={!clientId}>
              <SelectTrigger>
                <SelectValue placeholder={clientId ? "Vælg kampagne" : "Vælg først kunde"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ingen kampagne</SelectItem>
                {campaigns?.map((campaign: any) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Planlagt">Planlagt</SelectItem>
                <SelectItem value="Bekræftet">Bekræftet</SelectItem>
                <SelectItem value="Afsluttet">Afsluttet</SelectItem>
                <SelectItem value="Aflyst">Aflyst</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuller
          </Button>
          <Button onClick={handleSave} disabled={updateBookingMutation.isPending}>
            {updateBookingMutation.isPending ? "Gemmer..." : "Gem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}