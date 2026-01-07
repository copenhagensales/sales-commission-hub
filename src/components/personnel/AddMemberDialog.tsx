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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Search, User } from "lucide-react";

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cohortId: string | null;
}

export function AddMemberDialog({ open, onOpenChange, cohortId }: AddMemberDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Fetch hired candidates not already in a cohort
  const { data: availableCandidates = [], isLoading } = useQuery({
    queryKey: ["available-candidates-for-cohort", cohortId],
    queryFn: async () => {
      // Get all candidates with status "hired"
      const { data: candidates, error } = await supabase
        .from("candidates")
        .select("id, first_name, last_name, applied_position")
        .eq("status", "hired")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get candidates already in this cohort
      const { data: existingMembers } = await supabase
        .from("cohort_members")
        .select("candidate_id")
        .eq("cohort_id", cohortId!);

      const existingCandidateIds = new Set(existingMembers?.map(m => m.candidate_id) || []);

      // Filter out candidates already in the cohort
      return (candidates || []).filter(c => !existingCandidateIds.has(c.id));
    },
    enabled: open && !!cohortId,
  });

  const addMembersMutation = useMutation({
    mutationFn: async (candidateIds: string[]) => {
      const members = candidateIds.map(candidateId => ({
        cohort_id: cohortId!,
        candidate_id: candidateId,
        status: "assigned" as const,
      }));

      const { error } = await supabase.from("cohort_members").insert(members);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Deltagere tilføjet" });
      queryClient.invalidateQueries({ queryKey: ["onboarding-cohorts"] });
      queryClient.invalidateQueries({ queryKey: ["available-candidates-for-cohort"] });
      onOpenChange(false);
      setSelectedIds([]);
      setSearch("");
    },
    onError: (error) => {
      toast({
        title: "Fejl ved tilføjelse",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleToggle = (candidateId: string) => {
    setSelectedIds(prev => 
      prev.includes(candidateId) 
        ? prev.filter(id => id !== candidateId)
        : [...prev, candidateId]
    );
  };

  const handleSubmit = () => {
    if (selectedIds.length === 0) {
      toast({ title: "Vælg mindst én kandidat", variant: "destructive" });
      return;
    }
    addMembersMutation.mutate(selectedIds);
  };

  const filteredCandidates = availableCandidates.filter(c => {
    const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
    return fullName.includes(search.toLowerCase());
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tilføj deltagere til hold</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Søg efter navn..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {isLoading ? (
            <p className="text-center text-muted-foreground py-4">Indlæser...</p>
          ) : filteredCandidates.length === 0 ? (
            <div className="text-center py-8">
              <User className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">
                {search ? "Ingen kandidater matcher søgningen" : "Ingen ansatte kandidater tilgængelige"}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {filteredCandidates.map((candidate) => (
                  <div
                    key={candidate.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleToggle(candidate.id)}
                  >
                    <Checkbox
                      checked={selectedIds.includes(candidate.id)}
                      onCheckedChange={() => handleToggle(candidate.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {candidate.first_name} {candidate.last_name}
                      </p>
                      {candidate.applied_position && (
                        <p className="text-sm text-muted-foreground truncate">
                          {candidate.applied_position}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          <div className="flex justify-between items-center pt-4 border-t">
            <span className="text-sm text-muted-foreground">
              {selectedIds.length} valgt
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Annuller
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={selectedIds.length === 0 || addMembersMutation.isPending}
              >
                {addMembersMutation.isPending ? "Tilføjer..." : "Tilføj valgte"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
