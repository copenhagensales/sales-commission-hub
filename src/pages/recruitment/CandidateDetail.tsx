import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  Edit2, 
  Mail, 
  MessageSquare, 
  Phone, 
  Plus, 
  Calendar,
  FileText,
  Clock
} from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "sonner";
import { SendSmsDialog } from "@/components/recruitment/SendSmsDialog";
import { SendEmailDialog } from "@/components/recruitment/SendEmailDialog";

const statusLabels: Record<string, string> = {
  ny_ansoegning: "Ny ansøgning",
  new: "Ny ansøgning",
  contacted: "Kontaktet",
  interview_scheduled: "Samtale planlagt",
  interviewed: "Samtale afholdt",
  offer_sent: "Tilbud sendt",
  hired: "Ansat",
  rejected: "Afvist",
  ghostet: "Ghostet",
  takket_nej: "Takket nej",
};

const statusColors: Record<string, string> = {
  ny_ansoegning: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  new: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  contacted: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  interview_scheduled: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  interviewed: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  offer_sent: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  hired: "bg-green-500/10 text-green-500 border-green-500/20",
  rejected: "bg-red-500/10 text-red-500 border-red-500/20",
  ghostet: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  takket_nej: "bg-purple-500/10 text-purple-500 border-purple-500/20",
};

const roleLabels: Record<string, string> = {
  fieldmarketing: "Fieldmarketing",
  salgskonsulent: "Salgskonsulent",
  Fieldmarketing: "Fieldmarketing",
  Salgskonsulent: "Salgskonsulent",
};

const roleColors: Record<string, string> = {
  fieldmarketing: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  salgskonsulent: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  Fieldmarketing: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  Salgskonsulent: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
};

const sourceLabels: Record<string, string> = {
  hjemmesiden: "Hjemmesiden",
  linkedin: "LinkedIn",
  jobindex: "Jobindex",
  anbefaling: "Anbefaling",
  andet: "Andet",
};

