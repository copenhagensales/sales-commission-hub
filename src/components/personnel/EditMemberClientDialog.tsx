import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface EditMemberClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  memberName: string;
  teamId: string | null;
  currentClientId: string | null;
}

export function EditMemberClientDialog({
  open,
  onOpenChange,
  memberId,
  memberName,
  teamId,
  currentClientId,
}: EditMemberClientDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(currentClientId);

  // Reset when dialog opens with new data
  useEffect(() => {
    if (open) {
      setSelectedClientId(currentClientId);
    }
  }, [open, currentClientId]);

  // Fetch clients for the team
  const { data: teamClients = [], isLoading } = useQuery({
    queryKey: ["team-clients-for-edit", teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_clients")
        .select("client_id, client:clients(id, name)")
        .eq("team_id", teamId!);
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!teamId,
  });

  const availableClients = teamClients.filter(tc => tc.client?.id);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("cohort_members")
        .update({ daily_bonus_client_id: selectedClientId })
        .eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Kunde opdateret" });
      queryClient.invalidateQueries({ queryKey: ["onboarding-cohorts"] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Kunne ikke opdatere",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleClear = () => {
    setSelectedClientId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rediger dagsbonuskunde</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Vælg hvilken kunde <span className="font-medium text-foreground">{memberName}</span> skal bruge til dagsbonusberegning.
          </p>

          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : availableClients.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ingen kunder tilknyttet dette team.
            </p>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="client-select">Kunde (til dagsbonus)</Label>
              <Select
                value={selectedClientId || ""}
                onValueChange={(value) => setSelectedClientId(value || null)}
              >
                <SelectTrigger id="client-select">
                  <SelectValue placeholder="Vælg kunde..." />
                </SelectTrigger>
                <SelectContent>
                  {availableClients.map((tc) => (
                    <SelectItem key={tc.client_id} value={tc.client_id}>
                      {tc.client?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedClientId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="text-muted-foreground"
                >
                  Fjern valg
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                Bruges kun til at beregne dagsbonus
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuller
          </Button>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gemmer...
              </>
            ) : (
              "Gem"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}