import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Check, X, FileText, ArrowLeft, Clock, Download, Loader2, PenLine, Shield, Building2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type ContractStatus = "draft" | "pending_employee" | "pending_manager" | "signed" | "rejected" | "expired";

const statusConfig: Record<ContractStatus, { label: string; color: string; bgColor: string; borderColor: string }> = {
  draft: { label: "Kladde", color: "text-gray-600", bgColor: "bg-gray-50", borderColor: "border-gray-200" },
  pending_employee: { label: "Afventer underskrift", color: "text-amber-700", bgColor: "bg-amber-50", borderColor: "border-amber-200" },
  pending_manager: { label: "Afventer godkendelse", color: "text-blue-700", bgColor: "bg-blue-50", borderColor: "border-blue-200" },
  signed: { label: "Underskrevet", color: "text-emerald-700", bgColor: "bg-emerald-50", borderColor: "border-emerald-200" },
  rejected: { label: "Afvist", color: "text-red-700", bgColor: "bg-red-50", borderColor: "border-red-200" },
  expired: { label: "Udløbet", color: "text-gray-600", bgColor: "bg-gray-50", borderColor: "border-gray-200" },
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
    signSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleDownloadPdf = async () => {
    if (!id) return;
    setDownloadingPdf(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-contract-pdf", {
        body: { contractId: id },
      });
      
      if (error) throw error;
      if (!data?.pdf) throw new Error("No PDF data received");

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

  const { data: contract, isLoading } = useQuery({
    queryKey: ["contract", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select(`*, signatures:contract_signatures(*)`)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

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

  const signMutation = useMutation({
    mutationFn: async () => {
      if (!contract || !currentEmployee) return;

      const signature = contract.signatures?.find(
        (s: any) => s.signer_employee_id === currentEmployee.id && !s.signed_at
      );

      if (!signature) throw new Error("Ingen ventende underskrift fundet");

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

      const allSigned = contract.signatures?.every(
        (s: any) => s.id === signature.id || s.signed_at
      );

      const newStatus = allSigned ? "signed" : "pending_manager";
      const { error: contractError } = await supabase
        .from("contracts")
        .update({ status: newStatus })
        .eq("id", contract.id);

      if (contractError) throw contractError;

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
      } catch (emailError) {
        console.error("Could not send confirmation email:", emailError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract", id] });
      queryClient.invalidateQueries({ queryKey: ["my-contracts"] });
      toast.success("Kontrakt underskrevet! Bekræftelse sendt til din email.");
    },
    onError: () => toast.error("Kunne ikke underskrive kontrakt"),
  });

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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin" />
          <p className="text-slate-500 text-sm">Henter kontrakt...</p>
        </div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-6">
            <FileText className="h-8 w-8 text-slate-400" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Kontrakt ikke fundet</h2>
          <p className="text-slate-500 mb-6">
            Kontrakten eksisterer ikke eller du har ikke adgang til den.
          </p>
          <Button onClick={() => navigate("/auth")} className="w-full">
            Log ind
          </Button>
        </div>
      </div>
    );
  }

  const mySignature = contract.signatures?.find(
    (s: any) => s.signer_employee_id === currentEmployee?.id
  );
  const canSign = user && contract.status === "pending_employee" && mySignature && !mySignature.signed_at;
  const alreadySigned = mySignature?.signed_at;
  const needsLogin = !user && contract.status === "pending_employee";
  const status = statusConfig[contract.status as ContractStatus];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* Floating Header */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-slate-200/50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {user && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 -ml-2"
                onClick={() => navigate("/my-contracts")}
              >
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Tilbage
              </Button>
            )}
            <div className="h-5 w-px bg-slate-200" />
            <Badge variant="outline" className={`${status.bgColor} ${status.color} ${status.borderColor} font-medium`}>
              {status.label}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {canSign && (
              <Button
                size="sm"
                onClick={scrollToSignSection}
                className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-emerald-500/40"
              >
                <PenLine className="h-4 w-4 mr-1.5" />
                Underskriv
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="border-slate-200 text-slate-600 hover:bg-slate-50"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
            >
              {downloadingPdf ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Contract Header Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 px-8 py-6 text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0aDR2MWgtNHpNMzYgMjRoNHYxaC00ek0yNiAzNGg0djFoLTR6TTI2IDI0aDR2MWgtNHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-50" />
            <div className="relative flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                  <Building2 className="h-4 w-4" />
                  <span>Copenhagen Sales</span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight">{contract.title}</h1>
                {contract.sent_at && (
                  <p className="text-slate-400 text-sm mt-2">
                    Udsendt {format(new Date(contract.sent_at), "d. MMMM yyyy", { locale: da })}
                  </p>
                )}
              </div>
              {contract.status === "signed" && (
                <div className="flex-shrink-0 transform rotate-[-8deg]">
                  <div className="w-24 h-24 rounded-full border-[3px] border-emerald-400/60 flex items-center justify-center bg-emerald-500/10 backdrop-blur">
                    <div className="text-center">
                      <Check className="h-6 w-6 text-emerald-400 mx-auto mb-0.5" />
                      <span className="text-emerald-400 text-[10px] font-bold tracking-wider block">GODKENDT</span>
                      <span className="text-emerald-400/70 text-[8px]">
                        {format(new Date(), "dd.MM.yy")}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Contract Content */}
          <div className="p-8 md:p-12">
            <div
              className="prose prose-slate max-w-none
                prose-headings:font-semibold prose-headings:text-slate-900
                prose-h1:text-2xl prose-h1:text-center prose-h1:mb-8 prose-h1:pb-4 prose-h1:border-b prose-h1:border-slate-200
                prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4
                prose-h3:text-lg prose-h3:mt-8
                prose-p:text-slate-600 prose-p:leading-relaxed
                prose-strong:text-slate-900 prose-strong:font-semibold
                prose-ul:my-4 prose-li:text-slate-600 prose-li:my-1
                [&_table]:w-full [&_table]:border-collapse [&_table]:my-6 [&_table]:text-sm [&_table]:rounded-lg [&_table]:overflow-hidden
                [&_th]:bg-slate-50 [&_th]:text-left [&_th]:px-4 [&_th]:py-3 [&_th]:font-semibold [&_th]:text-slate-700 [&_th]:border-b [&_th]:border-slate-200
                [&_td]:px-4 [&_td]:py-3 [&_td]:border-b [&_td]:border-slate-100 [&_td]:text-slate-600
                [&_tr:last-child_td]:border-b-0
                [&_td:first-child]:font-medium [&_td:first-child]:text-slate-700 [&_td:first-child]:w-48"
              dangerouslySetInnerHTML={{ __html: contract.content }}
            />
          </div>
        </div>

        {/* Signatures Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Shield className="h-4 w-4 text-slate-400" />
              Underskrifter
            </h2>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {contract.signatures?.map((sig: any) => (
                <div
                  key={sig.id}
                  className={`flex items-center justify-between p-4 rounded-xl transition-all ${
                    sig.signed_at 
                      ? 'bg-emerald-50/50 border border-emerald-100' 
                      : 'bg-slate-50 border border-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center text-sm font-bold ${
                      sig.signed_at 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-slate-200 text-slate-500'
                    }`}>
                      {sig.signer_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{sig.signer_name}</p>
                      <p className="text-sm text-slate-500">
                        {sig.signer_type === "employee" ? "Medarbejder" : "For arbejdsgiver"}
                      </p>
                    </div>
                  </div>
                  {sig.signed_at ? (
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-medium text-emerald-700">Underskrevet</p>
                        <p className="text-xs text-slate-500">
                          {format(new Date(sig.signed_at), "d. MMM yyyy 'kl.' HH:mm", { locale: da })}
                        </p>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                        <Check className="h-5 w-5 text-white" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-amber-600 font-medium">Afventer</span>
                      <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-amber-500" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sign Section */}
        {canSign && (
          <div 
            ref={signSectionRef}
            className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 rounded-2xl shadow-2xl shadow-emerald-500/30 overflow-hidden"
          >
            <div className="p-8 md:p-10">
              <div className="flex items-start gap-5 mb-8">
                <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0">
                  <PenLine className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Underskriv kontrakt</h2>
                  <p className="text-emerald-100 mt-1">Bekræft din accept af kontraktens vilkår og betingelser</p>
                </div>
              </div>

              <div 
                className={`p-5 rounded-xl cursor-pointer transition-all ${
                  accepted 
                    ? 'bg-white shadow-xl' 
                    : 'bg-white/10 backdrop-blur hover:bg-white/20'
                }`}
                onClick={() => setAccepted(!accepted)}
              >
                <div className="flex items-start gap-4">
                  <div className={`mt-0.5 h-7 w-7 rounded-lg border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                    accepted 
                      ? 'border-emerald-500 bg-emerald-500' 
                      : 'border-white/50 bg-transparent'
                  }`}>
                    {accepted && <Check className="h-4 w-4 text-white" />}
                  </div>
                  <div>
                    <p className={`font-semibold ${accepted ? 'text-slate-900' : 'text-white'}`}>
                      Jeg accepterer kontraktens betingelser
                    </p>
                    <p className={`text-sm mt-1 ${accepted ? 'text-slate-500' : 'text-emerald-100'}`}>
                      Ved at markere denne boks bekræfter jeg, at jeg har læst og forstået indholdet af denne kontrakt.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  size="lg"
                  className={`flex-1 h-14 text-base font-semibold transition-all ${
                    accepted 
                      ? 'bg-white text-emerald-600 hover:bg-emerald-50 shadow-xl' 
                      : 'bg-white/20 text-white/60 cursor-not-allowed'
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
                  variant="ghost"
                  className="h-14 px-6 text-white/80 hover:text-white hover:bg-white/10"
                  onClick={() => setRejectDialogOpen(true)}
                  disabled={rejectMutation.isPending}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <p className="text-xs text-center text-emerald-200 mt-6">
                <Shield className="h-3 w-3 inline mr-1" />
                Din underskrift registreres sikkert med tidsstempel og IP-adresse
              </p>
            </div>
          </div>
        )}

        {/* Login prompt */}
        {needsLogin && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <PenLine className="h-7 w-7 text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Log ind for at underskrive</h3>
            <p className="text-slate-600 mb-6">Du skal være logget ind for at underskrive denne kontrakt</p>
            <Button onClick={() => navigate(`/auth?redirect=/contract/${id}`)} size="lg">
              Log ind
            </Button>
          </div>
        )}

        {/* Already signed */}
        {alreadySigned && (
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-8">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center">
                <Check className="h-7 w-7 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-emerald-900">Du har underskrevet denne kontrakt</h3>
                <p className="text-emerald-700">
                  {format(new Date(alreadySigned), "d. MMMM yyyy 'kl.' HH:mm", { locale: da })}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reject Dialog */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Afvis kontrakt</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på, at du vil afvise denne kontrakt? Din arbejdsgiver vil blive informeret.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => rejectMutation.mutate()}
            >
              Afvis kontrakt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}