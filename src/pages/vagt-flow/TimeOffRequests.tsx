import { MainLayout } from "@/components/layout/MainLayout";
import { useState } from "react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useTimeOffRequests, useApproveTimeOff, useRejectTimeOff, TimeOffRequest } from "@/hooks/useTimeOffRequests";
import { useVagtEmployee } from "@/hooks/useVagtEmployee";
import { Calendar, CheckCircle, XCircle, Clock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function VagtTimeOffRequests() {
  const { toast } = useToast();
  const { data: employee } = useVagtEmployee();
  const [selectedRequest, setSelectedRequest] = useState<TimeOffRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const { data: pendingRequests } = useTimeOffRequests("PENDING");
  const { data: approvedRequests } = useTimeOffRequests("APPROVED");
  const { data: rejectedRequests } = useTimeOffRequests("REJECTED");

  const approveMutation = useApproveTimeOff();
  const rejectMutation = useRejectTimeOff();

  const handleApprove = (request: TimeOffRequest) => {
    if (!employee) return;
    approveMutation.mutate(
      { requestId: request.id, approvedBy: employee.id },
      {
        onSuccess: () => {
          toast({ title: "Fravær godkendt" });
          setSelectedRequest(null);
        },
      }
    );
  };

  const handleReject = () => {
    if (!selectedRequest) return;
    rejectMutation.mutate(
      { requestId: selectedRequest.id, rejectionReason },
      {
        onSuccess: () => {
          toast({ title: "Fravær afvist" });
          setSelectedRequest(null);
          setShowRejectDialog(false);
          setRejectionReason("");
        },
      }
    );
  };

  const statusColors: Record<string, string> = {
    PENDING: "bg-yellow-500",
    APPROVED: "bg-green-500",
    REJECTED: "bg-red-500",
  };

  const statusLabels: Record<string, string> = {
    PENDING: "Afventer",
    APPROVED: "Godkendt",
    REJECTED: "Afvist",
  };

  const reasonLabels: Record<string, string> = {
    Ferie: "Ferie",
    Syg: "Syg",
    "Barn syg": "Barn syg",
    Andet: "Andet",
  };

  const RequestTable = ({ requests, showActions = false }: { requests: TimeOffRequest[] | undefined; showActions?: boolean }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Medarbejder</TableHead>
          <TableHead>Team</TableHead>
          <TableHead>Periode</TableHead>
          <TableHead>Årsag</TableHead>
          <TableHead>Status</TableHead>
          {showActions && <TableHead></TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {requests?.map((request) => (
          <TableRow key={request.id}>
            <TableCell className="font-medium">{request.employee?.full_name}</TableCell>
            <TableCell>
              {request.employee?.team && (
                <Badge variant="outline">{request.employee.team}</Badge>
              )}
            </TableCell>
            <TableCell>
              {format(new Date(request.start_date), "d/M/yyyy", { locale: da })}
              {request.start_date !== request.end_date && (
                <> - {format(new Date(request.end_date), "d/M/yyyy", { locale: da })}</>
              )}
            </TableCell>
            <TableCell>{reasonLabels[request.reason] || request.reason}</TableCell>
            <TableCell>
              <Badge className={`${statusColors[request.status]} text-white`}>
                {statusLabels[request.status]}
              </Badge>
            </TableCell>
            {showActions && (
              <TableCell>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleApprove(request)}>
                    <CheckCircle className="h-4 w-4 mr-1 text-green-600" />
                    Godkend
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setSelectedRequest(request); setShowRejectDialog(true); }}>
                    <XCircle className="h-4 w-4 mr-1 text-red-600" />
                    Afvis
                  </Button>
                </div>
              </TableCell>
            )}
          </TableRow>
        ))}
        {(!requests || requests.length === 0) && (
          <TableRow>
            <TableCell colSpan={showActions ? 6 : 5} className="text-center text-muted-foreground py-8">
              Ingen anmodninger
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fraværsanmodninger</h1>
          <p className="text-muted-foreground">Administrer ferie og fravær</p>
        </div>

        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Afventer ({pendingRequests?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="approved" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Godkendt ({approvedRequests?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="rejected" className="flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Afvist ({rejectedRequests?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <Card>
              <CardContent className="pt-6">
                <RequestTable requests={pendingRequests} showActions />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="approved">
            <Card>
              <CardContent className="pt-6">
                <RequestTable requests={approvedRequests} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rejected">
            <Card>
              <CardContent className="pt-6">
                <RequestTable requests={rejectedRequests} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Reject dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Afvis fraværsanmodning</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label>Årsag til afvisning</Label>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Angiv årsag..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Annuller</Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejectMutation.isPending}>
              Afvis
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
