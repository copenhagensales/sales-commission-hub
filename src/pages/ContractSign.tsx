import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Check, X, FileText, ArrowLeft, Clock, Download, Loader2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type ContractStatus = "draft" | "pending_employee" | "pending_manager" | "signed" | "rejected" | "expired";

const statusLabels: Record<ContractStatus, string> = {
  draft: "Kladde",
  pending_employee: "Afventer din underskrift",
  pending_manager: "Afventer leder",
  signed: "Underskrevet",
  rejected: "Afvist",
  expired: "Udløbet",
};

export default function ContractSign() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [accepted, setAccepted] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Download PDF function
  const handleDownloadPdf = async () => {
    if (!id) return;
    setDownloadingPdf(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-contract-pdf", {
        body: { contractId: id },
      });
      
      if (error) throw error;
      if (!data?.pdf) throw new Error("No PDF data received");

      // Convert base64 to blob and download
      const byteCharacters = atob(data.pdf);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = data.filename || "kontrakt.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success("PDF downloadet");
    } catch (err: any) {
      console.error("PDF download error:", err);
      toast.error("Kunne ikke generere PDF");
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Fetch contract with signatures
  const { data: contract, isLoading } = useQuery({
    queryKey: ["contract", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select(`
          *,
          signatures:contract_signatures(*)
        `)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Get current employee
  const { data: currentEmployee } = useQuery({
    queryKey: ["current-employee-for-contract"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, private_email")
        .eq("private_email", userData.user.email)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  // Sign contract mutation
  const signMutation = useMutation({
    mutationFn: async () => {
      if (!contract || !currentEmployee) return;

      // Find the signature record for this employee
      const signature = contract.signatures?.find(
        (s: any) => s.signer_employee_id === currentEmployee.id && !s.signed_at
      );

      if (!signature) throw new Error("Ingen ventende underskrift fundet");

      // Update signature
      const { error: sigError } = await supabase
        .from("contract_signatures")
        .update({
          signed_at: new Date().toISOString(),
          acceptance_text: "Jeg har læst og accepterer betingelserne i denne kontrakt.",
          ip_address: "N/A", // Could be fetched from API
          user_agent: navigator.userAgent,
        })
        .eq("id", signature.id);

      if (sigError) throw sigError;

      // Check if all signatures are complete
      const allSigned = contract.signatures?.every(
        (s: any) => s.id === signature.id || s.signed_at
      );

      // Update contract status
      const newStatus = allSigned ? "signed" : "pending_manager";
      const { error: contractError } = await supabase
        .from("contracts")
        .update({ status: newStatus })
        .eq("id", contract.id);

      if (contractError) throw contractError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract", id] });
      queryClient.invalidateQueries({ queryKey: ["my-contracts"] });
      toast.success("Kontrakt underskrevet!");
    },
    onError: () => toast.error("Kunne ikke underskrive kontrakt"),
  });

  // Reject contract mutation
  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!contract) return;
      
      const { error } = await supabase
        .from("contracts")
        .update({ status: "rejected" })
        .eq("id", contract.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract", id] });
      queryClient.invalidateQueries({ queryKey: ["my-contracts"] });
      toast.success("Kontrakt afvist");
      setRejectDialogOpen(false);
    },
    onError: () => toast.error("Kunne ikke afvise kontrakt"),
  });

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-8 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Kontrakt ikke fundet</h2>
            <p className="text-muted-foreground mb-4">
              Kontrakten eksisterer ikke eller du har ikke adgang til den.
            </p>
            <Button onClick={() => navigate("/auth")}>
              Log ind
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const mySignature = contract.signatures?.find(
    (s: any) => s.signer_employee_id === currentEmployee?.id
  );
  const canSign = user && contract.status === "pending_employee" && mySignature && !mySignature.signed_at;
  const alreadySigned = mySignature?.signed_at;
  const needsLogin = !user && contract.status === "pending_employee";

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          {user ? (
            <Button variant="ghost" onClick={() => navigate("/my-contracts")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Tilbage
            </Button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
            >
              {downloadingPdf ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Download PDF
            </Button>
            <Badge
              className={
                contract.status === "signed"
                  ? "bg-green-100 text-green-800"
                  : contract.status === "pending_employee"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-muted text-muted-foreground"
              }
            >
              {statusLabels[contract.status as ContractStatus]}
            </Badge>
            </div>
        </div>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle>{contract.title}</CardTitle>
            {contract.sent_at && (
              <p className="text-sm text-muted-foreground">
                Sendt {format(new Date(contract.sent_at), "d. MMMM yyyy", { locale: da })}
              </p>
            )}
          </CardHeader>
          <CardContent>
            <div
              className="prose prose-sm max-w-none text-black"
              dangerouslySetInnerHTML={{ __html: contract.content }}
            />
          </CardContent>
        </Card>

        {/* Signatures section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Underskrifter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {contract.signatures?.map((sig: any) => (
              <div
                key={sig.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div>
                  <p className="font-medium">{sig.signer_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {sig.signer_type === "employee" ? "Medarbejder" : "Leder"}
                  </p>
                </div>
                {sig.signed_at ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <Check className="h-5 w-5" />
                    <span className="text-sm">
                      {format(new Date(sig.signed_at), "d. MMM yyyy HH:mm", { locale: da })}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-amber-600">
                    <Clock className="h-5 w-5" />
                    <span className="text-sm">Afventer</span>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Sign section */}
        {canSign && (
          <Card className="border-primary">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="accept"
                  checked={accepted}
                  onCheckedChange={(checked) => setAccepted(checked === true)}
                />
                <label htmlFor="accept" className="text-sm leading-relaxed cursor-pointer">
                  Jeg har læst og forstået indholdet af denne kontrakt og accepterer hermed betingelserne.
                </label>
              </div>

              <div className="flex gap-3">
                <Button
                  className="flex-1"
                  disabled={!accepted || signMutation.isPending}
                  onClick={() => signMutation.mutate()}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Underskriv kontrakt
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setRejectDialogOpen(true)}
                  disabled={rejectMutation.isPending}
                >
                  <X className="h-4 w-4 mr-2" />
                  Afvis
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Login prompt for unauthenticated users */}
        {needsLogin && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <p className="text-amber-800 font-medium">
                  Log ind for at underskrive denne kontrakt
                </p>
                <Button onClick={() => navigate(`/auth?redirect=/contract/${id}`)}>
                  Log ind
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {alreadySigned && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-green-700">
                <Check className="h-6 w-6" />
                <div>
                  <p className="font-medium">Du har underskrevet denne kontrakt</p>
                  <p className="text-sm">
                    {format(new Date(alreadySigned), "d. MMMM yyyy 'kl.' HH:mm", { locale: da })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reject dialog */}
        <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Afvis kontrakt</AlertDialogTitle>
              <AlertDialogDescription>
                Er du sikker på, at du vil afvise denne kontrakt? Din arbejdsgiver vil blive informeret.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuller</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => rejectMutation.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Afvis kontrakt
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
