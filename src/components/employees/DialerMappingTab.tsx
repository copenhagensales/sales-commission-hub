import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, X, Loader2, AlertTriangle, Check, UserPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  private_email: string | null;
}

interface Agent {
  id: string;
  name: string;
  email: string;
  external_adversus_id: string | null;
  is_active: boolean | null;
}

interface Mapping {
  id: string;
  employee_id: string;
  agent_id: string;
  created_at: string;
  agents: Agent;
}

export function DialerMappingTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<Record<string, string>>({});
  const [unmappedSelections, setUnmappedSelections] = useState<Record<string, string>>({});

  // Fetch active employees
  const { data: employees = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ["employees-for-mapping"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, private_email")
        .eq("is_active", true)
        .order("first_name");
      if (error) throw error;
      return data as Employee[];
    },
  });

  // Fetch all ACTIVE agents from APIs
  const { data: agents = [], isLoading: loadingAgents } = useQuery({
    queryKey: ["agents-for-mapping"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents")
        .select("id, name, email, external_adversus_id, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Agent[];
    },
  });

  // Fetch existing mappings
  const { data: mappings = [], isLoading: loadingMappings } = useQuery({
    queryKey: ["employee-agent-mappings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_agent_mapping")
        .select(`
          id,
          employee_id,
          agent_id,
          created_at,
          agents (id, name, email, external_adversus_id)
        `);
      if (error) throw error;
      return data as Mapping[];
    },
  });

  // Add mapping mutation
  const addMappingMutation = useMutation({
    mutationFn: async ({ employeeId, agentId }: { employeeId: string; agentId: string }) => {
      const { error } = await supabase
        .from("employee_agent_mapping")
        .insert({ employee_id: employeeId, agent_id: agentId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-agent-mappings"] });
      toast({ title: "Mapping tilføjet", description: "Agent er nu knyttet til medarbejderen." });
    },
    onError: (error: Error) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  // Remove mapping mutation
  const removeMappingMutation = useMutation({
    mutationFn: async (mappingId: string) => {
      const { error } = await supabase
        .from("employee_agent_mapping")
        .delete()
        .eq("id", mappingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-agent-mappings"] });
      toast({ title: "Mapping fjernet", description: "Agent-tilknytning er fjernet." });
    },
    onError: (error: Error) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const handleAddMapping = (employeeId: string) => {
    const agentId = selectedAgents[employeeId];
    if (!agentId) return;
    addMappingMutation.mutate({ employeeId, agentId });
    setSelectedAgents((prev) => ({ ...prev, [employeeId]: "" }));
  };

  const getMappingsForEmployee = (employeeId: string) => {
    return mappings.filter((m) => m.employee_id === employeeId);
  };

  const getAvailableAgents = (employeeId: string) => {
    const existingAgentIds = getMappingsForEmployee(employeeId).map((m) => m.agent_id);
    return agents.filter((a) => !existingAgentIds.includes(a.id));
  };

  // Get unmapped agents (agents without any employee mapping)
  const mappedAgentIds = mappings.map((m) => m.agent_id);
  const unmappedAgents = agents.filter((a) => !mappedAgentIds.includes(a.id));

  // Find suggested employee for each unmapped agent based on email match
  const getSuggestedEmployee = (agentEmail: string) => {
    return employees.find(
      (emp) => emp.private_email?.toLowerCase() === agentEmail.toLowerCase()
    );
  };

  // Memoized unmapped agents with suggestions
  const unmappedAgentsWithSuggestions = useMemo(() => {
    return unmappedAgents.map((agent) => ({
      ...agent,
      suggestedEmployee: getSuggestedEmployee(agent.email),
    }));
  }, [unmappedAgents, employees]);

  // Handle mapping from unmapped section
  const handleMapUnmappedAgent = (agentId: string, employeeId: string) => {
    if (!employeeId) return;
    addMappingMutation.mutate(
      { employeeId, agentId },
      {
        onSuccess: () => {
          setUnmappedSelections((prev) => {
            const newState = { ...prev };
            delete newState[agentId];
            return newState;
          });
        },
      }
    );
  };

  const isLoading = loadingEmployees || loadingAgents || loadingMappings;

  const filteredEmployees = employees.filter((emp) =>
    `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Dialer Mapping</h2>
        <div className="relative w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Søg medarbejder..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-muted/50 border-0 focus-visible:ring-1 h-9"
          />
        </div>
      </div>

      <div className="text-sm text-muted-foreground mb-4">
        Tilknyt dialer-agenter til medarbejdere. En medarbejder kan have flere agent-profiler fra forskellige API'er.
        <strong className="block mt-1 text-foreground">Vigtigt: Alt data overføres til medarbejderen. Agenter uden medarbejder-tilknytning vil ikke kunne bruges.</strong>
      </div>

      {/* Unmapped agents resolution section */}
      {unmappedAgentsWithSuggestions.length > 0 && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 mb-4 space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <span className="text-destructive font-medium">
              {unmappedAgentsWithSuggestions.length} agenter mangler mapping
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Disse agenter har ingen medarbejder-tilknytning og kan ikke bruges i systemet. 
            Tilknyt dem herunder for at aktivere dem.
          </p>

          <div className="grid gap-3">
            {unmappedAgentsWithSuggestions.map((agent) => {
              const currentSelection = unmappedSelections[agent.id] || agent.suggestedEmployee?.id || "";
              const hasSuggestion = !!agent.suggestedEmployee;

              return (
                <Card key={agent.id} className="bg-background/50 border-border/50">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      {/* Agent info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center text-xs font-semibold text-destructive">
                            {agent.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{agent.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{agent.email}</p>
                          </div>
                        </div>
                      </div>

                      {/* Employee selection */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Select
                          value={currentSelection}
                          onValueChange={(value) =>
                            setUnmappedSelections((prev) => ({ ...prev, [agent.id]: value }))
                          }
                        >
                          <SelectTrigger className="w-[220px] h-9 bg-background border-border">
                            <SelectValue placeholder="Vælg medarbejder..." />
                          </SelectTrigger>
                          <SelectContent>
                            {employees.map((emp) => (
                              <SelectItem key={emp.id} value={emp.id}>
                                <div className="flex items-center gap-2">
                                  <span>{emp.first_name} {emp.last_name}</span>
                                  {emp.private_email?.toLowerCase() === agent.email.toLowerCase() && (
                                    <Badge variant="secondary" className="text-[10px] px-1 py-0">Match</Badge>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Button
                          size="sm"
                          onClick={() => handleMapUnmappedAgent(agent.id, currentSelection)}
                          disabled={!currentSelection || addMappingMutation.isPending}
                          className="h-9 gap-1.5"
                        >
                          {addMappingMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <UserPlus className="h-4 w-4" />
                              <span className="hidden sm:inline">Tilknyt</span>
                            </>
                          )}
                        </Button>
                      </div>

                      {/* Suggestion indicator */}
                      {hasSuggestion && currentSelection === agent.suggestedEmployee?.id && (
                        <div className="flex items-center gap-1 text-xs text-green-600">
                          <Check className="h-3 w-3" />
                          <span className="hidden sm:inline">Foreslået match</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-xl bg-card/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-border/50">
                <TableHead className="text-xs font-medium text-muted-foreground w-1/4">Medarbejder</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground w-1/3">Tilknyt agent</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">Tilknyttede agenter</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map((employee) => {
                const employeeMappings = getMappingsForEmployee(employee.id);
                const availableAgents = getAvailableAgents(employee.id);

                return (
                  <TableRow key={employee.id} className="hover:bg-muted/30 border-b border-border/30">
                    <TableCell className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                          {employee.first_name?.[0]}{employee.last_name?.[0]}
                        </div>
                        <div>
                          <div className="font-medium">{employee.first_name} {employee.last_name}</div>
                          {employee.private_email && (
                            <div className="text-xs text-muted-foreground">{employee.private_email}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-2">
                        <Select
                          value={selectedAgents[employee.id] || ""}
                          onValueChange={(value) =>
                            setSelectedAgents((prev) => ({ ...prev, [employee.id]: value }))
                          }
                        >
                          <SelectTrigger className="w-[240px] h-9 bg-muted/50 border-0">
                            <SelectValue placeholder="Vælg agent..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableAgents.length === 0 ? (
                              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                Ingen tilgængelige agenter
                              </div>
                            ) : (
                              availableAgents.map((agent) => (
                                <SelectItem key={agent.id} value={agent.id}>
                                  <div className="flex flex-col">
                                    <span>{agent.name}</span>
                                    <span className="text-xs text-muted-foreground">{agent.email}</span>
                                  </div>
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAddMapping(employee.id)}
                          disabled={!selectedAgents[employee.id] || addMappingMutation.isPending}
                          className="h-9"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex flex-wrap gap-2">
                        {employeeMappings.length === 0 ? (
                          <span className="text-sm text-muted-foreground/50">Ingen tilknytninger</span>
                        ) : (
                          employeeMappings.map((mapping) => (
                            <Badge
                              key={mapping.id}
                              variant="secondary"
                              className="flex items-center gap-1.5 pr-1"
                            >
                              <span>{mapping.agents?.name || "Ukendt"}</span>
                              <button
                                onClick={() => removeMappingMutation.mutate(mapping.id)}
                                className="ml-1 hover:bg-destructive/20 rounded p-0.5"
                                disabled={removeMappingMutation.isPending}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="text-xs text-muted-foreground mt-4">
        Totalt: {agents.length} aktive agenter fra API'er • {mappings.length} tilknytninger •
        <span className={unmappedAgents.length > 0 ? "text-destructive font-medium" : "text-green-600"}>
          {unmappedAgents.length > 0 ? `${unmappedAgents.length} agenter mangler mapping` : "Alle agenter er mappet ✓"}
        </span>
      </div>
    </div>
  );
}
