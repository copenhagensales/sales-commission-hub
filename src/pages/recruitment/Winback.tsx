import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { CandidateCard } from "@/components/recruitment/CandidateCard";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  notes: string | null;
  created_at: string;
  status: string;
  source: string | null;
  applied_position: string | null;
  applications?: Application[];
}

export default function Winback() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [activeTab, setActiveTab] = useState<string>("ghostet");

  const { data: candidates = [], isLoading, refetch } = useQuery({
    queryKey: ["winback-candidates", activeTab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select("*, applications(*)")
        .eq("status", activeTab)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Candidate[];
    },
  });

  const filteredCandidates = candidates.filter((candidate) => {
    const searchLower = searchTerm.toLowerCase();
    const fullName = `${candidate.first_name} ${candidate.last_name}`.toLowerCase();
    return (
      fullName.includes(searchLower) ||
      candidate.email?.toLowerCase().includes(searchLower) ||
      candidate.phone?.includes(searchTerm)
    );
  });

  const sortedCandidates = [...filteredCandidates].sort((a, b) => {
    switch (sortBy) {
      case "newest":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case "oldest":
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case "name":
        return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
      default:
        return 0;
    }
  });

  const renderCandidateList = () => {
    if (isLoading) {
      return (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Indlæser kandidater...</p>
        </div>
      );
    }

    if (sortedCandidates.length === 0) {
      return (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {searchTerm
              ? "Ingen kandidater matchede din søgning"
              : `Ingen ${activeTab === "ghostet" ? "ghostede" : activeTab === "takket_nej" ? "kandidater der har takket nej" : "kandidater interesseret i kundeservice"} endnu`}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {sortedCandidates.map((candidate) => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            applications={candidate.applications}
            onUpdate={refetch}
          />
        ))}
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Winback kandidater</h1>
          <p className="text-muted-foreground">
            Kandidater der har ghostet eller takket nej - klar til winback
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-3">
            <TabsTrigger value="ghostet">Ghostet</TabsTrigger>
            <TabsTrigger value="takket_nej">Takket nej</TabsTrigger>
            <TabsTrigger value="interesseret_i_kundeservice">Kundeservice</TabsTrigger>
          </TabsList>

          <div className="mt-6 space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Søg efter navn, email eller telefon..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-background border-border"
                />
              </div>

              <div className="w-full md:w-48">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Sorter efter" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="newest">Nyeste først</SelectItem>
                    <SelectItem value="oldest">Ældste først</SelectItem>
                    <SelectItem value="name">Navn (A-Å)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <TabsContent value="ghostet" className="mt-0">
              {renderCandidateList()}
            </TabsContent>

            <TabsContent value="takket_nej" className="mt-0">
              {renderCandidateList()}
            </TabsContent>

            <TabsContent value="interesseret_i_kundeservice" className="mt-0">
              {renderCandidateList()}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </MainLayout>
  );
}
