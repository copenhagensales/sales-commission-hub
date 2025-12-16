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

const statusConfig: Record<ContractStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Kladde", variant: "secondary" },
  pending_employee: { label: "Afventer underskrift", variant: "outline" },
  pending_manager: { label: "Afventer godkendelse", variant: "outline" },
  signed: { label: "Underskrevet", variant: "default" },
  rejected: { label: "Afvist", variant: "destructive" },
  expired: { label: "Udløbet", variant: "secondary" },
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract", id] });
      toast.success("Kontrakten er underskrevet");
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

  return (
    <div className="min-h-screen bg-background">
      {/* Floating Header */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {user && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-muted-foreground hover:text-foreground -ml-2"
                onClick={() => navigate("/my-contracts")}
              >
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Tilbage
              </Button>
            )}
            <div className="h-5 w-px bg-border" />
            <Badge variant={status.variant}>
              {status.label}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {canSign && (
              <Button
                size="sm"
                onClick={scrollToSignSection}
              >
                <PenLine className="h-4 w-4 mr-1.5" />
                Underskriv
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
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
        <div className="bg-card rounded-2xl shadow-xl overflow-hidden border border-border">
          <div className="bg-primary/10 px-8 py-6 border-b border-border">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                  <Building2 className="h-4 w-4" />
                  <span>Copenhagen Sales</span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">{contract.title}</h1>
                {contract.sent_at && (
                  <p className="text-muted-foreground text-sm mt-2">
                    Udsendt {format(new Date(contract.sent_at), "d. MMMM yyyy", { locale: da })}
                  </p>
                )}
              </div>
              {contract.status === "signed" && (
                <div className="flex-shrink-0 transform rotate-[-8deg]">
                  <div className="w-24 h-24 rounded-full border-[3px] border-primary/60 flex items-center justify-center bg-primary/10">
                    <div className="text-center">
                      <Check className="h-6 w-6 text-primary mx-auto mb-0.5" />
                      <span className="text-primary text-[10px] font-bold tracking-wider block">GODKENDT</span>
                      <span className="text-primary/70 text-[8px]">
                        {format(new Date(), "dd.MM.yy")}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Contract Content - Professional Danish Employment Contract Layout */}
          <div className="py-12 px-6 md:px-12 lg:px-20 bg-card">
            {/* Narrow column container - max 65 characters per line */}
            <div className="max-w-[42rem] mx-auto">
              <div
                className="prose prose-invert
                  /* Base typography - optimized for legal documents */
                  prose-base
                  text-[15px] leading-[1.8]
                  
                  /* ═══════════════════════════════════════════════════════════
                     DOCUMENT TITLE - Very prominent, centered
                     ═══════════════════════════════════════════════════════════ */
                  prose-h1:text-xl prose-h1:font-bold prose-h1:text-center prose-h1:text-foreground 
                  prose-h1:tracking-[0.15em] prose-h1:uppercase prose-h1:mb-16 prose-h1:mt-4
                  prose-h1:pb-6 prose-h1:border-b prose-h1:border-foreground/20
                  
                  /* ═══════════════════════════════════════════════════════════
                     SECTION TITLES (§1, §2 etc.) - Clear separation
                     ═══════════════════════════════════════════════════════════ */
                  prose-h2:text-base prose-h2:font-bold prose-h2:text-foreground 
                  prose-h2:tracking-wide prose-h2:uppercase
                  prose-h2:mt-14 prose-h2:mb-5 prose-h2:pt-6
                  prose-h2:border-t prose-h2:border-foreground/10
                  
                  /* ═══════════════════════════════════════════════════════════
                     SUBSECTION TITLES - Slightly smaller
                     ═══════════════════════════════════════════════════════════ */
                  prose-h3:text-[15px] prose-h3:font-semibold prose-h3:text-foreground
                  prose-h3:mt-8 prose-h3:mb-3
                  
                  prose-h4:text-sm prose-h4:font-semibold prose-h4:text-muted-foreground
                  prose-h4:uppercase prose-h4:tracking-wider
                  prose-h4:mt-6 prose-h4:mb-2
                  
                  /* ═══════════════════════════════════════════════════════════
                     PARAGRAPHS - Generous spacing, readable line length
                     ═══════════════════════════════════════════════════════════ */
                  prose-p:text-muted-foreground prose-p:leading-[1.9] prose-p:my-5
                  prose-p:text-[15px] prose-p:text-justify prose-p:hyphens-auto
                  
                  prose-strong:text-foreground prose-strong:font-semibold
                  
                  /* ═══════════════════════════════════════════════════════════
                     LISTS - Proper indentation for numbered items
                     ═══════════════════════════════════════════════════════════ */
                  prose-ul:my-6 prose-ul:pl-5 prose-ul:space-y-3
                  prose-ol:my-6 prose-ol:pl-0 prose-ol:space-y-4 prose-ol:list-none
                  prose-li:text-muted-foreground prose-li:text-[15px] prose-li:leading-[1.8]
                  prose-li:my-0
                  
                  /* Nested list indentation */
                  [&_ol_ol]:pl-8 [&_ol_ol]:mt-3 [&_ol_ol]:mb-0
                  [&_ul_ul]:pl-6 [&_ul_ul]:mt-2
                  
                  /* Line breaks - minimal for addresses */
                  [&_br]:block [&_br]:content-[''] [&_br]:h-0.5
                  
                  /* Extra spacing between major sections */
                  [&_p]:my-5
                  [&>p:nth-child(7)]:mt-14 [&>p:nth-child(7)]:pt-6 [&>p:nth-child(7)]:border-t [&>p:nth-child(7)]:border-foreground/10
                  [&>p:nth-child(8)]:mt-14 [&>p:nth-child(8)]:pt-6 [&>p:nth-child(8)]:border-t [&>p:nth-child(8)]:border-foreground/10
                  
                  /* Horizontal rules */
                  [&_hr]:my-14 [&_hr]:border-foreground/10
                  
                  /* ═══════════════════════════════════════════════════════════
                     TABLES - Clean grid for structured data (notice periods etc.)
                     ═══════════════════════════════════════════════════════════ */
                  [&_table]:w-full [&_table]:my-8 [&_table]:text-sm
                  [&_table]:border [&_table]:border-border/40 [&_table]:rounded
                  [&_th]:bg-muted/30 [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-left 
                  [&_th]:font-semibold [&_th]:text-foreground [&_th]:text-xs 
                  [&_th]:uppercase [&_th]:tracking-wider [&_th]:border-b [&_th]:border-border/40
                  [&_td]:px-4 [&_td]:py-2.5 [&_td]:border-b [&_td]:border-border/20 
                  [&_td]:text-muted-foreground [&_td]:align-top
                  [&_tr:last-child_td]:border-b-0
                  [&_td:first-child]:font-medium [&_td:first-child]:text-foreground
                  [&_td:last-child]:text-right
                  
                  /* ═══════════════════════════════════════════════════════════
                     PARTY BLOCKS - Clear visual separation for Medarbejder/Arbejdsgiver
                     ═══════════════════════════════════════════════════════════ */
                  [&_blockquote]:border-l-2 [&_blockquote]:border-primary/50 
                  [&_blockquote]:pl-6 [&_blockquote]:ml-0 [&_blockquote]:mr-0
                  [&_blockquote]:my-8 [&_blockquote]:py-4
                  [&_blockquote]:bg-muted/10 [&_blockquote]:rounded-r
                  [&_blockquote_p]:my-1.5 [&_blockquote_p]:text-foreground/90
                  [&_blockquote_p]:text-[14px] [&_blockquote_p]:leading-relaxed
                  [&_blockquote_strong]:text-foreground
                  
                  /* Definition lists for structured info */
                  [&_dl]:my-6 [&_dl]:grid [&_dl]:grid-cols-[auto_1fr] [&_dl]:gap-x-6 [&_dl]:gap-y-2
                  [&_dt]:font-medium [&_dt]:text-foreground [&_dt]:text-sm
                  [&_dd]:text-muted-foreground [&_dd]:text-sm [&_dd]:m-0
                  
                  /* Pre blocks for special formatting */
                  [&_pre]:whitespace-pre-wrap [&_pre]:font-sans [&_pre]:text-sm 
                  [&_pre]:bg-muted/20 [&_pre]:p-5 [&_pre]:rounded [&_pre]:my-6 
                  [&_pre]:border [&_pre]:border-border/20 [&_pre]:leading-relaxed"
                dangerouslySetInnerHTML={{ __html: contract.content }}
              />
            </div>
          </div>
        </div>

        {/* Signatures Card */}
        <div className="bg-card rounded-2xl shadow-xl overflow-hidden border border-border">
          <div className="px-6 py-4 border-b border-border bg-muted/50">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
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
                      ? 'bg-primary/10 border border-primary/20' 
                      : 'bg-muted/50 border border-border'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center text-sm font-bold ${
                      sig.signed_at 
                        ? 'bg-primary/20 text-primary' 
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {sig.signer_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{sig.signer_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {sig.signer_type === "employee" ? "Medarbejder" : "For arbejdsgiver"}
                      </p>
                    </div>
                  </div>
                  {sig.signed_at ? (
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-medium text-primary">Underskrevet</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(sig.signed_at), "d. MMM yyyy 'kl.' HH:mm", { locale: da })}
                        </p>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center shadow-lg">
                        <Check className="h-5 w-5 text-primary-foreground" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-warning font-medium">Afventer</span>
                      <div className="h-10 w-10 rounded-full bg-warning/20 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-warning" />
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
            className="relative overflow-hidden rounded-2xl shadow-2xl border-2 border-emerald-500/30"
          >
            {/* Green gradient background */}
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
