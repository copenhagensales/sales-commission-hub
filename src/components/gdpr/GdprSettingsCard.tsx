import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useGdprDataRequests, useRequestDataExport, useRequestDataDeletion, useGdprConsents } from "@/hooks/useGdpr";
import { Shield, Download, Trash2, FileText, Clock, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";

export function GdprSettingsCard() {
  const { toast } = useToast();
  const { data: requests = [] } = useGdprDataRequests();
  const { data: consents = [] } = useGdprConsents();
  const requestExport = useRequestDataExport();
  const requestDeletion = useRequestDataDeletion();

  const handleExportRequest = async () => {
    try {
      await requestExport.mutateAsync();
      toast({
        title: "Eksportanmodning sendt",
        description: "Din anmodning om dataeksport er blevet registreret. Du vil modtage en besked når data er klar.",
      });
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: error.message || "Kunne ikke sende eksportanmodning",
        variant: "destructive",
      });
    }
  };

  const handleDeletionRequest = async () => {
    try {
      await requestDeletion.mutateAsync();
      toast({
        title: "Sletteanmodning sendt",
        description: "Din anmodning om sletning af data er blevet registreret. Du vil blive kontaktet af HR.",
      });
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: error.message || "Kunne ikke sende sletteanmodning",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Afventer</Badge>;
      case "processing":
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Behandles</Badge>;
      case "completed":
        return <Badge className="gap-1 bg-green-500"><CheckCircle className="h-3 w-3" /> Færdig</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Afvist</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingExport = requests.find(r => r.request_type === "export" && r.status === "pending");
  const pendingDeletion = requests.find(r => r.request_type === "deletion" && r.status === "pending");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle>Persondata & GDPR</CardTitle>
        </div>
        <CardDescription>
          Administrer dine personoplysninger og GDPR-rettigheder
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Consent status */}
        <div className="space-y-2">
          <h4 className="font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Samtykke
          </h4>
          {consents.length > 0 ? (
            <div className="text-sm text-muted-foreground">
              Samtykke givet den{" "}
              {format(new Date(consents[0].consented_at), "d. MMMM yyyy 'kl.' HH:mm", { locale: da })}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Intet samtykke registreret</div>
          )}
        </div>

        {/* Export data */}
        <div className="space-y-2">
          <h4 className="font-medium flex items-center gap-2">
            <Download className="h-4 w-4" />
            Eksportér mine data
          </h4>
          <p className="text-sm text-muted-foreground">
            Download en komplet kopi af alle dine persondata i systemet.
          </p>
          <Button
            variant="outline"
            onClick={handleExportRequest}
            disabled={requestExport.isPending || !!pendingExport}
          >
            {requestExport.isPending ? "Sender..." : pendingExport ? "Anmodning afventer" : "Anmod om dataeksport"}
          </Button>
        </div>

        {/* Delete data */}
        <div className="space-y-2">
          <h4 className="font-medium flex items-center gap-2">
            <Trash2 className="h-4 w-4" />
            Slet mine data
          </h4>
          <p className="text-sm text-muted-foreground">
            Anmod om permanent sletning af dine persondata. Bemærk at visse data kan være underlagt lovpligtig opbevaring.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                disabled={requestDeletion.isPending || !!pendingDeletion}
              >
                {requestDeletion.isPending ? "Sender..." : pendingDeletion ? "Anmodning afventer" : "Anmod om datasletning"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
                <AlertDialogDescription>
                  Du er ved at anmode om sletning af alle dine persondata. Denne handling kan ikke fortrydes.
                  HR vil kontakte dig for at bekræfte anmodningen.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuller</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeletionRequest}>
                  Bekræft anmodning
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Request history */}
        {requests.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium">Anmodningshistorik</h4>
            <div className="space-y-2">
              {requests.slice(0, 5).map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-2 bg-muted/30 rounded-lg text-sm"
                >
                  <div className="flex items-center gap-2">
                    {request.request_type === "export" ? (
                      <Download className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span>
                      {request.request_type === "export" ? "Dataeksport" : "Datasletning"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {format(new Date(request.requested_at), "d. MMM yyyy", { locale: da })}
                    </span>
                    {getStatusBadge(request.status)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
