import { useState, useEffect } from "react";
import { useCreateConversation, useActiveChatColleagues, useTeamsForChat, useTeamMembers, normaliserDeltagere, validerSamtale, serverTekst, OpretFejl, OPRETTET_IKKE_HENTET_TEKST } from "@/hooks/useChat";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BottomSheet, useIsPhone } from "@/components/mobile";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Search, Users, User } from "lucide-react";
import { toast } from "sonner";

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (conversationId: string) => void;
}

export function NewConversationDialog({
  open,
  onOpenChange,
  onCreated,
}: NewConversationDialogProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"employees" | "teams">("employees");
  
  const { data: alleAktive, isLoading: employeesLoading, isError: employeesError, refetch: refetchEmployees } = useActiveChatColleagues(open);
  const { data: mig } = useQuery({
    queryKey: ["chat-mig"],
    enabled: open,
    staleTime: 600000,
    queryFn: async () => { const { data } = await supabase.rpc("get_current_employee_id"); return typeof data === "string" ? data : null; },
  });
  // Egen og inaktive profiler kan ikke vælges.
  const employees = alleAktive?.filter((e) => e.id !== mig);
  const aktiveIds = new Set((employees ?? []).map((e) => e.id));
  const { data: teams, isLoading: teamsLoading } = useTeamsForChat();
  const { data: teamMembers } = useTeamMembers(selectedTeamId);
  const createConversation = useCreateConversation();

  // When a team is selected, auto-select all team members
  useEffect(() => {
    if (selectedTeamId && teamMembers && teamMembers.length > 0) {
      setSelectedIds(normaliserDeltagere(teamMembers, mig, aktiveIds));
      // Auto-set group name to team name
      const team = teams?.find((t: any) => t.id === selectedTeamId);
      if (team && !groupName) {
        setGroupName(team.name);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeamId, teamMembers, teams, mig, alleAktive]);

  const deltagere = normaliserDeltagere(selectedIds, mig, aktiveIds);
  const isGroup = deltagere.length > 1;
  
  const filteredEmployees = employees?.filter((emp) =>
    emp.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredTeams = teams?.filter((team: any) =>
    team.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggleEmployee = (id: string) => {
    setSelectedTeamId(null); // Clear team selection when manually selecting employees
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectTeam = (teamId: string) => {
    if (selectedTeamId === teamId) {
      setSelectedTeamId(null);
      setSelectedIds([]);
      setGroupName("");
    } else {
      setSelectedTeamId(teamId);
    }
  };

  const handleCreate = async () => {
    // B2d-1 §8: kendt id → kun genhentning; ellers validering og én oprettelse (synkron lås i hooken).
    if (!createConversation.kendtId) {
      const v = validerSamtale(deltagere.length, groupName, isGroup);
      if ("fejl" in v) { toast.error(v.fejl); return; }
    }
    const kald = createConversation.opret({
      name: isGroup ? groupName.trim() : undefined,
      memberIds: deltagere,
      isGroup,
    });
    if (!kald) return;
    try {
      const conversation = await kald;
      toast.success("Samtale oprettet");
      onCreated(conversation.id);
      setSelectedIds([]);
      setSelectedTeamId(null);
      setGroupName("");
      setSearch("");
    } catch (error) {
      // Valg og navn bevares ved fejl.
      if (error instanceof OpretFejl && error.art === "hent") return; // vises via kendt id
      toast.error(serverTekst(error, "Kunne ikke oprette samtale"));
    }
  };
  const visHentFejl = !!createConversation.kendtId;
  const isPhone = useIsPhone();
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setSelectedIds([]);
      setSelectedTeamId(null);
      setGroupName("");
      setSearch("");
      setActiveTab("employees");
    }
    onOpenChange(isOpen);
  };

  const body = (
        <div className="space-y-4">
          {isGroup && (
            <div>
              <Label htmlFor="groupName">Gruppenavn</Label>
              <Input
                id="groupName"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Angiv gruppenavn..."
                maxLength={80}
              />
            </div>
          )}

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "employees" | "teams")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="employees" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Medarbejdere
              </TabsTrigger>
              <TabsTrigger value="teams" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Teams
              </TabsTrigger>
            </TabsList>

            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={activeTab === "employees" ? "Søg efter medarbejdere..." : "Søg efter teams..."}
                className="pl-9 max-md:min-h-11"
              />
            </div>

            <TabsContent value="employees" className="mt-2">
              <ScrollArea className="h-[300px] max-md:h-[40dvh] border rounded-md">
                {employeesError ? (
                  <div className="flex flex-col items-center justify-center gap-2 h-full p-4 text-center">
                    <p className="text-sm text-muted-foreground">Kunne ikke hente kolleger</p>
                    <Button size="sm" variant="outline" className="min-h-11" onClick={() => void refetchEmployees()}>Prøv igen</Button>
                  </div>
                ) : employeesLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {filteredEmployees?.map((employee) => (
                      <label
                        key={employee.id}
                        className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer max-md:min-h-11 max-md:text-[16px] active:bg-accent"
                      >
                        <Checkbox
                          checked={selectedIds.includes(employee.id)}
                          onCheckedChange={() => toggleEmployee(employee.id)}
                        />
                        <span>{employee.full_name}</span>
                      </label>
                    ))}
                    {filteredEmployees?.length === 0 && (
                      <div className="text-center text-muted-foreground py-4">
                        Ingen medarbejdere fundet
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="teams" className="mt-2">
              <ScrollArea className="h-[300px] max-md:h-[40dvh] border rounded-md">
                {teamsLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {filteredTeams?.map((team: any) => (
                      <button
                        key={team.id}
                        onClick={() => selectTeam(team.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-md text-left transition-colors ${
                          selectedTeamId === team.id 
                            ? "bg-primary text-primary-foreground" 
                            : "hover:bg-accent"
                        }`}
                      >
                        <Users className="h-5 w-5" />
                        <span className="font-medium">{team.name}</span>
                      </button>
                    ))}
                    {filteredTeams?.length === 0 && (
                      <div className="text-center text-muted-foreground py-4">
                        Ingen teams fundet
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>

          {visHentFejl && (
            <p role="alert" className="text-sm text-destructive">{OPRETTET_IKKE_HENTET_TEKST}</p>
          )}
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              {selectedTeamId ? `Team valgt (${deltagere.length} medlemmer)` : `${deltagere.length} valgt`}
            </span>
            <Button
              className="max-md:min-h-11"
              onClick={handleCreate}
              disabled={(deltagere.length === 0 && !createConversation.kendtId) || createConversation.isPending}
            >
              {createConversation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {createConversation.kendtId ? "Prøv igen" : "Opret samtale"}
            </Button>
          </div>
        </div>
  );

  if (isPhone) {
    return (
      <BottomSheet open={open} onOpenChange={handleOpenChange} title="Ny samtale">
        <div className="px-2">{body}</div>
      </BottomSheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ny samtale</DialogTitle>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}
