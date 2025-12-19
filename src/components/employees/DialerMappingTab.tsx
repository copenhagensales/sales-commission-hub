import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, X, Loader2 } from "lucide-react";

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

  // Fetch all agents from APIs
  const { data: agents = [], isLoading: loadingAgents } = useQuery({
    queryKey: ["agents-for-mapping"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents")
        .select("id, name, email, external_adversus_id")
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

  const filteredEmployees = employees.filter((emp) =>
    `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isLoading = loadingEmployees || loadingAgents || loadingMappings;

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

      {/* Warning for unmapped agents */}
      {unmappedAgents.length > 0 && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="text-destructive font-medium">⚠️ {unmappedAgents.length} agenter mangler mapping</div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {unmappedAgents.map((agent) => (
              <Badge key={agent.id} variant="outline" className="border-destructive/30 text-destructive">
                {agent.name} ({agent.email})
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Disse agenter har ingen medarbejder-tilknytning og vil ikke kunne bruges i systemet.
          </p>
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
        Totalt: {agents.length} agenter fra API'er • {mappings.length} tilknytninger • 
        <span className={unmappedAgents.length > 0 ? "text-destructive font-medium" : "text-green-600"}>
          {unmappedAgents.length > 0 ? `${unmappedAgents.length} agenter mangler mapping` : "Alle agenter er mappet ✓"}
        </span>
      </div>
    </div>
  );
}
