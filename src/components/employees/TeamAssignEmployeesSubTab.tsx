import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Building2, AlertTriangle, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Client {
  id: string;
  name: string;
  logo_url: string | null;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  team_id: string | null;
  is_staff_employee: boolean;
}

interface Props {
  teamId: string;
  teamClientIds: string[];
  teamEmployeeIds: string[];
  clients: Client[];
  employees: Employee[];
}

export function TeamAssignEmployeesSubTab({ teamId, teamClientIds, teamEmployeeIds, clients, employees }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all assignments for team employees
  const { data: assignments = [] } = useQuery({
    queryKey: ["employee-client-assignments", "team", teamId],
    queryFn: async () => {
      if (teamEmployeeIds.length === 0) return [] as { id: string; employee_id: string; client_id: string; created_at: string }[];
      const { data, error } = await supabase
        .from("employee_client_assignments")
        .select("id, employee_id, client_id, created_at")
        .in("employee_id", teamEmployeeIds);
      if (error) throw error;
      return data as { id: string; employee_id: string; client_id: string; created_at: string }[];
    },
    enabled: teamEmployeeIds.length > 0,
  });

  // Fetch all clients (for "Andre kunder" section)
  const { data: allClients = [] } = useQuery({
    queryKey: ["all-clients-for-assignments"],
    queryFn: async (): Promise<Client[]> => {
      const query = supabase.from("clients").select("id, name, logo_url");
      const { data, error } = await (query as any).eq("is_active", true).order("name");
      if (error) throw error;
      return (data ?? []) as Client[];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ employeeId, clientId, assigned }: { employeeId: string; clientId: string; assigned: boolean }) => {
      if (assigned) {
        const { error } = await supabase
          .from("employee_client_assignments")
          .delete()
          .eq("employee_id", employeeId)
          .eq("client_id", clientId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("employee_client_assignments")
          .insert({ employee_id: employeeId, client_id: clientId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-client-assignments"] });
    },
    onError: (err: any) => {
      if (err?.code === "23505") {
        toast({ title: "Allerede tildelt", variant: "destructive" });
      } else {
        toast({ title: "Fejl", description: "Kunne ikke opdatere tildeling", variant: "destructive" });
      }
    },
  });

  const isAssigned = (employeeId: string, clientId: string) =>
    assignments.some((a) => a.employee_id === employeeId && a.client_id === clientId);

  const teamMembers = employees.filter((e) => teamEmployeeIds.includes(e.id));
  const teamClientsFiltered = clients.filter((c) => teamClientIds.includes(c.id));
  const otherClients = allClients.filter((c) => !teamClientIds.includes(c.id));

  // Find employees with no assignments at all
  const unassignedEmployees = teamMembers.filter(
    (emp) => !assignments.some((a) => a.employee_id === emp.id)
  );

  if (teamMembers.length === 0) {
    return (
      <div className="py-12 text-center">
        <UserCheck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-muted-foreground">Ingen medarbejdere på dette team</p>
      </div>
    );
  }

  if (teamClientsFiltered.length === 0) {
    return (
      <div className="py-12 text-center">
        <Building2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-muted-foreground">Ingen kunder valgt på dette team</p>
        <p className="text-xs text-muted-foreground mt-1">Gå til "Fordel kunder" for at tilføje kunder først</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Warning: unassigned employees */}
      {unassignedEmployees.length > 0 && (
        <div className="border border-dashed border-yellow-500/50 rounded-lg p-4 bg-yellow-500/5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-medium text-yellow-500">
              {unassignedEmployees.length} medarbejder{unassignedEmployees.length > 1 ? "e" : ""} uden kundetildeling
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {unassignedEmployees.map((emp) => (
              <Badge key={emp.id} variant="outline" className="text-xs border-yellow-500/30 text-yellow-600">
                {emp.first_name} {emp.last_name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Team clients assignment matrix */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">Teamets kunder</h4>
        {teamClientsFiltered.map((client) => (
          <ClientEmployeeRow
            key={client.id}
            client={client}
            employees={teamMembers}
            isAssigned={isAssigned}
            onToggle={(employeeId) =>
              toggleMutation.mutate({
                employeeId,
                clientId: client.id,
                assigned: isAssigned(employeeId, client.id),
              })
            }
            isPending={toggleMutation.isPending}
          />
        ))}
      </div>

      {/* Cross-team clients (Andre kunder) */}
      {otherClients.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Andre kunder (kryds-team)</h4>
          <p className="text-xs text-muted-foreground">
            Tildel medarbejdere til kunder fra andre teams
          </p>
          {otherClients
            .filter((c) => assignments.some((a) => a.client_id === c.id))
            .map((client) => (
              <ClientEmployeeRow
                key={client.id}
                client={client}
                employees={teamMembers}
                isAssigned={isAssigned}
                onToggle={(employeeId) =>
                  toggleMutation.mutate({
                    employeeId,
                    clientId: client.id,
                    assigned: isAssigned(employeeId, client.id),
                  })
                }
                isPending={toggleMutation.isPending}
                isCrossTeam
              />
            ))}
          {/* Show a collapsed list for adding new cross-team assignments */}
          <CrossTeamAddSection
            otherClients={otherClients.filter(
              (c) => !assignments.some((a) => a.client_id === c.id)
            )}
            employees={teamMembers}
            onAssign={(employeeId, clientId) =>
              toggleMutation.mutate({ employeeId, clientId, assigned: false })
            }
            isPending={toggleMutation.isPending}
          />
        </div>
      )}
    </div>
  );
}

function ClientEmployeeRow({
  client,
  employees,
  isAssigned,
  onToggle,
  isPending,
  isCrossTeam,
}: {
  client: { id: string; name: string; logo_url: string | null };
  employees: Employee[];
  isAssigned: (empId: string, clientId: string) => boolean;
  onToggle: (empId: string) => void;
  isPending: boolean;
  isCrossTeam?: boolean;
}) {
  const assignedCount = employees.filter((e) => isAssigned(e.id, client.id)).length;

  return (
    <div className={`border rounded-lg p-3 ${isCrossTeam ? 'border-dashed' : ''}`}>
      <div className="flex items-center gap-2 mb-3">
        {client.logo_url ? (
          <img src={client.logo_url} alt="" className="h-5 w-5 object-contain rounded" />
        ) : (
          <Building2 className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="text-sm font-medium">{client.name}</span>
        <Badge variant="secondary" className="ml-auto text-xs h-5 px-1.5">
          {assignedCount}/{employees.length}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        {employees.map((emp) => {
          const assigned = isAssigned(emp.id, client.id);
          return (
            <button
              key={emp.id}
              type="button"
              disabled={isPending}
              onClick={() => onToggle(emp.id)}
              className={`
                inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors
                ${assigned
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted/50'
                }
              `}
            >
              <Checkbox checked={assigned} className="h-3 w-3 pointer-events-none" />
              {emp.first_name} {emp.last_name.charAt(0)}.
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CrossTeamAddSection({
  otherClients,
  employees,
  onAssign,
  isPending,
}: {
  otherClients: { id: string; name: string; logo_url: string | null }[];
  employees: Employee[];
  onAssign: (empId: string, clientId: string) => void;
  isPending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  if (otherClients.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-primary hover:underline"
      >
        {expanded ? "Skjul" : `Vis ${otherClients.length} andre kunder...`}
      </button>
      {expanded && (
        <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
          {otherClients.map((client) => (
            <div key={client.id} className="border border-dashed rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                {client.logo_url ? (
                  <img src={client.logo_url} alt="" className="h-4 w-4 object-contain rounded" />
                ) : (
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className="text-xs font-medium">{client.name}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {employees.map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    disabled={isPending}
                    onClick={() => onAssign(emp.id, client.id)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] border border-dashed border-border text-muted-foreground hover:bg-muted/50 transition-colors"
                  >
                    + {emp.first_name} {emp.last_name.charAt(0)}.
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
