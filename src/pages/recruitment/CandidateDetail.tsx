import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Edit2, Mail, MessageSquare, Phone, Plus, Calendar, FileText, Clock, User, Briefcase, MapPin, Star, Send, History, TrendingUp, X, Loader2, PhoneCall } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { da } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SendSmsDialog } from "@/components/recruitment/SendSmsDialog";
import { SendEmailDialog } from "@/components/recruitment/SendEmailDialog";
import { CallModal } from "@/components/calls/CallModal";
import { useTwilioDeviceContext } from "@/contexts/TwilioDeviceContext";
import { CandidateChatHistory } from "@/components/recruitment/CandidateChatHistory";
import { CandidateCallLogs } from "@/components/recruitment/CandidateCallLogs";
import { AssignCohortDialog } from "@/components/recruitment/AssignCohortDialog";
const statusLabels: Record<string, string> = {
  ny_ansoegning: "Ny ansøgning",
  new: "Ny ansøgning",
  contacted: "Kontaktet",
  interview_scheduled: "Samtale planlagt",
  interviewed: "Samtale afholdt",
  hired: "Ansat",
  rejected: "Afvist",
  ghostet: "Ghostet",
  takket_nej: "Takket nej"
};
const statusColors: Record<string, string> = {
  ny_ansoegning: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  new: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  contacted: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
  interview_scheduled: "bg-purple-500/10 text-purple-600 border-purple-500/30",
  interviewed: "bg-cyan-500/10 text-cyan-600 border-cyan-500/30",
  hired: "bg-green-500/10 text-green-600 border-green-500/30",
  rejected: "bg-red-500/10 text-red-600 border-red-500/30",
  ghostet: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  takket_nej: "bg-purple-500/10 text-purple-600 border-purple-500/30"
};
const roleLabels: Record<string, string> = {
  fieldmarketing: "Fieldmarketing",
  salgskonsulent: "Salgskonsulent",
  Fieldmarketing: "Fieldmarketing",
  Salgskonsulent: "Salgskonsulent"
};
const roleColors: Record<string, string> = {
  fieldmarketing: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  salgskonsulent: "bg-indigo-500/10 text-indigo-600 border-indigo-500/30",
  Fieldmarketing: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  Salgskonsulent: "bg-indigo-500/10 text-indigo-600 border-indigo-500/30"
};
const sourceLabels: Record<string, string> = {
  hjemmesiden: "Hjemmesiden",
  linkedin: "LinkedIn",
  jobindex: "Jobindex",
  anbefaling: "Anbefaling",
  andet: "Andet"
};
export default function CandidateDetail() {
  const {
    id
  } = useParams<{
    id: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { makeCall, deviceState, callState } = useTwilioDeviceContext();
  const [showSmsDialog, setShowSmsDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showInterviewDialog, setShowInterviewDialog] = useState(false);
  const [interviewDate, setInterviewDate] = useState<Date | undefined>(undefined);
  const [interviewTime, setInterviewTime] = useState("10:00");
  const [newNote, setNewNote] = useState("");
  const [isCallingCandidate, setIsCallingCandidate] = useState(false);
  const [activeCallSid, setActiveCallSid] = useState<string | null>(null);
  const [showCallModal, setShowCallModal] = useState(false);
  const [noteType, setNoteType] = useState("Generel observation");
  const [showAssignCohortDialog, setShowAssignCohortDialog] = useState(false);
  const {
    data: candidate,
    isLoading
  } = useQuery({
    queryKey: ["candidate", id],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("candidates").select("*, applications(*)").eq("id", id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });
  const {
    data: communications = []
  } = useQuery({
    queryKey: ["candidate-communications", id, candidate?.phone],
    queryFn: async (): Promise<any[]> => {
      const phone = candidate?.phone;
      if (!phone) return [];
      
      // Normalize phone - remove all non-digits and country codes
      const normalizedPhone = phone.replace(/\D/g, '').replace(/^45/, '').replace(/^1/, '');
      
      if (!normalizedPhone || normalizedPhone.length < 7) return [];
      
      // Query by phone number only (communication_logs doesn't have candidate_id column)
      // @ts-ignore - Supabase type chain too deep
      const result = await supabase
        .from("communication_logs")
        .select("*")
        .ilike("phone_number", `%${normalizedPhone}%`)
        .in("type", ["sms", "email"])
        .order("created_at", { ascending: false })
        .limit(50);

      if (result.error) throw result.error;
      return result.data || [];
    },
    enabled: !!id && !!candidate?.phone
  });

  // Separate query for call records count
  const { data: callRecordsCount = 0 } = useQuery({
    queryKey: ["candidate-call-records-count", id, candidate?.phone],
    queryFn: async (): Promise<number> => {
      if (!id) return 0;
      
      const phone = candidate?.phone;
      const normalizedPhone = phone ? phone.replace(/\D/g, '').replace(/^45/, '').replace(/^\+45/, '') : null;
      
      // Get count from call_records by candidate_id
      const { count: idCount } = await supabase
        .from("call_records")
        .select("*", { count: 'exact', head: true })
        .eq("candidate_id", id);
      
      let totalCount = idCount || 0;
      
      // Also count by phone if available
      if (normalizedPhone) {
        const { count: phoneCount } = await supabase
          .from("call_records")
          .select("*", { count: 'exact', head: true })
          .or(`to_number.ilike.%${normalizedPhone}%,from_number.ilike.%${normalizedPhone}%`)
          .neq("candidate_id", id); // Avoid double counting
        
        totalCount += (phoneCount || 0);
      }
      
      return totalCount;
    },
    enabled: !!id && !!candidate
  });

  // Count SMS/email from communication_logs
  const smsEmailCount = communications.filter(c => c.type === 'sms' || c.type === 'email').length;
  const {
    data: teams = []
  } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("teams").select("id, name").order("name");
      if (error) throw error;
      return data;
    }
  });
  const updateCandidateMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const {
        error
      } = await supabase.from("candidates").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["candidate", id]
      });
      toast.success("Kandidat opdateret");
    },
    onError: () => {
      toast.error("Kunne ikke opdatere kandidat");
    }
  });
  const addNoteMutation = useMutation({
    mutationFn: async () => {
      const existingNotes = candidate?.notes || "";
      const timestamp = format(new Date(), "d. MMM yyyy HH:mm", {
        locale: da
      });
      const formattedNote = `[${timestamp}] ${noteType}: ${newNote}`;
      const updatedNotes = existingNotes ? `${formattedNote}\n\n${existingNotes}` : formattedNote;
      const {
        error
      } = await supabase.from("candidates").update({
        notes: updatedNotes
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["candidate", id]
      });
      setNewNote("");
      toast.success("Note tilføjet");
    },
    onError: () => {
      toast.error("Kunne ikke tilføje note");
    }
  });

  const scheduleInterviewMutation = useMutation({
    mutationFn: async () => {
      if (!interviewDate || !interviewTime) {
        throw new Error("Vælg dato og tidspunkt");
      }
      const dateStr = format(interviewDate, "yyyy-MM-dd");
      const dateTime = `${dateStr}T${interviewTime}:00`;
      const { error } = await supabase
        .from("candidates")
        .update({ 
          interview_date: dateTime,
          status: "interview_scheduled"
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidate", id] });
      setShowInterviewDialog(false);
      setInterviewDate(undefined);
      setInterviewTime("10:00");
      toast.success("Samtale planlagt");
    },
    onError: (error: any) => {
      toast.error(error.message || "Kunne ikke planlægge samtale");
    }
  });
  if (isLoading) {
    return <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-muted rounded" />
            <div className="h-4 w-32 bg-muted rounded" />
          </div>
        </div>
      </MainLayout>;
  }
  if (!candidate) {
    return <MainLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <User className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">Kandidat ikke fundet</p>
          <Button variant="outline" onClick={() => navigate("/recruitment/candidates")}>
            Tilbage til kandidater
          </Button>
        </div>
      </MainLayout>;
  }
  const position = candidate.applied_position?.toLowerCase() || "";
  const applications = candidate.applications || [];
  const initials = `${candidate.first_name?.[0] || ""}${candidate.last_name?.[0] || ""}`.toUpperCase();
  const timeInPipeline = formatDistanceToNow(new Date(candidate.created_at), {
    locale: da,
    addSuffix: false
  });

  // Parse notes for display
  const notesArray = candidate.notes?.split('\n\n').filter(Boolean) || [];
  return <MainLayout>
      <div className="space-y-4 md:space-y-6 max-w-7xl mx-auto px-0">
        {/* Back button */}
        <Button variant="ghost" onClick={() => navigate("/recruitment/candidates")} className="w-fit -ml-2">
          <ArrowLeft className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Tilbage til kandidater</span>
          <span className="sm:hidden">Tilbage</span>
        </Button>

        {/* Hero Profile Card */}
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 sm:p-6 md:p-8">
            <div className="flex flex-col gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold truncate">
                  {candidate.first_name} {candidate.last_name}
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Badge className={`${roleColors[position] || "bg-muted"} font-medium text-xs`} variant="outline">
                    <Briefcase className="h-3 w-3 mr-1" />
                    {roleLabels[position] || candidate.applied_position || "Ikke angivet"}
                  </Badge>
                  <Badge className={`${statusColors[candidate.status] || ""} font-medium text-xs`} variant="outline">
                    {statusLabels[candidate.status] || candidate.status}
                  </Badge>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                  <Clock className="h-3 w-3 inline mr-1" />
                  I pipeline: {timeInPipeline}
                </p>
              </div>

              {/* Quick Actions - Grid on mobile */}
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => {
                    if (!candidate.phone) return;
                    
                    if (deviceState === 'busy') {
                      toast.error('Softphone er optaget med et andet opkald');
                      return;
                    }
                    
                    makeCall(candidate.phone);
                  }} 
                  disabled={!candidate.phone || callState === 'connecting' || callState === 'connected'} 
                  className="bg-background/80"
                >
                  {(callState === 'connecting' || deviceState === 'connecting') ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Phone className="h-4 w-4 mr-1.5" />
                  )}
                  <span className="truncate">{callState === 'connecting' ? 'Ringer...' : 'Ring'}</span>
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowSmsDialog(true)} disabled={!candidate.phone} className="bg-background/80">
                  <MessageSquare className="h-4 w-4 mr-1.5" />
                  SMS
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowEmailDialog(true)} disabled={!candidate.email} className="bg-background/80">
                  <Mail className="h-4 w-4 mr-1.5" />
                  Email
                </Button>
                <Button size="sm" variant="outline" onClick={() => navigate(`/recruitment/candidates/${id}/edit`)} className="bg-background/80">
                  <Edit2 className="h-4 w-4 mr-1.5" />
                  Rediger
                </Button>
              </div>
            </div>
          </div>

          {/* Contact & Stats Bar */}
          <div className="border-t bg-muted/30 px-4 sm:px-6 py-3 sm:py-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              {/* Contact Info */}
              <div className="space-y-0.5 sm:space-y-1">
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Email</p>
                <p className="text-xs sm:text-sm font-medium truncate" title={candidate.email || ""}>
                  {candidate.email || <span className="text-muted-foreground italic">Ikke angivet</span>}
                </p>
              </div>
              <div className="space-y-0.5 sm:space-y-1">
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Telefon</p>
                <p className="text-xs sm:text-sm font-medium">
                  {candidate.phone || <span className="text-muted-foreground italic">Ikke angivet</span>}
                </p>
              </div>
              <div className="space-y-0.5 sm:space-y-1">
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Kilde</p>
                <p className="text-xs sm:text-sm font-medium">
                  {sourceLabels[candidate.source?.toLowerCase() || ""] || candidate.source || <span className="text-muted-foreground italic">Ukendt</span>}
                </p>
              </div>
              <div className="space-y-0.5 sm:space-y-1">
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Ansøgningsdato</p>
                <p className="text-xs sm:text-sm font-medium">
                  {format(new Date(candidate.created_at), "d. MMM yyyy", {
                  locale: da
                })}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Main Content - 2 Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Left Column - Wider */}
          <div className="lg:col-span-2 space-y-4 md:space-y-6">
            {/* Status & Interview Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Rekrutteringsstatus
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Status Selector */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Nuværende status</label>
                    <Select value={candidate.status} onValueChange={value => {
                      if (value === "hired") {
                        setShowAssignCohortDialog(true);
                      } else {
                        updateCandidateMutation.mutate({ status: value });
                      }
                    }}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>
                            <span className={`inline-flex items-center gap-2`}>
                              <span className={`w-2 h-2 rounded-full ${statusColors[value]?.split(' ')[0] || 'bg-muted'}`} />
                              {label}
                            </span>
                          </SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Interview Section */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Jobsamtale</label>
                    {candidate.interview_date ? <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                        <Calendar className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium text-sm">
                            {format(new Date(candidate.interview_date), "EEEE d. MMMM", {
                          locale: da
                        })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            kl. {format(new Date(candidate.interview_date), "HH:mm", {
                          locale: da
                        })}
                          </p>
                        </div>
                      </div> : <Button variant="outline" className="w-full justify-start" onClick={() => setShowInterviewDialog(true)}>
                        <Calendar className="h-4 w-4 mr-2" />
                        Planlæg samtale
                      </Button>}
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-4 sm:mt-6 pt-4 sm:pt-6 border-t">
                  <div className="text-center p-2 sm:p-3 bg-muted/50 rounded-lg">
                    <p className="text-lg sm:text-2xl font-bold text-primary">{applications.length || 1}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Ansøgninger</p>
                  </div>
                  <div className="text-center p-2 sm:p-3 bg-muted/50 rounded-lg">
                    <p className="text-lg sm:text-2xl font-bold text-primary">{callRecordsCount}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Opkald</p>
                  </div>
                  <div className="text-center p-2 sm:p-3 bg-muted/50 rounded-lg">
                    <p className="text-lg sm:text-2xl font-bold text-primary">{smsEmailCount}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Beskeder</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Communication History with Tabs */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  Kommunikationshistorik
                </CardTitle>
                <CardDescription>Chat og opkaldslog med kandidaten</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="chat" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="chat" className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Beskeder
                      {smsEmailCount > 0 && (
                        <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                          {smsEmailCount}
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="calls" className="flex items-center gap-2">
                      <PhoneCall className="h-4 w-4" />
                      Opkald
                      {callRecordsCount > 0 && (
                        <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                          {callRecordsCount}
                        </Badge>
                      )}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="chat" className="mt-0">
                    <CandidateChatHistory 
                      candidatePhone={candidate.phone} 
                      candidateId={candidate.id}
                      maxHeight="350px"
                    />
                    <div className="flex gap-2 mt-4 pt-4 border-t">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setShowSmsDialog(true)} 
                        disabled={!candidate.phone}
                        className="flex-1"
                      >
                        <MessageSquare className="h-4 w-4 mr-1.5" />
                        Send SMS
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setShowEmailDialog(true)} 
                        disabled={!candidate.email}
                        className="flex-1"
                      >
                        <Mail className="h-4 w-4 mr-1.5" />
                        Send email
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="calls" className="mt-0">
                    <CandidateCallLogs 
                      candidatePhone={candidate.phone} 
                      candidateId={candidate.id}
                      maxHeight="350px"
                    />
                    <div className="mt-4 pt-4 border-t">
                      <Button 
                        size="sm" 
                        onClick={() => {
                          if (!candidate.phone) return;
                          if (deviceState === 'busy') {
                            toast.error('Softphone er optaget med et andet opkald');
                            return;
                          }
                          makeCall(candidate.phone);
                        }} 
                        disabled={!candidate.phone || callState === 'connecting' || callState === 'connected'} 
                        className="w-full"
                      >
                        {(callState === 'connecting' || deviceState === 'connecting') ? (
                          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                        ) : (
                          <Phone className="h-4 w-4 mr-1.5" />
                        )}
                        {callState === 'connecting' ? 'Ringer...' : 'Ring til kandidat'}
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Notes */}
          <div className="space-y-4 md:space-y-6">
            {/* Quick Note Input */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Tilføj note
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select value={noteType} onValueChange={setNoteType}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Generel observation">Generel observation</SelectItem>
                    <SelectItem value="Telefonsamtale">Telefonsamtale</SelectItem>
                    <SelectItem value="Email korrespondance">Email korrespondance</SelectItem>
                    <SelectItem value="Interview feedback">Interview feedback</SelectItem>
                  </SelectContent>
                </Select>

                <Textarea placeholder="Skriv en note om kandidaten..." value={newNote} onChange={e => setNewNote(e.target.value)} rows={4} className="resize-none" />

                <Button className="w-full" onClick={() => addNoteMutation.mutate()} disabled={!newNote.trim() || addNoteMutation.isPending}>
                  <Send className="h-4 w-4 mr-2" />
                  Gem note
                </Button>
              </CardContent>
            </Card>

            {/* Notes History */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Ansøgning</CardTitle>
              </CardHeader>
              <CardContent>
                {notesArray.length === 0 ? <div className="text-center py-8">
                    <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                    <p className="text-sm text-muted-foreground">Ingen noter endnu</p>
                  </div> : <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                    {notesArray.map((note, index) => {
                  // Parse note format: [date] type: content
                  const match = note.match(/^\[(.*?)\]\s*(.*?):\s*(.*)$/s);
                  const date = match?.[1] || "";
                  const type = match?.[2] || "";
                  const content = match?.[3] || note;
                  return <div key={index} className="p-3 bg-muted/40 rounded-lg border-l-2 border-primary/30">
                          {date && <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs text-muted-foreground">{date}</span>
                              {type && <Badge variant="secondary" className="text-xs">{type}</Badge>}
                            </div>}
                          <p className="text-sm whitespace-pre-wrap">{content}</p>
                        </div>;
                })}
                  </div>}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <SendSmsDialog open={showSmsDialog} onOpenChange={setShowSmsDialog} candidate={{
      id: candidate.id,
      first_name: candidate.first_name,
      last_name: candidate.last_name,
      phone: candidate.phone,
      applied_position: candidate.applied_position
    }} />
      <SendEmailDialog open={showEmailDialog} onOpenChange={setShowEmailDialog} candidate={{
      id: candidate.id,
      first_name: candidate.first_name,
      last_name: candidate.last_name,
      email: candidate.email,
      applied_position: candidate.applied_position
    }} />

      <Dialog open={showInterviewDialog} onOpenChange={setShowInterviewDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Planlæg jobsamtale</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Dato</Label>
              <CalendarComponent
                mode="single"
                selected={interviewDate}
                onSelect={setInterviewDate}
                disabled={(date) => date < new Date()}
                locale={da}
                className={cn("rounded-md border pointer-events-auto")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="interview-time">Tidspunkt</Label>
              <Input
                id="interview-time"
                type="time"
                value={interviewTime}
                onChange={(e) => setInterviewTime(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInterviewDialog(false)}>
              Annuller
            </Button>
            <Button 
              onClick={() => scheduleInterviewMutation.mutate()}
              disabled={!interviewDate || scheduleInterviewMutation.isPending}
            >
              {scheduleInterviewMutation.isPending ? "Gemmer..." : "Planlæg samtale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Call Modal */}
      <CallModal
        isOpen={showCallModal}
        onClose={() => {
          setShowCallModal(false);
          setActiveCallSid(null);
        }}
        callSid={activeCallSid}
        phoneNumber={candidate?.phone || ''}
        contactName={candidate ? `${candidate.first_name} ${candidate.last_name}` : undefined}
      />

      {/* Assign Cohort Dialog */}
      <AssignCohortDialog
        open={showAssignCohortDialog}
        onOpenChange={setShowAssignCohortDialog}
        candidateId={id || ""}
        candidateName={candidate ? `${candidate.first_name} ${candidate.last_name}` : ""}
        onConfirm={async (cohortId, availableFrom) => {
          try {
            // Update candidate status and available_from
            const updateData: any = { 
              status: "hired",
              cohort_assignment_status: cohortId ? "assigned" : "pending"
            };
            if (availableFrom) {
              updateData.available_from = availableFrom.toISOString().split('T')[0];
            }
            
            await supabase.from("candidates").update(updateData).eq("id", id);
            
            // If cohort selected, add to cohort_members
            if (cohortId) {
              await supabase.from("cohort_members").insert({
                cohort_id: cohortId,
                candidate_id: id,
                status: "pending"
              });
            }
            
            queryClient.invalidateQueries({ queryKey: ["candidate", id] });
            toast.success("Kandidat ansat!");
            setShowAssignCohortDialog(false);
          } catch (error) {
            console.error("Error hiring candidate:", error);
            toast.error("Kunne ikke ansætte kandidat");
          }
        }}
        onSkip={() => {
          updateCandidateMutation.mutate({ status: "hired" });
          setShowAssignCohortDialog(false);
        }}
      />
    </MainLayout>;
}