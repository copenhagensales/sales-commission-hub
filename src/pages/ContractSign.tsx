import { useState, useRef, useEffect, useCallback } from "react";
import DOMPurify from "dompurify";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Check, X, FileText, ArrowLeft, Clock, Download, Loader2, PenLine, Shield, Building2, ChevronDown, Eye, FileCheck, Pen, User } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { CONTRACT_PROSE_CLASSES, CONTRACT_PROSE_SIGN_CLASSES } from "@/utils/contractProseStyles";
import { logContractAccess } from "@/hooks/useLogContractAccess";

type ContractStatus = "draft" | "pending_employee" | "pending_manager" | "signed" | "rejected" | "expired";

const statusConfig: Record<ContractStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Kladde", variant: "secondary" },
  pending_employee: { label: "Afventer underskrift", variant: "outline" },
  pending_manager: { label: "Afventer godkendelse", variant: "outline" },
  signed: { label: "Underskrevet", variant: "default" },
  rejected: { label: "Afvist", variant: "destructive" },
  expired: { label: "Udløbet", variant: "secondary" },
};

/* ─── Progress Stepper ─── */
interface StepperStep {
  label: string;
  icon: React.ReactNode;
  done: boolean;
  active: boolean;
}

function ContractProgressStepper({ steps }: { steps: StepperStep[] }) {
  return (
    <div className="flex items-center justify-between w-full max-w-xl mx-auto">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-initial">
          <div className="flex flex-col items-center gap-1.5 relative z-10">
            <div
              className={`h-9 w-9 rounded-full flex items-center justify-center transition-all duration-300 ${
                step.done
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                  : step.active
                  ? "bg-primary/20 text-primary border-2 border-primary"
                  : "bg-muted text-muted-foreground border border-border"
              }`}
            >
              {step.done ? <Check className="h-4 w-4" /> : step.icon}
            </div>
            <span
              className={`text-[11px] font-medium whitespace-nowrap ${
                step.done ? "text-primary" : step.active ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className="flex-1 mx-2 mt-[-18px]">
              <div
                className={`h-[2px] w-full rounded-full transition-all duration-500 ${
                  step.done ? "bg-primary" : "bg-border"
                }`}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ContractSign() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [accepted, setAccepted] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [signSectionVisible, setSignSectionVisible] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const signSectionRef = useRef<HTMLDivElement>(null);
  const contentEndRef = useRef<HTMLDivElement>(null);

  const scrollToSignSection = () => {
    signSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  /* ─── Scroll progress tracking ─── */
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        setScrollProgress(Math.min(100, (scrollTop / docHeight) * 100));
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  /* ─── Scroll tracking: detect when user scrolls to bottom of contract ─── */
  useEffect(() => {
    if (!contentEndRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setHasScrolledToBottom(true);
      },
      { threshold: 0.5 }
    );
    observer.observe(contentEndRef.current);
    return () => observer.disconnect();
  }, []);

  /* ─── Detect if sign section is visible ─── */
  useEffect(() => {
    if (!signSectionRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setSignSectionVisible(entry.isIntersecting),
      { threshold: 0.1 }
    );
    observer.observe(signSectionRef.current);
    return () => observer.disconnect();
  }, []);



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
      if (contract?.employee_id) {
        logContractAccess(id, contract.employee_id, "download");
      }
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

  /* ─── Log contract access (view) ─── */
  useEffect(() => {
    if (contract?.id && contract?.employee_id) {
      logContractAccess(contract.id, contract.employee_id, "view");
    }
  }, [contract?.id, contract?.employee_id]);

  const { data: currentEmployee } = useQuery({
    queryKey: ["current-employee-for-contract"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      
      const lowerEmail = userData.user.email?.toLowerCase() || '';
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, private_email")
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
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

      return { signedAt, ipAddress };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["contract", id] });
      toast.success("Kontrakten er underskrevet");
      window.scrollTo({ top: 0, behavior: "smooth" });

      // Fire-and-forget: send confirmation email with contract copy
      if (result && contract) {
        const signerName = contract.signatures?.find(
          (s: any) => s.signer_employee_id === currentEmployee?.id
        )?.signer_name || `${currentEmployee?.first_name || ""} ${currentEmployee?.last_name || ""}`.trim() || "Medarbejder";

        supabase.functions
          .invoke("send-contract-signed-confirmation", {
            body: {
              contractId: contract.id,
              employeeName: signerName,
              employeeEmail: currentEmployee?.private_email || "",
              contractTitle: contract.title,
              signedAt: result.signedAt,
              ipAddress: result.ipAddress,
              isConfidential: contract.is_confidential || false,
            },
          })
          .then(({ error }) => {
            if (error) console.error("Email confirmation error:", error);
            else console.log("Contract confirmation email sent");
          })
          .catch((err) => console.error("Email confirmation error:", err));
      }
    },
    onError: (err: any) => {
      console.error("Sign error:", err);
      toast.error("Kunne ikke underskrive kontrakten");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("contracts")
        .update({ status: "rejected" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract", id] });
      setRejectDialogOpen(false);
      toast.success("Kontrakten er afvist");
    },
    onError: () => {
      toast.error("Kunne ikke afvise kontrakten");
    },
  });

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">Henter kontrakt...</p>
        </div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card rounded-2xl shadow-xl p-8 text-center border border-border">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Kontrakt ikke fundet</h2>
          <p className="text-muted-foreground mb-6">
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
  const isSigned = contract.status === "signed";

  /* ─── Stepper state ─── */
  const stepperSteps: StepperStep[] = [
    { label: "Modtaget", icon: <FileText className="h-4 w-4" />, done: true, active: false },
    { label: "Gennemlæst", icon: <Eye className="h-4 w-4" />, done: hasScrolledToBottom || isSigned || !!alreadySigned, active: !hasScrolledToBottom && !isSigned && !alreadySigned },
    { label: "Accepteret", icon: <FileCheck className="h-4 w-4" />, done: accepted || isSigned || !!alreadySigned, active: hasScrolledToBottom && !accepted && !isSigned && !alreadySigned },
    { label: "Underskrevet", icon: <Pen className="h-4 w-4" />, done: isSigned || !!alreadySigned, active: accepted && !isSigned && !alreadySigned },
  ];

  /* ─── Metadata grid ─── */
  const metadataItems: { label: string; value: string; icon: React.ReactNode }[] = [];
  if (contract.sent_at) {
    metadataItems.push({ label: "Udsendt", value: format(new Date(contract.sent_at), "d. MMM yyyy", { locale: da }), icon: <Clock className="h-3.5 w-3.5" /> });
  }
  metadataItems.push({ label: "Status", value: status.label, icon: <FileCheck className="h-3.5 w-3.5" /> });
  if (contract.type) {
    metadataItems.push({ label: "Type", value: contract.type, icon: <FileText className="h-3.5 w-3.5" /> });
  }
  const senderSig = contract.signatures?.find((s: any) => s.signer_type === "manager");
  if (senderSig?.signer_name) {
    metadataItems.push({ label: "Afsender", value: senderSig.signer_name, icon: <User className="h-3.5 w-3.5" /> });
  }

  return (
    <div className={`min-h-screen bg-muted/30 ${canSign && isMobile ? "pb-28" : ""}`}>
      {/* ═══ Sticky Header + Progress Bar ═══ */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            {user && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-muted-foreground hover:text-foreground -ml-2 flex-shrink-0"
                onClick={() => navigate("/my-contracts")}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline text-xs">Tilbage</span>
              </Button>
            )}
            <div className="h-4 w-px bg-border flex-shrink-0" />
            <Badge variant={status.variant} className="flex-shrink-0 text-[10px]">
              {status.label}
            </Badge>
            <span className="text-xs text-muted-foreground truncate hidden md:inline">
              {contract.title}
            </span>
            {metadataItems.filter(m => m.label === "Udsendt" || m.label === "Afsender").map((item, i) => (
              <span key={i} className="text-[11px] text-muted-foreground hidden lg:inline-flex items-center gap-1">
                <span className="text-border">·</span>
                {item.icon}
                {item.value}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {canSign && !isMobile && (
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={scrollToSignSection}
              >
                <PenLine className="h-3.5 w-3.5 mr-1" />
                Underskriv
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
            >
              {downloadingPdf ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
        <div className="h-[2px] bg-muted/40 w-full">
          <div
            className="h-full bg-primary/60 transition-all duration-150 ease-out"
            style={{ width: `${scrollProgress}%` }}
          />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* ═══ Compact Progress Stepper ═══ */}
        <div className="py-3">
          <ContractProgressStepper steps={stepperSteps} />
        </div>

        {/* ═══ Contract Document – formal white paper ═══ */}
        <div className="bg-white rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.12)] border border-neutral-200 overflow-hidden">
          {/* Document header inside paper */}
          <div className="px-8 md:px-12 lg:px-16 pt-10 pb-0">
            <div className="flex items-center gap-2 text-neutral-400 text-xs mb-3 tracking-wide uppercase">
              <Building2 className="h-3.5 w-3.5" />
              <span>Copenhagen Sales</span>
              {isSigned && (
                <>
                  <span className="text-neutral-300">·</span>
                  <span className="text-emerald-600 font-semibold inline-flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    Godkendt
                  </span>
                </>
              )}
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-neutral-900 mb-0">{contract.title}</h1>
          </div>

          {/* Contract prose content */}
          <div className="px-8 md:px-12 lg:px-16 py-8">
            <div
              className={CONTRACT_PROSE_SIGN_CLASSES}
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(contract.content || "") }}
            />
            {/* Invisible sentinel for scroll tracking */}
            <div ref={contentEndRef} className="h-px" />
          </div>
        </div>

        {/* ═══ Signatures Card ═══ */}
        <div className="bg-card rounded-2xl shadow-lg overflow-hidden border border-border">
          <div className="px-6 py-4 border-b border-border bg-muted/50">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              Underskrifter
            </h2>
          </div>
          <div className="p-6">
            {isSigned || contract.signatures?.every((s: any) => s.signed_at) ? (
              /* ─── Grid layout for fully signed contracts ─── */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {contract.signatures?.map((sig: any) => (
                  <div key={sig.id} className="rounded-xl border border-primary/20 bg-primary/5 p-5 relative overflow-hidden">
                    <div className="absolute top-2 right-2">
                      <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <Check className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                        {sig.signer_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-sm">{sig.signer_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {sig.signer_type === "employee" ? "Medarbejder" : "For arbejdsgiver"}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground border-t border-border/50 pt-3 mt-1">
                      <p>
                        <span className="font-medium text-foreground/70">Dato:</span>{" "}
                        {sig.signed_at ? format(new Date(sig.signed_at), "d. MMM yyyy 'kl.' HH:mm", { locale: da }) : "–"}
                      </p>
                      {sig.ip_address && (
                        <p>
                          <span className="font-medium text-foreground/70">IP:</span> {sig.ip_address}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* ─── Timeline layout for pending contracts ─── */
              <div className="relative">
                {contract.signatures && contract.signatures.length > 1 && (
                  <div className="absolute left-6 top-6 bottom-6 w-px bg-border" />
                )}
                <div className="space-y-0">
                  {contract.signatures?.map((sig: any) => (
                    <div key={sig.id} className="relative flex items-start gap-5 py-4">
                      <div className={`relative z-10 h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                        sig.signed_at 
                          ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' 
                          : 'bg-muted border-2 border-border text-muted-foreground'
                      }`}>
                        {sig.signed_at ? (
                          <Check className="h-5 w-5" />
                        ) : (
                          <span className="text-sm font-bold">
                            {sig.signer_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="font-semibold text-foreground">{sig.signer_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {sig.signer_type === "employee" ? "Medarbejder" : "For arbejdsgiver"}
                            </p>
                          </div>
                          {sig.signed_at ? (
                            <div className="text-right flex-shrink-0">
                              <p className="text-sm font-medium text-primary">Underskrevet</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(sig.signed_at), "d. MMM yyyy 'kl.' HH:mm", { locale: da })}
                              </p>
                              {sig.ip_address && (
                                <p className="text-xs text-muted-foreground/70 mt-0.5">
                                  IP: {sig.ip_address}
                                </p>
                              )}
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground border-border flex-shrink-0">
                              <Clock className="h-3 w-3 mr-1" />
                              Afventer
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ Sign Section ═══ */}
        {canSign && (
          <div 
            ref={signSectionRef}
            className="relative overflow-hidden rounded-2xl shadow-2xl border-2 border-emerald-500/30"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600" />
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wOCI+PHBhdGggZD0iTTM2IDM0aDR2MWgtNHpNMzYgMjRoNHYxaC00ek0yNiAzNGg0djFoLTR6TTI2IDI0aDR2MWgtNHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-50" />
            
            <div className="relative p-8 md:p-10">
              <div className="flex items-start gap-5 mb-8">
                <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 shadow-lg">
                  <PenLine className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white drop-shadow-sm">Underskriv kontrakt</h2>
                  <p className="text-white/90 mt-1">Bekræft din accept af kontraktens vilkår og betingelser</p>
                </div>
              </div>

              <div 
                className={`p-5 rounded-xl cursor-pointer transition-all duration-300 ${
                  accepted 
                    ? 'bg-white shadow-2xl scale-[1.02]' 
                    : 'bg-white/15 backdrop-blur-sm hover:bg-white/25 border border-white/20'
                }`}
                onClick={() => setAccepted(!accepted)}
              >
                <div className="flex items-start gap-4">
                  <div className={`mt-0.5 h-7 w-7 rounded-lg border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                    accepted 
                      ? 'border-emerald-500 bg-emerald-500' 
                      : 'border-white/60 bg-transparent'
                  }`}>
                    {accepted && <Check className="h-4 w-4 text-white" />}
                  </div>
                  <div>
                    <p className={`font-semibold ${accepted ? 'text-gray-900' : 'text-white'}`}>
                      Jeg accepterer kontraktens betingelser
                    </p>
                    <p className={`text-sm mt-1 ${accepted ? 'text-gray-600' : 'text-white/80'}`}>
                      Ved at markere denne boks bekræfter jeg, at jeg har læst og forstået indholdet af denne kontrakt.
                    </p>
                  </div>
                </div>
              </div>

              {!isMobile && (
                <div className="flex gap-3 mt-6">
                  <Button
                    size="lg"
                    className={`flex-1 h-14 text-base font-bold transition-all duration-300 ${
                      accepted 
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 shadow-2xl shadow-orange-500/30 hover:scale-[1.02]' 
                        : 'bg-white/20 text-white/50 cursor-not-allowed border border-white/20'
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
                    className="h-14 px-6 text-white/80 hover:text-white hover:bg-red-500/20 border border-white/20 hover:border-red-300/50"
                    onClick={() => setRejectDialogOpen(true)}
                    disabled={rejectMutation.isPending}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              )}

              <p className="text-xs text-center text-white/70 mt-6">
                <Shield className="h-3 w-3 inline mr-1" />
                Din underskrift registreres sikkert med tidsstempel og IP-adresse
              </p>
            </div>
          </div>
        )}

        {/* Login prompt */}
        {needsLogin && (
          <div className="bg-warning/10 border border-warning/30 rounded-2xl p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-warning/20 flex items-center justify-center mx-auto mb-4">
              <PenLine className="h-7 w-7 text-warning" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Log ind for at underskrive</h3>
            <p className="text-muted-foreground mb-6">Du skal være logget ind for at underskrive denne kontrakt</p>
            <Button onClick={() => navigate(`/auth?redirect=/contract/${id}`)} size="lg">
              Log ind
            </Button>
          </div>
        )}

        {/* Already signed */}
        {alreadySigned && (
          <div className="bg-primary/10 border border-primary/30 rounded-2xl p-8">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-primary/20 flex items-center justify-center">
                <Check className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Du har underskrevet denne kontrakt</h3>
                <p className="text-muted-foreground">
                  {format(new Date(alreadySigned), "d. MMMM yyyy 'kl.' HH:mm", { locale: da })}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Mobile: Fixed Bottom Action Bar ═══ */}
      {canSign && isMobile && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-xl border-t border-border shadow-2xl shadow-black/20 p-4 safe-area-pb">
          <div className="flex items-center gap-3">
            <div 
              className={`flex items-center gap-2 flex-1 p-3 rounded-lg cursor-pointer transition-all ${
                accepted ? 'bg-primary/10 border border-primary/30' : 'bg-muted border border-border'
              }`}
              onClick={() => setAccepted(!accepted)}
            >
              <div className={`h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                accepted ? 'border-primary bg-primary' : 'border-muted-foreground/40'
              }`}>
                {accepted && <Check className="h-3 w-3 text-primary-foreground" />}
              </div>
              <span className={`text-xs font-medium ${accepted ? 'text-primary' : 'text-muted-foreground'}`}>
                Acceptér vilkår
              </span>
            </div>
            <Button
              className={`h-12 px-6 font-bold transition-all ${
                accepted 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg' 
                  : ''
              }`}
              disabled={!accepted || signMutation.isPending}
              onClick={() => signMutation.mutate()}
            >
              {signMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Pen className="h-4 w-4 mr-1.5" />
                  Underskriv
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12 text-destructive hover:bg-destructive/10 border border-border"
              onClick={() => setRejectDialogOpen(true)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

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
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
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
