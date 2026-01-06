import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Phone, 
  Mail, 
  MessageSquare, 
  ChevronDown,
  Clock,
  FileText,
  Trash2,
  PhoneCall
} from "lucide-react";
import { format, differenceInHours, differenceInDays } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "sonner";
import { SendSmsDialog } from "./SendSmsDialog";
import { SendEmailDialog } from "./SendEmailDialog";
import { useTwilioDeviceContext } from "@/contexts/TwilioDeviceContext";

interface Application {
  id: string;
  role: string;
  status: string;
  application_date: string;
  notes?: string;
}

interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  created_at: string;
  source: string | null;
  notes: string | null;
  applied_position: string | null;
}

interface CandidateCardProps {
  candidate: Candidate;
  applications?: Application[];
  onUpdate?: () => void;
}

const statusLabels: Record<string, string> = {
  ny_ansoegning: "Ny ansøgning",
  ansat: "Ansat",
  udskudt_samtale: "Udskudt samtale",
  ikke_kvalificeret: "Ikke kvalificeret",
  ikke_ansat: "Ikke ansat",
  startet: "Startet",
  ghostet: "Ghostet",
  takket_nej: "Takket nej",
  interesseret_i_kundeservice: "Interesseret i kundeservice",
  jobsamtale: "Jobsamtale",
  new: "Ny ansøgning",
  contacted: "Kontaktet",
  interview_scheduled: "Samtale planlagt",
  interviewed: "Samtale afholdt",
  hired: "Ansat",
  rejected: "Afvist",
};

const statusColors: Record<string, string> = {
  ny_ansoegning: "bg-[hsl(var(--status-new))]/10 text-[hsl(var(--status-new))] border-[hsl(var(--status-new))]/20",
  ansat: "bg-[hsl(var(--status-success))]/10 text-[hsl(var(--status-success))] border-[hsl(var(--status-success))]/20",
  udskudt_samtale: "bg-[hsl(var(--status-progress))]/10 text-[hsl(var(--status-progress))] border-[hsl(var(--status-progress))]/20",
  ikke_kvalificeret: "bg-[hsl(var(--status-rejected))]/10 text-[hsl(var(--status-rejected))] border-[hsl(var(--status-rejected))]/20",
  ikke_ansat: "bg-[hsl(var(--status-rejected))]/10 text-[hsl(var(--status-rejected))] border-[hsl(var(--status-rejected))]/20",
  startet: "bg-[hsl(var(--status-progress))]/10 text-[hsl(var(--status-progress))] border-[hsl(var(--status-progress))]/20",
  ghostet: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  takket_nej: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  interesseret_i_kundeservice: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  jobsamtale: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  new: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  contacted: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  interview_scheduled: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  interviewed: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  offer_sent: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  hired: "bg-green-500/10 text-green-400 border-green-500/20",
  rejected: "bg-red-500/10 text-red-400 border-red-500/20",
};

const roleLabels: Record<string, string> = {
  fieldmarketing: "Fieldmarketing",
  salgskonsulent: "Salgskonsulent",
  Fieldmarketing: "Fieldmarketing",
  Salgskonsulent: "Salgskonsulent",
};

const roleColors: Record<string, string> = {
  fieldmarketing: "bg-[hsl(var(--role-fieldmarketing))]/10 text-[hsl(var(--role-fieldmarketing))] border-[hsl(var(--role-fieldmarketing))]/20",
  salgskonsulent: "bg-[hsl(var(--role-salgskonsulent))]/10 text-[hsl(var(--role-salgskonsulent))] border-[hsl(var(--role-salgskonsulent))]/20",
  Fieldmarketing: "bg-[hsl(var(--role-fieldmarketing))]/10 text-[hsl(var(--role-fieldmarketing))] border-[hsl(var(--role-fieldmarketing))]/20",
  Salgskonsulent: "bg-[hsl(var(--role-salgskonsulent))]/10 text-[hsl(var(--role-salgskonsulent))] border-[hsl(var(--role-salgskonsulent))]/20",
};

