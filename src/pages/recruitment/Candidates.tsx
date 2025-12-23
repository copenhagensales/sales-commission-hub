import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MainLayout } from "@/components/layout/MainLayout";
import { Search, Plus, SlidersHorizontal } from "lucide-react";
import { CandidateCard } from "@/components/recruitment/CandidateCard";
import { NewCandidateDialog } from "@/components/recruitment/NewCandidateDialog";

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

export default function Candidates() {
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

        <div className="grid gap-3">
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
      </div>
    </MainLayout>
  );
}