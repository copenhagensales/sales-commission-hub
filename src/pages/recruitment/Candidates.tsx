import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, Users, UserCheck, Calendar, Phone } from "lucide-react";
import { toast } from "sonner";
import { CandidateCard } from "@/components/recruitment/CandidateCard";
import { NewCandidateDialog } from "@/components/recruitment/NewCandidateDialog";

type CandidateStatus = "new" | "contacted" | "interview_scheduled" | "interviewed" | "offer_sent" | "hired" | "rejected";

const statusLabels: Record<CandidateStatus, string> = {
  new: "Ny ansøgning",
  contacted: "Kontaktet",
  interview_scheduled: "Samtale planlagt",
  interviewed: "Samtale afholdt",
  offer_sent: "Tilbud sendt",
  hired: "Ansat",
  rejected: "Afvist",
};

const statusColors: Record<CandidateStatus, string> = {
  new: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  contacted: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  interview_scheduled: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  interviewed: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  offer_sent: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  hired: "bg-green-500/20 text-green-400 border-green-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function Candidates() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<CandidateStatus | "all">("all");
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ["candidates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select("*, applications(*)")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const filteredCandidates = candidates.filter((candidate) => {
    const matchesSearch =
      candidate.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      candidate.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      candidate.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      candidate.phone?.includes(searchQuery);

    const matchesTab = activeTab === "all" || candidate.status === activeTab;

    return matchesSearch && matchesTab;
  });

  const statusCounts = candidates.reduce((acc, candidate) => {
    const status = candidate.status as CandidateStatus;
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<CandidateStatus, number>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Kandidater</h1>
          <p className="text-muted-foreground">Administrer ansøgere og rekrutteringsprocessen</p>
        </div>
        <Button onClick={() => setIsNewDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Ny kandidat
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total kandidater</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{candidates.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Nye ansøgninger</CardTitle>
            <Plus className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">{statusCounts.new || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Planlagte samtaler</CardTitle>
            <Calendar className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-400">{statusCounts.interview_scheduled || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ansat</CardTitle>
            <UserCheck className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">{statusCounts.hired || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Søg efter navn, email eller telefon..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-background border-border"
          />
        </div>
      </div>

      {/* Status Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CandidateStatus | "all")}>
        <TabsList className="bg-muted/50 border border-border">
          <TabsTrigger value="all" className="data-[state=active]:bg-background">
            Alle ({candidates.length})
          </TabsTrigger>
          {Object.entries(statusLabels).map(([status, label]) => (
            <TabsTrigger key={status} value={status} className="data-[state=active]:bg-background">
              {label} ({statusCounts[status as CandidateStatus] || 0})
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Indlæser kandidater...</div>
          ) : filteredCandidates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Ingen kandidater fundet
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCandidates.map((candidate) => (
                <CandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  statusLabels={statusLabels}
                  statusColors={statusColors}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <NewCandidateDialog
        open={isNewDialogOpen}
        onOpenChange={setIsNewDialogOpen}
      />
    </div>
  );
}
