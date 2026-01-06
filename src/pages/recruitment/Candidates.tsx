import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MainLayout } from "@/components/layout/MainLayout";
import { Search, Plus, SlidersHorizontal, Phone, MessageSquare, PhoneIncoming, PhoneOutgoing, Trash2 } from "lucide-react";
import { CandidateCard } from "@/components/recruitment/CandidateCard";
import { NewCandidateDialog } from "@/components/recruitment/NewCandidateDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "sonner";
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
  applications?: Application[];
}

interface CallLog {
  id: string;
  candidate_id: string | null;
  employee_id: string | null;
  direction: string;
  from_number: string | null;
  to_number: string | null;
  status: string | null;
  started_at: string;
  duration_seconds: number | null;
}

interface SmsLog {
  id: string;
  phone_number: string | null;
  content: string | null;
  direction: string;
  type: string;
  created_at: string;
}

export default function Candidates() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [showNewCandidateDialog, setShowNewCandidateDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");

  const { data: candidatesWithApps = [], isLoading, refetch } = useQuery({
    queryKey: ["candidates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select("*, applications(*)")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Candidate[];
    },
  });

  // Fetch call logs
  const { data: callLogs = [] } = useQuery({
    queryKey: ["recruitment-call-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_records")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as CallLog[];
    },
  });

  // Fetch SMS/communication logs
  const { data: smsLogs = [] } = useQuery({
    queryKey: ["recruitment-sms-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("communication_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as SmsLog[];
    },
  });

  const filteredCandidates = candidatesWithApps
    .filter((candidate) => {
      // Search filter
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        candidate.first_name?.toLowerCase().includes(searchLower) ||
        candidate.last_name?.toLowerCase().includes(searchLower) ||
        candidate.email?.toLowerCase().includes(searchLower) ||
        candidate.phone?.includes(searchTerm);

      if (!matchesSearch) return false;

      // Status filter
      if (statusFilter === "all") return true;
      return candidate.status === statusFilter;
    })
    .sort((a, b) => {
      const aDate = new Date(a.created_at).getTime();
      const bDate = new Date(b.created_at).getTime();

      if (sortBy === "newest") {
        return bDate - aDate;
      } else {
        return aDate - bDate;
      }
    });

  const totalApplications = candidatesWithApps.reduce(
    (sum, c) => sum + (c.applications?.length || 0),
    0
  );

  // Helper to find candidate name by phone
  const findCandidateByPhone = (phone: string | null) => {
    if (!phone) return null;
    const cleaned = phone.replace(/[\s\-\+\(\)]/g, '');
    return candidatesWithApps.find(c => {
      const cPhone = c.phone?.replace(/[\s\-\+\(\)]/g, '') || '';
      return cPhone.includes(cleaned) || cleaned.includes(cPhone);
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDeleteCallLog = async (id: string) => {
    try {
      const { error } = await supabase.from("call_records").delete().eq("id", id);
      if (error) throw error;
      toast.success("Opkald slettet");
      queryClient.invalidateQueries({ queryKey: ["recruitment-call-logs"] });
    } catch (error) {
      console.error("Error deleting call log:", error);
      toast.error("Kunne ikke slette opkald");
    }
  };

  const handleDeleteSmsLog = async (id: string) => {
    try {
      const { error } = await supabase.from("communication_logs").delete().eq("id", id);
      if (error) throw error;
      toast.success("Besked slettet");
      queryClient.invalidateQueries({ queryKey: ["recruitment-sms-logs"] });
    } catch (error) {
      console.error("Error deleting message:", error);
      toast.error("Kunne ikke slette besked");
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Indlæser kandidater...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Kandidater</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              {candidatesWithApps.length} kandidater · {totalApplications} ansøgninger
            </p>
          </div>
          <Button onClick={() => setShowNewCandidateDialog(true)} className="w-full md:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Tilføj kandidat
          </Button>
        </div>

        <NewCandidateDialog
          open={showNewCandidateDialog}
          onOpenChange={setShowNewCandidateDialog}
        />

        {/* Search & Filters */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Søg efter navn, email eller telefon..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-background border-border"
            />
          </div>

          <div className="flex items-start gap-4 flex-col md:flex-row">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filtre:</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 w-full">
              <div className="space-y-2">
                <Label htmlFor="status-filter" className="text-sm">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="status-filter" className="bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="all">Alle statuser</SelectItem>
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="sort-by" className="text-sm">Sortering</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger id="sort-by" className="bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="newest">Nyeste ansøgninger først</SelectItem>
                    <SelectItem value="oldest">Ældste ansøgninger først</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Main Grid: Candidates + Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Candidates List - Takes 2 columns on large screens */}
          <div className="lg:col-span-2 space-y-3">
            {filteredCandidates.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Ingen kandidater fundet</p>
              </div>
            ) : (
              filteredCandidates.map((candidate) => (
                <CandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  applications={candidate.applications}
                  onUpdate={refetch}
                />
              ))
            )}
          </div>

          {/* Right sidebar with Call Logs and Chat History - Visible on all screens */}
          <div className="space-y-4 order-first lg:order-last">
            {/* Call Logs */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Opkaldslog ({callLogs.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ScrollArea className="h-[200px] lg:h-[300px]">
                  {callLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Ingen opkald endnu</p>
                  ) : (
                    <div className="space-y-2">
                      {callLogs.map((log) => {
                        const candidate = findCandidateByPhone(log.direction === 'outbound' ? log.to_number : log.from_number);
                        return (
                          <div key={log.id} className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors group">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                              log.direction === 'outbound' ? 'bg-blue-500/20' : 'bg-green-500/20'
                            }`}>
                              {log.direction === 'outbound' ? (
                                <PhoneOutgoing className="w-4 h-4 text-blue-500" />
                              ) : (
                                <PhoneIncoming className="w-4 h-4 text-green-500" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {candidate ? `${candidate.first_name} ${candidate.last_name}` : (log.to_number || log.from_number || 'Ukendt')}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{format(new Date(log.started_at), 'dd MMM HH:mm', { locale: da })}</span>
                                <span>·</span>
                                <span>{formatDuration(log.duration_seconds)}</span>
                              </div>
                            </div>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Slet opkald?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Er du sikker på, at du vil slette dette opkald? Denne handling kan ikke fortrydes.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuller</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteCallLog(log.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Slet
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* SMS/Chat History */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Beskeder ({smsLogs.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ScrollArea className="h-[200px] lg:h-[300px]">
                  {smsLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Ingen beskeder endnu</p>
                  ) : (
                    <div className="space-y-2">
                      {smsLogs.map((log) => {
                        const candidate = findCandidateByPhone(log.phone_number);
                        return (
                          <div key={log.id} className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors group">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                              log.direction === 'outbound' ? 'bg-blue-500/20' : 'bg-green-500/20'
                            }`}>
                              <MessageSquare className={`w-4 h-4 ${log.direction === 'outbound' ? 'text-blue-500' : 'text-green-500'}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {candidate ? `${candidate.first_name} ${candidate.last_name}` : (log.phone_number || 'Ukendt')}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">{log.content}</p>
                              <span className="text-[10px] text-muted-foreground">
                                {format(new Date(log.created_at), 'dd MMM HH:mm', { locale: da })}
                              </span>
                            </div>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Slet besked?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Er du sikker på, at du vil slette denne besked? Denne handling kan ikke fortrydes.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuller</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteSmsLog(log.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Slet
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}