export function CandidateCard({ candidate, applications = [], onUpdate }: CandidateCardProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [showSmsDialog, setShowSmsDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const queryClient = useQueryClient();
  const { makeCall, callState, isDeviceReady, initializeDevice } = useTwilioDeviceContext();

  const getTimeSinceApplication = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const hoursDiff = differenceInHours(now, date);
    const daysDiff = differenceInDays(now, date);

    if (hoursDiff < 24) {
      return `${hoursDiff}t`;
    } else if (daysDiff < 7) {
      return `${daysDiff}d`;
    } else if (daysDiff < 30) {
      return `${Math.floor(daysDiff / 7)}u`;
    } else {
      return `${Math.floor(daysDiff / 30)}m`;
    }
  };

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase
        .from("candidates")
        .update({ status: newStatus })
        .eq("id", candidate.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      toast.success("Status opdateret");
      if (onUpdate) onUpdate();
    },
    onError: () => {
      toast.error("Kunne ikke opdatere status");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("candidates")
        .delete()
        .eq("id", candidate.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      toast.success("Kandidat slettet");
      if (onUpdate) onUpdate();
    },
    onError: () => {
      toast.error("Kunne ikke slette kandidat");
    },
  });

  const handlePhoneClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!candidate.phone) {
      toast.error("Ingen telefonnummer");
      return;
    }
    
    try {
      // Initialize device if not ready
      if (!isDeviceReady) {
        toast.info("Forbinder til telefon...");
        await initializeDevice();
      }
      
      // Format phone number
      let phoneNumber = candidate.phone.replace(/\s+/g, '');
      if (!phoneNumber.startsWith('+')) {
        phoneNumber = '+45' + phoneNumber;
      }
      
      await makeCall(phoneNumber);
      toast.success(`Ringer op til ${candidate.first_name} ${candidate.last_name}...`);
    } catch (error) {
      console.error('Error making call:', error);
      toast.error("Kunne ikke starte opkald");
    }
  };

  const isInCall = callState === 'connecting' || callState === 'connected';

  const handleCardClick = () => {
    navigate(`/recruitment/candidates/${candidate.id}`);
  };

  const position = candidate.applied_position?.toLowerCase() || "";

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card
          className={`hover:shadow-md transition-all duration-200 hover:border-primary/50 cursor-pointer ${
            candidate.status === 'new' || candidate.status === 'ny_ansoegning' ? 'border-l-4 border-l-red-500' : ''
          }`}
          onClick={handleCardClick}
        >
          <CardContent className="p-3 md:p-4">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
              {/* Left side - Basic info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 md:gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base md:text-lg truncate text-foreground">
                      {candidate.first_name} {candidate.last_name}
                    </h3>
                    <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4 mt-1 text-xs md:text-sm text-muted-foreground">
                      {candidate.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3 w-3 md:h-3.5 md:w-3.5 flex-shrink-0" />
                          <span className="truncate">{candidate.email}</span>
                        </div>
                      )}
                      {candidate.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3 w-3 md:h-3.5 md:w-3.5 flex-shrink-0" />
                          <span>{candidate.phone}</span>
                        </div>
                      )}
                    </div>

                    {/* Status and role badges */}
                    <div className="flex flex-wrap items-center gap-1.5 md:gap-2 mt-2 md:mt-3">
                      {candidate.applied_position && (
                        <Badge className={roleColors[position] || "bg-muted text-muted-foreground"} variant="outline">
                          {roleLabels[position] || candidate.applied_position}
                        </Badge>
                      )}
                      <Select
                        value={candidate.status}
                        onValueChange={(value) => updateStatusMutation.mutate(value)}
                      >
                        <SelectTrigger
                          className={`h-6 w-auto min-w-[120px] text-xs px-2 ${statusColors[candidate.status] || ""}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent onClick={(e) => e.stopPropagation()} className="bg-popover border-border">
                          <SelectItem value="new">Ny ansøgning</SelectItem>
                          <SelectItem value="contacted">Kontaktet</SelectItem>
                          <SelectItem value="interview_scheduled">Samtale planlagt</SelectItem>
                          <SelectItem value="interviewed">Samtale afholdt</SelectItem>
                          <SelectItem value="hired">Ansat</SelectItem>
                          <SelectItem value="rejected">Afvist</SelectItem>
                          <SelectItem value="ghostet">Ghostet</SelectItem>
                          <SelectItem value="takket_nej">Takket nej</SelectItem>
                        </SelectContent>
                      </Select>
                      <Badge variant="secondary" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        {getTimeSinceApplication(candidate.created_at)}
                      </Badge>
                    </div>

                    {/* Notes preview */}
                    {candidate.notes && (
                      <div className="mt-2 text-xs text-muted-foreground bg-muted/30 rounded p-2 border border-border/50">
                        <span className="line-clamp-2">{candidate.notes}</span>
                      </div>
                    )}
                  </div>

                  {/* Right side - Badges */}
                  <div className="flex flex-col items-end gap-1.5 md:gap-2">
                    {(candidate.status === 'new' || candidate.status === 'ny_ansoegning') && (
                      <Badge className="bg-red-500 text-white whitespace-nowrap text-xs font-semibold">
                        NY ANSØGNING
                      </Badge>
                    )}
                    {applications.length > 0 && (
                      <Badge variant="outline" className="whitespace-nowrap text-xs">
                        <FileText className="h-3 w-3 mr-1" />
                        {applications.length}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Quick actions */}
                <div className="flex flex-wrap items-center gap-1.5 md:gap-2 mt-2 md:mt-3">
                  <Button
                    size="sm"
                    variant={isInCall ? "default" : "outline"}
                    onClick={handlePhoneClick}
                    className={`h-7 md:h-8 text-xs ${isInCall ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
                    disabled={!candidate.phone || isInCall}
                  >
                    {isInCall ? (
                      <PhoneCall className="h-3 w-3 md:h-3.5 md:w-3.5 animate-pulse md:mr-1.5" />
                    ) : (
                      <Phone className="h-3 w-3 md:h-3.5 md:w-3.5 md:mr-1.5" />
                    )}
                    <span className="hidden sm:inline ml-1">{isInCall ? 'I gang...' : 'Ring op'}</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSmsDialog(true);
                    }}
                    className="h-7 md:h-8 text-xs"
                    disabled={!candidate.phone}
                  >
                    <MessageSquare className="h-3 w-3 md:h-3.5 md:w-3.5 md:mr-1.5" />
                    <span className="hidden sm:inline ml-1">SMS</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowEmailDialog(true);
                    }}
                    className="h-7 md:h-8 text-xs"
                    disabled={!candidate.email}
                  >
                    <Mail className="h-3 w-3 md:h-3.5 md:w-3.5 md:mr-1.5" />
                    <span className="hidden sm:inline ml-1">Email</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeleteDialog(true);
                    }}
                    className="h-7 md:h-8 text-xs text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3 md:h-3.5 md:w-3.5" />
                  </Button>
                  <CollapsibleTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" className="h-7 md:h-8 ml-auto">
                      <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                </div>
              </div>
            </div>

            {/* Collapsible content */}
            <CollapsibleContent className="mt-4 pt-4 border-t border-border">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Kilde:</span>
                    <span className="ml-2 text-foreground">{candidate.source || "Ikke angivet"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Oprettet:</span>
                    <span className="ml-2 text-foreground">
                      {format(new Date(candidate.created_at), "d. MMM yyyy", { locale: da })}
                    </span>
                  </div>
                </div>
                
                {candidate.notes && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Noter:</span>
                    <p className="mt-1 text-foreground bg-muted/30 rounded p-2">
                      {candidate.notes}
                    </p>
                  </div>
                )}

                {applications.length > 0 && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Ansøgninger ({applications.length}):</span>
                    <div className="mt-2 space-y-2">
                      {applications.map((app) => (
                        <div key={app.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                          <span className="text-foreground">{app.role}</span>
                          <Badge variant="outline" className="text-xs">
                            {statusLabels[app.status] || app.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </CardContent>
        </Card>
      </Collapsible>

      <SendSmsDialog
        open={showSmsDialog}
        onOpenChange={setShowSmsDialog}
        candidate={candidate}
      />

      <SendEmailDialog
        open={showEmailDialog}
        onOpenChange={setShowEmailDialog}
        candidate={candidate}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Slet kandidat</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på, at du vil slette {candidate.first_name} {candidate.last_name}? 
              Denne handling kan ikke fortrydes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Slet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}