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
import { Check, X, FileText, ArrowLeft, Clock, Download, Loader2, PenLine } from "lucide-react";
import { useRef } from "react";
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
  const signSectionRef = useRef<HTMLDivElement>(null);

  const scrollToSignSection = () => {
    signSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

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

      // Fetch real IP address
      let ipAddress = "Ukendt";
      try {
        const ipResponse = await fetch("https://api.ipify.org?format=json");
        if (ipResponse.ok) {
          const ipData = await ipResponse.json();
          ipAddress = ipData.ip;
        }
      } catch (ipError) {
        console.error("Could not fetch IP address:", ipError);
      }

      const signedAt = new Date().toISOString();

      // Update signature with real IP and timestamp
      const { error: sigError } = await supabase
        .from("contract_signatures")
        .update({
          signed_at: signedAt,
          acceptance_text: "Jeg har læst og accepterer betingelserne i denne kontrakt.",
          ip_address: ipAddress,
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

      // Send confirmation email with contract copy
      try {
        await supabase.functions.invoke("send-contract-signed-confirmation", {
          body: {
            contractId: contract.id,
            employeeName: `${currentEmployee.first_name} ${currentEmployee.last_name}`,
            employeeEmail: currentEmployee.private_email,
            contractTitle: contract.title,
            signedAt: signedAt,
            ipAddress: ipAddress,
          },
        });
        console.log("Confirmation email sent");
      } catch (emailError) {
        console.error("Could not send confirmation email:", emailError);
        // Don't fail the whole operation if email fails
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract", id] });
      queryClient.invalidateQueries({ queryKey: ["my-contracts"] });
      toast.success("Kontrakt underskrevet! Bekræftelse sendt til din email.");
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
      <div className="min-h-screen bg-white light flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="min-h-screen bg-white light flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-white border-gray-200">
          <CardContent className="py-8 text-center">
            <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h2 className="text-xl font-semibold mb-2 text-gray-900">Kontrakt ikke fundet</h2>
            <p className="text-gray-500 mb-4">
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
    <div className="min-h-screen bg-gray-50 light">
      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {user ? (
              <Button variant="ghost" size="sm" className="text-gray-600 hover:bg-gray-200" onClick={() => navigate("/my-contracts")}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Tilbage
              </Button>
            ) : null}
            <Badge
              variant="outline"
              className={
                contract.status === "signed"
                  ? "bg-green-50 text-green-700 border-green-200"
                  : contract.status === "pending_employee"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : contract.status === "rejected"
                  ? "bg-red-50 text-red-700 border-red-200"
                  : "bg-gray-50 text-gray-700 border-gray-200"
              }
            >
              {statusLabels[contract.status as ContractStatus]}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {canSign && (
              <Button
                size="sm"
                onClick={scrollToSignSection}
                className="bg-green-600 hover:bg-green-700 text-white shadow-sm"
              >
                <PenLine className="h-4 w-4 mr-2" />
                Underskriv nu
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="border-gray-300 text-gray-700 hover:bg-white"
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
          </div>
        </div>

        {/* Contract Document */}
        <Card className="bg-white border-gray-200 shadow-lg relative overflow-hidden">
          {/* Official stamp overlay when signed */}
          {contract.status === "signed" && (
            <div className="absolute top-6 right-6 z-10 pointer-events-none">
              <div className="relative transform rotate-[-12deg]">
                <div className="w-28 h-28 rounded-full border-[3px] border-green-600/80 flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full border-[2px] border-green-600/60 flex flex-col items-center justify-center bg-white/95">
                    <span className="text-green-600 font-bold text-[9px] tracking-widest">COPENHAGEN</span>
                    <span className="text-green-600 font-bold text-[9px] tracking-widest">SALES</span>
                    <div className="w-12 h-0.5 bg-green-600/60 my-0.5" />
                    <span className="text-green-700 font-black text-xs">GODKENDT</span>
                    <div className="w-12 h-0.5 bg-green-600/60 my-0.5" />
                    <span className="text-green-600 text-[8px] font-medium">
                      {format(new Date(), "dd.MM.yyyy")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Document Header */}
          <div className="border-b border-gray-100 px-6 md:px-10 py-6 bg-gray-50/50">
            <h1 className="text-xl md:text-2xl font-semibold text-gray-900">{contract.title}</h1>
            {contract.sent_at && (
              <p className="text-sm text-gray-500 mt-1">
                Udsendt {format(new Date(contract.sent_at), "d. MMMM yyyy", { locale: da })}
              </p>
            )}
          </div>
          
          {/* Document Content */}
          <CardContent className="p-6 md:p-10">
            <div
              className="prose prose-sm md:prose-base max-w-none text-gray-800 
                prose-headings:text-gray-900 prose-headings:font-semibold prose-headings:mt-8 prose-headings:mb-4
                prose-h1:text-xl prose-h1:text-center prose-h1:mb-6 prose-h1:mt-0
                prose-h2:text-lg prose-h2:border-b prose-h2:border-gray-200 prose-h2:pb-2
                prose-h3:text-base
                prose-p:leading-relaxed prose-p:text-gray-700
                prose-strong:text-gray-900 prose-strong:font-semibold
                prose-ul:my-4 prose-li:my-1
                [&_table]:w-full [&_table]:border-collapse [&_table]:my-4 [&_table]:text-sm
                [&_th]:bg-gray-50 [&_th]:text-left [&_th]:p-3 [&_th]:font-semibold [&_th]:border [&_th]:border-gray-200
                [&_td]:p-3 [&_td]:border [&_td]:border-gray-200 [&_td]:align-top
                [&_td:first-child]:font-medium [&_td:first-child]:text-gray-900 [&_td:first-child]:w-48
                [&_.placeholder]:text-amber-600 [&_.placeholder]:bg-amber-50 [&_.placeholder]:px-1 [&_.placeholder]:rounded"
              dangerouslySetInnerHTML={{ __html: contract.content }}
            />
          </CardContent>
        </Card>

        {/* Signatures section */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-500" />
              Underskrifter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-gray-100">
              {contract.signatures?.map((sig: any) => (
                <div
                  key={sig.id}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium ${
                      sig.signed_at 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {sig.signer_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{sig.signer_name}</p>
                      <p className="text-xs text-gray-500">
                        {sig.signer_type === "employee" ? "Medarbejder" : "Leder"}
                      </p>
                    </div>
                  </div>
                  {sig.signed_at ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center">
                        <Check className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-xs text-gray-500">
                        {format(new Date(sig.signed_at), "d. MMM yyyy 'kl.' HH:mm", { locale: da })}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-amber-100 flex items-center justify-center">
                        <Clock className="h-3.5 w-3.5 text-amber-600" />
                      </div>
                      <span className="text-xs text-amber-600 font-medium">Afventer</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Sign section */}
        {canSign && (
          <Card ref={signSectionRef} className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white shadow-lg">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                  <PenLine className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-xl text-gray-900">Underskriv kontrakt</CardTitle>
                  <p className="text-sm text-gray-500 mt-0.5">Bekræft din accept af kontraktens betingelser</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div 
                className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                  accepted 
                    ? 'border-green-500 bg-green-50' 
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                }`}
                onClick={() => setAccepted(!accepted)}
              >
                <div className="flex items-start gap-4">
                  <div className={`mt-0.5 h-6 w-6 rounded-md border-2 flex items-center justify-center transition-all ${
                    accepted 
                      ? 'border-green-500 bg-green-500' 
                      : 'border-gray-300 bg-white'
                  }`}>
                    {accepted && <Check className="h-4 w-4 text-white" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Jeg accepterer kontraktens betingelser</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Ved at markere denne boks bekræfter jeg, at jeg har læst og forstået indholdet af denne kontrakt og accepterer hermed alle betingelser.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  size="lg"
                  className={`flex-1 h-14 text-base font-semibold transition-all ${
                    accepted 
                      ? 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-200' 
                      : 'bg-gray-300 cursor-not-allowed'
                  }`}
                  disabled={!accepted || signMutation.isPending}
                  onClick={() => signMutation.mutate()}
                >
                  {signMutation.isPending ? (
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  ) : (
                    <Check className="h-5 w-5 mr-2" />
                  )}
                  Underskriv kontrakt
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 px-6 border-gray-300 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  onClick={() => setRejectDialogOpen(true)}
                  disabled={rejectMutation.isPending}
                >
                  <X className="h-5 w-5 mr-2" />
                  Afvis
                </Button>
              </div>

              <p className="text-xs text-center text-gray-400">
                Din underskrift registreres med tidsstempel og IP-adresse
              </p>
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
