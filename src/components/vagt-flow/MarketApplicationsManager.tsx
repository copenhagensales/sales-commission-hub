import { useState } from "react";
import { usePendingApplications, useReviewApplication } from "@/hooks/useMarketApplications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { da } from "date-fns/locale";
import { Check, X, Users, MapPin, Calendar, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export function MarketApplicationsManager() {
  const { data: applications, isLoading } = usePendingApplications();
  const reviewMutation = useReviewApplication();
  const [isOpen, setIsOpen] = useState(true);
  const [reviewDialog, setReviewDialog] = useState<{
    open: boolean;
    application: any;
    action: "approve" | "reject";
  }>({ open: false, application: null, action: "approve" });
  const [note, setNote] = useState("");
  const [createAssignment, setCreateAssignment] = useState(true);

  const handleReview = () => {
    if (!reviewDialog.application) return;

    reviewMutation.mutate(
      {
        applicationId: reviewDialog.application.id,
        status: reviewDialog.action === "approve" ? "approved" : "rejected",
        note: note || undefined,
        createAssignment: reviewDialog.action === "approve" && createAssignment,
      },
      {
        onSuccess: () => {
          setReviewDialog({ open: false, application: null, action: "approve" });
          setNote("");
          setCreateAssignment(true);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!applications?.length) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
          Ingen afventende ansøgninger
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CardHeader className="pb-0">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 w-full text-left hover:opacity-80 transition-opacity">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Afventende ansøgninger
                  <Badge variant="secondary">{applications.length}</Badge>
                </CardTitle>
              </button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-3 pt-4">
              {applications.map((app: any) => (
                <div
                  key={app.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="space-y-1">
                      <div className="font-medium">
                        {app.employee?.first_name} {app.employee?.last_name}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <MapPin className="h-3 w-3" />
                        {app.booking?.location?.name}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        {format(parseISO(app.booking?.start_date), "d. MMM", { locale: da })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {app.booking?.clients?.name || "Ukendt kunde"}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() =>
                        setReviewDialog({ open: true, application: app, action: "reject" })
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() =>
                        setReviewDialog({ open: true, application: app, action: "approve" })
                      }
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Review Dialog */}
      <Dialog
        open={reviewDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setReviewDialog({ open: false, application: null, action: "approve" });
            setNote("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewDialog.action === "approve" ? "Godkend ansøgning" : "Afvis ansøgning"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {reviewDialog.application && (
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-medium">
                  {reviewDialog.application.employee?.first_name}{" "}
                  {reviewDialog.application.employee?.last_name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {reviewDialog.application.booking?.location?.name} -{" "}
                  {format(parseISO(reviewDialog.application.booking?.start_date), "d. MMMM yyyy", {
                    locale: da,
                  })}
                </p>
              </div>
            )}

            {reviewDialog.action === "approve" && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="createAssignment"
                  checked={createAssignment}
                  onCheckedChange={(checked) => setCreateAssignment(!!checked)}
                />
                <label htmlFor="createAssignment" className="text-sm cursor-pointer">
                  Opret vagt automatisk i medarbejderens kalender
                </label>
              </div>
            )}

            <div>
              <label className="text-sm font-medium">Note (valgfri)</label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  reviewDialog.action === "approve"
                    ? "Evt. besked til medarbejderen..."
                    : "Grund til afvisning..."
                }
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReviewDialog({ open: false, application: null, action: "approve" })}
            >
              Annuller
            </Button>
            <Button
              onClick={handleReview}
              disabled={reviewMutation.isPending}
              className={
                reviewDialog.action === "approve"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              }
            >
              {reviewMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : reviewDialog.action === "approve" ? (
                <Check className="h-4 w-4 mr-2" />
              ) : (
                <X className="h-4 w-4 mr-2" />
              )}
              {reviewDialog.action === "approve" ? "Godkend" : "Afvis"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
