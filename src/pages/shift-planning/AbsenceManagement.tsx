import { useState } from "react";
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
  const updateRequest = useUpdateAbsenceRequest();

  const filterByDepartment = (requests: AbsenceRequest[] | undefined) => {
    if (!requests) return [];
    // Filter out current user's own requests (can't approve your own)
    let filtered = requests.filter(r => r.employee_id !== currentEmployee?.id);
    if (selectedDepartment === "all") return filtered;
    return filtered.filter(r => r.employee?.department === selectedDepartment);
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
                {departments?.map(dept => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
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
                  <p className="text-2xl font-bold">{filterByDepartment(pendingRequests).length}</p>
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
                  <p className="text-2xl font-bold">{filterByDepartment(approvedRequests).length}</p>
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
                  <p className="text-2xl font-bold">{filterByDepartment(rejectedRequests).length}</p>
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
              {filterByDepartment(pendingRequests).length > 0 && (
                <Badge variant="secondary">{filterByDepartment(pendingRequests).length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved">Godkendt</TabsTrigger>
            <TabsTrigger value="rejected">Afvist</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4 mt-4">
            {filterByDepartment(pendingRequests).length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Ingen ventende anmodninger
                </CardContent>
              </Card>
            ) : (
              filterByDepartment(pendingRequests).map(request => (
                <RequestCard key={request.id} request={request} showActions />
              ))
            )}
          </TabsContent>

          <TabsContent value="approved" className="space-y-4 mt-4">
            {filterByDepartment(approvedRequests).length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Ingen godkendte anmodninger
                </CardContent>
              </Card>
            ) : (
              filterByDepartment(approvedRequests).map(request => (
                <RequestCard key={request.id} request={request} />
              ))
            )}
          </TabsContent>

          <TabsContent value="rejected" className="space-y-4 mt-4">
            {filterByDepartment(rejectedRequests).length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Ingen afviste anmodninger
                </CardContent>
              </Card>
            ) : (
              filterByDepartment(rejectedRequests).map(request => (
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