export default function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showSmsDialog, setShowSmsDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [noteType, setNoteType] = useState("Generel observation");

  const { data: candidate, isLoading } = useQuery({
    queryKey: ["candidate", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select("*, applications(*)")
        .eq("id", id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: communications = [] } = useQuery({
    queryKey: ["candidate-communications", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("communication_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    },
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const updateCandidateMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { error } = await supabase
        .from("candidates")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidate", id] });
      toast.success("Kandidat opdateret");
    },
    onError: () => {
      toast.error("Kunne ikke opdatere kandidat");
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      const existingNotes = candidate?.notes || "";
      const timestamp = format(new Date(), "d. MMM yyyy HH:mm", { locale: da });
      const formattedNote = `[${timestamp}] ${noteType}: ${newNote}`;
      const updatedNotes = existingNotes 
        ? `${formattedNote}\n\n${existingNotes}` 
        : formattedNote;
      
      const { error } = await supabase
        .from("candidates")
        .update({ notes: updatedNotes })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidate", id] });
      setNewNote("");
      toast.success("Note tilføjet");
    },
    onError: () => {
      toast.error("Kunne ikke tilføje note");
    },
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Indlæser kandidat...</p>
        </div>
      </MainLayout>
    );
  }

  if (!candidate) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Kandidat ikke fundet</p>
        </div>
      </MainLayout>
    );
  }

  const position = candidate.applied_position?.toLowerCase() || "";
  const applications = candidate.applications || [];

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/recruitment/candidates")}
            className="w-fit"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Tilbage til kandidater
          </Button>
          
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => navigate(`/recruitment/candidates/${id}/edit`)}>
              <Edit2 className="h-4 w-4 mr-2" />
              Rediger kandidat
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowEmailDialog(true)}
              disabled={!candidate.email}
            >
              <Mail className="h-4 w-4 mr-2" />
              Email
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowSmsDialog(true)}
              disabled={!candidate.phone}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              SMS
            </Button>
            <Button 
              variant="outline"
              onClick={() => candidate.phone && (window.location.href = `tel:${candidate.phone}`)}
              disabled={!candidate.phone}
            >
              <Phone className="h-4 w-4 mr-2" />
              Ring op
            </Button>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Ny ansøgning
            </Button>
          </div>
        </div>

        {/* Main content - 3 column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Candidate info */}
          <Card className="lg:col-span-1">
            <CardContent className="pt-6 space-y-6">
              {/* Basic info */}
              <div>
                <h2 className="text-2xl font-bold">
                  {candidate.first_name} {candidate.last_name}
                </h2>
                
                <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {candidate.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <span>{candidate.email}</span>
                    </div>
                  )}
                  {candidate.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <span>{candidate.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>Første ansøgning: {format(new Date(candidate.created_at), "d. MMMM yyyy", { locale: da })}</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Current application */}
              <div className="space-y-4">
                <h3 className="font-semibold">Nuværende ansøgning</h3>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Rolle:</span>
                    <Badge className={roleColors[position] || "bg-muted"} variant="outline">
                      {roleLabels[position] || candidate.applied_position || "Ikke angivet"}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <Select
                      value={candidate.status}
                      onValueChange={(value) => updateCandidateMutation.mutate({ status: value })}
                    >
                      <SelectTrigger className={`h-7 w-auto min-w-[130px] text-xs ${statusColors[candidate.status] || ""}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(statusLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Kilde:</span>
                    <Badge variant="secondary">
                      {sourceLabels[candidate.source?.toLowerCase() || ""] || candidate.source || "Ikke angivet"}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Team:</span>
                    <Badge variant="outline">Ikke valgt</Badge>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Interview */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Jobsamtale</h3>
                  <Button variant="outline" size="sm">
                    <Calendar className="h-4 w-4 mr-2" />
                    Planlæg
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  {candidate.interview_date 
                    ? format(new Date(candidate.interview_date), "d. MMMM yyyy HH:mm", { locale: da })
                    : "Ingen samtale planlagt"
                  }
                </p>
              </div>

              <Separator />

              {/* Notes from candidate */}
              <div className="space-y-3">
                <h3 className="font-semibold">Ansøgning fra kandidat</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {candidate.notes || "Ingen ansøgningstekst"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Middle column - Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Oversigt</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground">Total ansøgninger</p>
                <p className="text-3xl font-bold">{applications.length || 1}</p>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-3">Kommunikationsstatistik</h4>
                {communications.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ingen kommunikation registreret</p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Emails</span>
                      <span>{communications.filter(c => c.type === "email").length}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">SMS</span>
                      <span>{communications.filter(c => c.type === "sms").length}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Opkald</span>
                      <span>{communications.filter(c => c.type === "call").length}</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Right column - Quick Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Quick Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={noteType} onValueChange={setNoteType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Generel observation">Generel observation</SelectItem>
                  <SelectItem value="Telefonsamtale">Telefonsamtale</SelectItem>
                  <SelectItem value="Email korrespondance">Email korrespondance</SelectItem>
                  <SelectItem value="Interview feedback">Interview feedback</SelectItem>
                </SelectContent>
              </Select>

              <Textarea
                placeholder="Tilføj en note..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={3}
              />

              <Button 
                className="w-full" 
                onClick={() => addNoteMutation.mutate()}
                disabled={!newNote.trim() || addNoteMutation.isPending}
              >
                <Plus className="h-4 w-4 mr-2" />
                Tilføj note
              </Button>

              <Separator />

              <div className="space-y-3">
                {candidate.notes ? (
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {candidate.notes}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Ingen noter endnu
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Communication history */}
        <Card>
          <CardHeader>
            <CardTitle>Kommunikation</CardTitle>
          </CardHeader>
          <CardContent>
            {communications.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Ingen kommunikation registreret</p>
              </div>
            ) : (
              <div className="space-y-3">
                {communications.map((comm: any) => (
                  <div key={comm.id} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                    <div className="flex-shrink-0">
                      {comm.type === "sms" && <MessageSquare className="h-5 w-5 text-blue-500" />}
                      {comm.type === "email" && <Mail className="h-5 w-5 text-purple-500" />}
                      {comm.type === "call" && <Phone className="h-5 w-5 text-green-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{comm.type.toUpperCase()}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(comm.created_at), "d. MMM yyyy HH:mm", { locale: da })}
                        </span>
                      </div>
                      <p className="mt-1 text-sm">{comm.content || "Ingen indhold"}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
    </MainLayout>
  );
}