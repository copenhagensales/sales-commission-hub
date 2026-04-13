import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, AlertTriangle, UserCheck, Star, X, Plus, Clock, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEmployeeClientAssignments } from "@/hooks/useEmployeeClientAssignments";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { da } from "date-fns/locale";

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

  const {
    assignments,
    isLoading: assignmentsLoading,
    setPrimary,
    addSecondary,
    removeSecondary,
    isSettingPrimary,
  } = useEmployeeClientAssignments({});

  // Fetch change logs
  const { data: changeLogs = [] } = useQuery({
    queryKey: ["employee-client-change-log", teamEmployeeIds],
    queryFn: async () => {
      if (teamEmployeeIds.length === 0) return [];
      const { data, error } = await supabase
        .from("employee_client_change_log")
        .select("employee_id, old_client_id, new_client_id, changed_at")
        .in("employee_id", teamEmployeeIds)
        .order("changed_at", { ascending: false })
        .limit(100);
      if (error) return [];
      return data || [];
    },
    enabled: teamEmployeeIds.length > 0,
  });

  // Fetch all clients for secondary dropdown
  const { data: allClients = [] } = useQuery({
    queryKey: ["all-clients-for-assignments"],
    queryFn: async (): Promise<Client[]> => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, logo_url")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Client[];
    },
  });

  const teamMembers = employees.filter((e) => teamEmployeeIds.includes(e.id));
  const teamClientsFiltered = clients.filter((c) => teamClientIds.includes(c.id));

  // Build helper maps
  const clientMap = new Map<string, Client>();
  allClients.forEach(c => clientMap.set(c.id, c));
  teamClientsFiltered.forEach(c => clientMap.set(c.id, c));

  const getEmployeeAssignments = (empId: string) =>
    assignments.filter(a => a.employee_id === empId);

  const getLatestChange = (empId: string) =>
    changeLogs.find(cl => cl.employee_id === empId);

  // Find employees with no assignments
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
      {/* Info box */}
      <div className="border rounded-lg p-3 bg-muted/30 text-xs text-muted-foreground space-y-1">
        <div className="flex items-center gap-1.5 font-medium text-foreground text-sm">
          <Clock className="h-3.5 w-3.5 text-primary" />
          Kundetildeling og stempelur
        </div>
        <p>Vælg en <strong>primær kunde</strong> (timer fra vagtplan) og eventuelt <strong>sekundære kunder</strong> (får automatisk stempelur).</p>
        <p>Sekundære stempeltimer fratrækkes primær kundes vagtplan-timer.</p>
      </div>

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

      {/* Employee-centric list */}
      <div className="space-y-3">
        {teamMembers.map((emp) => {
          const empAssignments = getEmployeeAssignments(emp.id);
          const primary = empAssignments.find(a => a.is_primary);
          const secondaries = empAssignments.filter(a => !a.is_primary);
          const latestChange = getLatestChange(emp.id);

          // Clients available to set as secondary (not already assigned)
          const assignedClientIds = new Set(empAssignments.map(a => a.client_id));
          const availableForSecondary = allClients.filter(c => !assignedClientIds.has(c.id));

          return (
            <EmployeeClientRow
              key={emp.id}
              employee={emp}
              primaryClientId={primary?.client_id || null}
              secondaryAssignments={secondaries}
              latestChange={latestChange}
              teamClients={teamClientsFiltered}
              availableForSecondary={availableForSecondary}
              clientMap={clientMap}
              onSetPrimary={(clientId) => setPrimary({ employeeId: emp.id, newClientId: clientId })}
              onAddSecondary={(clientId) => addSecondary({ employeeId: emp.id, clientId })}
              onRemoveSecondary={(clientId) => removeSecondary({ employeeId: emp.id, clientId })}
              isSettingPrimary={isSettingPrimary}
            />
          );
        })}
      </div>
    </div>
  );
}

function EmployeeClientRow({
  employee,
  primaryClientId,
  secondaryAssignments,
  latestChange,
  teamClients,
  availableForSecondary,
  clientMap,
  onSetPrimary,
  onAddSecondary,
  onRemoveSecondary,
  isSettingPrimary,
}: {
  employee: Employee;
  primaryClientId: string | null;
  secondaryAssignments: { id: string; client_id: string }[];
  latestChange: { changed_at: string; old_client_id: string | null; new_client_id: string } | undefined;
  teamClients: Client[];
  availableForSecondary: Client[];
  clientMap: Map<string, Client>;
  onSetPrimary: (clientId: string) => void;
  onAddSecondary: (clientId: string) => void;
  onRemoveSecondary: (clientId: string) => void;
  isSettingPrimary: boolean;
}) {
  const [showAddSecondary, setShowAddSecondary] = useState(false);

  return (
    <div className="border rounded-lg p-4 space-y-3">
      {/* Employee header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">
            {employee.first_name} {employee.last_name}
          </span>
          {employee.job_title && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {employee.job_title}
            </Badge>
          )}
        </div>
        {latestChange && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <History className="h-3 w-3" />
            Skiftet {format(new Date(latestChange.changed_at), "d. MMM yyyy", { locale: da })}
          </div>
        )}
      </div>

      {/* Primary client selector */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-[80px]">
          <Star className="h-3 w-3 text-amber-500" />
          Primær
        </div>
        <Select
          value={primaryClientId || ""}
          onValueChange={(val) => onSetPrimary(val)}
          disabled={isSettingPrimary}
        >
          <SelectTrigger className="h-8 text-xs flex-1">
            <SelectValue placeholder="Vælg primær kunde..." />
          </SelectTrigger>
          <SelectContent>
            {teamClients.map(c => (
              <SelectItem key={c.id} value={c.id} className="text-xs">
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Secondary clients */}
      <div className="flex items-start gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-[80px] pt-1">
          <Clock className="h-3 w-3 text-primary" />
          Sekundær
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap gap-1.5">
            {secondaryAssignments.map(sa => {
              const client = clientMap.get(sa.client_id);
              return (
                <Badge
                  key={sa.id}
                  variant="outline"
                  className="text-xs gap-1 pr-1"
                >
                  {client?.name || "Ukendt"}
                  <button
                    type="button"
                    onClick={() => onRemoveSecondary(sa.client_id)}
                    className="ml-0.5 hover:text-destructive transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
            {!showAddSecondary ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-primary"
                onClick={() => setShowAddSecondary(true)}
              >
                <Plus className="h-3 w-3 mr-0.5" />
                Tilføj
              </Button>
            ) : (
              <Select
                onValueChange={(val) => {
                  onAddSecondary(val);
                  setShowAddSecondary(false);
                }}
              >
                <SelectTrigger className="h-7 text-xs w-[180px]">
                  <SelectValue placeholder="Vælg kunde..." />
                </SelectTrigger>
                <SelectContent>
                  {availableForSecondary.map(c => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          {secondaryAssignments.length > 0 && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Stempelur oprettes automatisk for sekundære kunder
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
