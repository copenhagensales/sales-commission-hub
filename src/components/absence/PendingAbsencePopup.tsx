import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCanAccess } from "@/hooks/useSystemRoles";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, addHours, isBefore } from "date-fns";
import { da } from "date-fns/locale";
import { Check, X, Clock, Calendar, User } from "lucide-react";

const ABSENCE_TYPE_LABELS: Record<string, string> = {
  vacation: "Ferie",
  sick: "Sygdom",
  leave: "Orlov",
  other: "Andet",
};

export function PendingAbsencePopup() {
  const { user } = useAuth();
  const { isTeamlederOrAbove, isOwner } = useCanAccess();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Fetch pending absence requests for team
  const { data: pendingRequests, isLoading } = useQuery({
    queryKey: ["pending-absence-popup", user?.email],
    queryFn: async () => {
      if (!user?.email) return [];

      // Get current employee id
      const { data: currentEmployee } = await supabase
        .from("employee_master_data")
        .select("id")
        .eq("private_email", user.email)
        .maybeSingle();

      if (!currentEmployee) return [];

      const now = new Date().toISOString();

      // Get pending requests that are not postponed or postponement has expired
      let query = supabase
        .from("absence_request_v2")
        .select(`
          *,
          employee:employee_master_data!absence_request_v2_employee_id_fkey(
            id, first_name, last_name
          )
        `)
        .eq("status", "pending")
        .or(`postponed_until.is.null,postponed_until.lt.${now}`)
        .order("created_at", { ascending: true });

      // If not owner, filter to team members only
      if (!isOwner && currentEmployee) {
        const { data: teamMembers } = await supabase
          .from("employee_master_data")
          .select("id")
          .eq("manager_id", currentEmployee.id);

        const teamIds = teamMembers?.map(m => m.id) || [];
        if (teamIds.length === 0) return [];

        query = query.in("employee_id", teamIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.email && isTeamlederOrAbove,
    refetchOnWindowFocus: true,
    staleTime: 30000,
  });

  // Show popup when there are pending requests
  useEffect(() => {
    if (pendingRequests && pendingRequests.length > 0 && !isOpen) {
      setIsOpen(true);
      setCurrentIndex(0);
    }
  }, [pendingRequests]);

  const currentRequest = pendingRequests?.[currentIndex];

  // Check if postpone is still available (hasn't been postponed before)
  const canPostpone = currentRequest && !currentRequest.postponed_until;

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const { error } = await supabase
        .from("absence_request_v2")
        .update({
          ...updates,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-absence-popup"] });
      queryClient.invalidateQueries({ queryKey: ["absence-requests"] });
    },
  });

  const handleApprove = async () => {
    if (!currentRequest) return;
    await updateMutation.mutateAsync({
      id: currentRequest.id,
      updates: { status: "approved" },
    });
    toast({ title: "Fravær godkendt" });
    moveToNext();
  };

  const handleReject = async () => {
    if (!currentRequest) return;
    await updateMutation.mutateAsync({
      id: currentRequest.id,
      updates: { 
        status: "rejected",
        rejection_reason: rejectReason,
      },
    });
    toast({ title: "Fravær afvist" });
    setRejectReason("");
    setShowRejectForm(false);
    moveToNext();
  };

  const handlePostpone = async () => {
    if (!currentRequest || !canPostpone) return;
    const postponeUntil = addHours(new Date(), 24).toISOString();
    await updateMutation.mutateAsync({
      id: currentRequest.id,
      updates: { postponed_until: postponeUntil },
    });
    toast({ title: "Anmodning udskudt 24 timer" });
    moveToNext();
  };

  const moveToNext = () => {
    if (pendingRequests && currentIndex < pendingRequests.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setShowRejectForm(false);
      setRejectReason("");
    } else {
      setIsOpen(false);
      setCurrentIndex(0);
      setShowRejectForm(false);
      setRejectReason("");
    }
  };

  if (!isTeamlederOrAbove || !currentRequest) return null;

  const employee = currentRequest.employee;
  const employeeName = employee ? `${employee.first_name} ${employee.last_name}` : "Ukendt medarbejder";

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Fraværsanmodning
          </DialogTitle>
          <DialogDescription>
            {pendingRequests && pendingRequests.length > 1 && (
              <span className="text-sm">
                Anmodning {currentIndex + 1} af {pendingRequests.length}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Employee info */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <User className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">{employeeName}</p>
              <Badge variant="outline">
                {ABSENCE_TYPE_LABELS[currentRequest.type] || currentRequest.type}
              </Badge>
            </div>
          </div>

          {/* Date info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Periode:</span>
              <span className="font-medium">
                {format(parseISO(currentRequest.start_date), "d. MMM yyyy", { locale: da })}
                {currentRequest.start_date !== currentRequest.end_date && (
                  <> - {format(parseISO(currentRequest.end_date), "d. MMM yyyy", { locale: da })}</>
                )}
              </span>
            </div>
            {!currentRequest.is_full_day && currentRequest.start_time && currentRequest.end_time && (
              <div className="flex items-center gap-2 text-sm">
                <span className="ml-6 text-muted-foreground">Tidspunkt:</span>
                <span className="font-medium">
                  {currentRequest.start_time.slice(0, 5)} - {currentRequest.end_time.slice(0, 5)}
                </span>
              </div>
            )}
          </div>

          {/* Comment */}
          {currentRequest.comment && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Kommentar:</p>
              <p className="text-sm">{currentRequest.comment}</p>
            </div>
          )}

          {/* Was postponed warning */}
          {currentRequest.postponed_until && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Denne anmodning blev udskudt tidligere. Du skal nu godkende eller afvise.
              </p>
            </div>
          )}

          {/* Reject form */}
          {showRejectForm && (
            <div className="space-y-2">
              <Label>Årsag til afvisning</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Skriv en begrundelse..."
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {showRejectForm ? (
            <>
              <Button 
                variant="outline" 
                onClick={() => setShowRejectForm(false)}
                className="w-full sm:w-auto"
              >
                Annuller
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleReject}
                disabled={updateMutation.isPending}
                className="w-full sm:w-auto"
              >
                <X className="h-4 w-4 mr-2" />
                Afvis
              </Button>
            </>
          ) : (
            <>
              {canPostpone && (
                <Button 
                  variant="outline" 
                  onClick={handlePostpone}
                  disabled={updateMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Udskyd 24 timer
                </Button>
              )}
              <Button 
                variant="outline" 
                onClick={() => setShowRejectForm(true)}
                className="w-full sm:w-auto text-destructive hover:text-destructive"
              >
                <X className="h-4 w-4 mr-2" />
                Afvis
              </Button>
              <Button 
                onClick={handleApprove}
                disabled={updateMutation.isPending}
                className="w-full sm:w-auto"
              >
                <Check className="h-4 w-4 mr-2" />
                Godkend
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
