import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Check, X, Clock, Filter, Thermometer, Umbrella, UserPlus } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  useAbsenceRequests,
  useUpdateAbsenceRequest,
  useDepartments,
  useCurrentEmployee,
  AbsenceRequest,
} from "@/hooks/useShiftPlanning";
import { usePermissions } from "@/hooks/usePositionPermissions";
import { MarkSickDialog } from "@/components/shift-planning/MarkSickDialog";

export default function AbsenceManagement() {
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<AbsenceRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [markSickDialogOpen, setMarkSickDialogOpen] = useState(false);

  const { data: pendingRequests } = useAbsenceRequests("pending");
  const { data: approvedRequests } = useAbsenceRequests("approved");
  const { data: rejectedRequests } = useAbsenceRequests("rejected");
  const { data: departments } = useDepartments();
  const { data: currentEmployee } = useCurrentEmployee();
  const { scopeAbsence } = usePermissions();
  const updateRequest = useUpdateAbsenceRequest();

  // Fetch team members for filtering
  const { data: teamMemberIds } = useQuery({
    queryKey: ["team-member-ids", selectedDepartment],
    queryFn: async () => {
      if (selectedDepartment === "all") return null;
      const { data, error } = await supabase
        .from("team_members")
        .select("employee_id")
        .eq("team_id", selectedDepartment);
      if (error) throw error;
      return data?.map(tm => tm.employee_id) || [];
    },
    enabled: selectedDepartment !== "all",
  });

  // Fetch teams where current user is team leader or assistant team leader
  const { data: ledTeamMemberIds } = useQuery({
    queryKey: ["led-team-member-ids", currentEmployee?.id],
    queryFn: async () => {
      if (!currentEmployee?.id) return [];
      
      // Get teams where current user is team_leader or assistant_team_leader
      const { data: ledTeams, error: teamsError } = await supabase
        .from("teams")
        .select("id")
        .or(`team_leader_id.eq.${currentEmployee.id},assistant_team_leader_id.eq.${currentEmployee.id}`);
      
      if (teamsError) throw teamsError;
      
      const ledTeamIds = ledTeams?.map(t => t.id) || [];
      if (ledTeamIds.length === 0) return [];
      
      // Get all employees from those teams
      const { data: teamMembers, error: membersError } = await supabase
        .from("team_members")
        .select("employee_id")
        .in("team_id", ledTeamIds);
      
      if (membersError) throw membersError;
      return teamMembers?.map(tm => tm.employee_id) || [];
    },
    enabled: !!currentEmployee?.id,
  });

  // Fetch all employees who are in teams with leaders (for admin filtering)
  const { data: employeesWithTeamLeaders } = useQuery({
    queryKey: ["employees-with-team-leaders"],
    queryFn: async () => {
      // Get all teams that have a leader assigned
      const { data: teamsWithLeaders, error: teamsError } = await supabase
        .from("teams")
        .select("id")
        .not("team_leader_id", "is", null);
      
      if (teamsError) throw teamsError;
      
      const teamIds = teamsWithLeaders?.map(t => t.id) || [];
      if (teamIds.length === 0) return [];
      
      // Get all employees from those teams
      const { data: members, error: membersError } = await supabase
        .from("team_members")
        .select("employee_id")
        .in("team_id", teamIds);
      
      if (membersError) throw membersError;
      return members?.map(m => m.employee_id) || [];
    },
    enabled: scopeAbsence === "alt",
  });

  const filterByTeamAndScope = (requests: AbsenceRequest[] | undefined) => {
    if (!requests || !currentEmployee) return [];
    
    // Filter out current user's own requests (can't approve your own)
    let filtered = requests.filter(r => r.employee_id !== currentEmployee.id);
    
    // Apply scope-based filtering using team relationships:
    // Team leaders: only see employees from teams they lead
    // Admins (scopeAbsence === "alt"): only see employees NOT in any team with a leader
    if (scopeAbsence !== "alt") {
      // Team leader: only see requests from employees in teams I lead
      filtered = filtered.filter(r => ledTeamMemberIds?.includes(r.employee_id) ?? false);
    } else {
      // Admin/Owner: only see requests from employees NOT in any team with a leader
      // This ensures team leaders handle their own team's requests first
      filtered = filtered.filter(r => !(employeesWithTeamLeaders?.includes(r.employee_id) ?? false));
    }
    
    // Additional department filter if selected
    if (selectedDepartment !== "all" && teamMemberIds) {
      filtered = filtered.filter(r => teamMemberIds.includes(r.employee_id));
    }
    
    return filtered;
  };

  const handleApprove = (request: AbsenceRequest) => {
    updateRequest.mutate({ id: request.id, status: "approved" });
  };

  const handleReject = () => {
    if (!selectedRequest) return;
    updateRequest.mutate(
      { id: selectedRequest.id, status: "rejected", rejection_reason: rejectionReason },
      {
        onSuccess: () => {
          setRejectDialogOpen(false);
          setSelectedRequest(null);
          setRejectionReason("");
        }
      }
    );
  };

  const openRejectDialog = (request: AbsenceRequest) => {
    setSelectedRequest(request);
    setRejectDialogOpen(true);
  };

  const RequestCard = ({ request, showActions = false }: { request: AbsenceRequest; showActions?: boolean }) => (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div className="flex items-center gap-4">
        <div className={`p-2 rounded-full ${request.type === "vacation" ? "bg-blue-100 dark:bg-blue-900" : "bg-red-100 dark:bg-red-900"}`}>
          {request.type === "vacation" ? (
            <Umbrella className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          ) : (
            <Thermometer className="h-5 w-5 text-red-600 dark:text-red-400" />
          )}
        </div>
        <div>
          <p className="font-medium">
            {request.employee?.first_name} {request.employee?.last_name}
          </p>
          <p className="text-sm text-muted-foreground">
            {request.employee?.department || "Ingen afdeling"}
          </p>
          <p className="text-sm">
            {format(new Date(request.start_date), "d. MMM", { locale: da })}
            {request.start_date !== request.end_date && ` - ${format(new Date(request.end_date), "d. MMM", { locale: da })}`}
            {!request.is_full_day && request.start_time && request.end_time && (
              <span className="text-muted-foreground"> ({request.start_time.slice(0, 5)} - {request.end_time.slice(0, 5)})</span>
            )}
          </p>
          {request.comment && (
            <p className="text-xs text-muted-foreground mt-1">"{request.comment}"</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={request.type === "vacation" ? "default" : "destructive"}>
          {request.type === "vacation" ? "Ferie" : "Sygdom"}
        </Badge>
        {showActions && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="text-green-600 hover:text-green-700"
              onClick={() => handleApprove(request)}
              disabled={updateRequest.isPending}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 hover:text-red-700"
              onClick={() => openRejectDialog(request)}
              disabled={updateRequest.isPending}
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        )}
        {!showActions && request.status === "approved" && (
          <Badge variant="outline" className="text-green-600">Godkendt</Badge>
        )}
        {!showActions && request.status === "rejected" && (
          <Badge variant="outline" className="text-red-600">Afvist</Badge>
        )}
      </div>
    </div>
  );

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Fraværshåndtering</h1>
            <p className="text-muted-foreground">
              Godkend eller afvis fraværsanmodninger
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Alle afdelinger" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle afdelinger</SelectItem>
                {departments?.map(team => (
                  <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setMarkSickDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Meld syg
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Afventer</p>
                  <p className="text-2xl font-bold">{filterByTeamAndScope(pendingRequests).length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Godkendt (denne måned)</p>
                  <p className="text-2xl font-bold">{filterByTeamAndScope(approvedRequests).length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <X className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Afvist (denne måned)</p>
                  <p className="text-2xl font-bold">{filterByTeamAndScope(rejectedRequests).length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending" className="flex items-center gap-2">
              Afventer
              {filterByTeamAndScope(pendingRequests).length > 0 && (
                <Badge variant="secondary">{filterByTeamAndScope(pendingRequests).length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved">Godkendt</TabsTrigger>
            <TabsTrigger value="rejected">Afvist</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4 mt-4">
            {filterByTeamAndScope(pendingRequests).length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Ingen ventende anmodninger
                </CardContent>
              </Card>
            ) : (
              filterByTeamAndScope(pendingRequests).map(request => (
                <RequestCard key={request.id} request={request} showActions />
              ))
            )}
          </TabsContent>

          <TabsContent value="approved" className="space-y-4 mt-4">
            {filterByTeamAndScope(approvedRequests).length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Ingen godkendte anmodninger
                </CardContent>
              </Card>
            ) : (
              filterByTeamAndScope(approvedRequests).map(request => (
                <RequestCard key={request.id} request={request} />
              ))
            )}
          </TabsContent>

          <TabsContent value="rejected" className="space-y-4 mt-4">
            {filterByTeamAndScope(rejectedRequests).length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Ingen afviste anmodninger
                </CardContent>
              </Card>
            ) : (
              filterByTeamAndScope(rejectedRequests).map(request => (
                <RequestCard key={request.id} request={request} />
              ))
            )}
          </TabsContent>
        </Tabs>

        {/* Reject Dialog */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Afvis anmodning</DialogTitle>
              <DialogDescription>
                Angiv en begrundelse for afvisningen
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label>Begrundelse</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Skriv en begrundelse..."
                className="mt-2"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
                Annuller
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={updateRequest.isPending}
              >
                {updateRequest.isPending ? "Afviser..." : "Afvis"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Mark Sick Dialog */}
        <MarkSickDialog
          open={markSickDialogOpen}
          onOpenChange={setMarkSickDialogOpen}
        />
      </div>
    </MainLayout>
  );
}
