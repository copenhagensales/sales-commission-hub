import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search, Users, Crown, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";

type LeadershipRoleType = "junior_teamleder" | "teamleder" | "coach" | "other";

const leadershipRoleLabels: Record<LeadershipRoleType, string> = {
  junior_teamleder: "Junior teamleder",
  teamleder: "Teamleder",
  coach: "Coach/træner",
  other: "Andet",
};

export default function CareerWishesOverview() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "team_change" | "leadership">("all");

  const { data: careerWishes, isLoading } = useQuery({
    queryKey: ["career-wishes-overview"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("career_wishes")
        .select(`
          *,
          employee:employee_master_data!career_wishes_employee_id_fkey(
            id, first_name, last_name, department, job_title
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const filteredWishes = careerWishes?.filter((wish) => {
    const employeeName = `${wish.employee?.first_name} ${wish.employee?.last_name}`.toLowerCase();
    const matchesSearch = employeeName.includes(searchQuery.toLowerCase()) ||
                          wish.desired_team?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          wish.employee?.department?.toLowerCase().includes(searchQuery.toLowerCase());

    if (filterType === "team_change") {
      return matchesSearch && wish.wants_team_change === "yes";
    }
    if (filterType === "leadership") {
      return matchesSearch && (wish.leadership_interest === "yes" || wish.leadership_interest === "maybe");
    }
    return matchesSearch;
  });

  const stats = {
    total: careerWishes?.length || 0,
    teamChange: careerWishes?.filter(w => w.wants_team_change === "yes").length || 0,
    leadership: careerWishes?.filter(w => w.leadership_interest === "yes" || w.leadership_interest === "maybe").length || 0,
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Karriereønsker oversigt</h1>
          <p className="text-muted-foreground">Se og filtrer alle indsendte karriereønsker</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-full">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">Totale ønsker</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-full">
                  <Users className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.teamChange}</p>
                  <p className="text-sm text-muted-foreground">Ønsker teamskifte</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-500/10 rounded-full">
                  <Crown className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.leadership}</p>
                  <p className="text-sm text-muted-foreground">Ledelsesinteresse</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filtrer karriereønsker</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Søg på navn, team eller afdeling..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterType} onValueChange={(v) => setFilterType(v as typeof filterType)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Vælg type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle ønsker</SelectItem>
                  <SelectItem value="team_change">Kun teamskifte</SelectItem>
                  <SelectItem value="leadership">Kun ledelsesinteresse</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Results Table */}
        <Card>
          <CardHeader>
            <CardTitle>Indsendte karriereønsker</CardTitle>
            <CardDescription>
              {filteredWishes?.length || 0} {filteredWishes?.length === 1 ? "ønske" : "ønsker"} fundet
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredWishes?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Ingen karriereønsker fundet
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medarbejder</TableHead>
                    <TableHead>Afdeling</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Detaljer</TableHead>
                    <TableHead>Indsendt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWishes?.map((wish) => (
                    <TableRow key={wish.id}>
                      <TableCell className="font-medium">
                        {wish.employee?.first_name} {wish.employee?.last_name}
                      </TableCell>
                      <TableCell>
                        {wish.employee?.department || wish.employee?.job_title || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {wish.wants_team_change === "yes" && (
                            <Badge variant="secondary" className="bg-blue-500/10 text-blue-600">
                              <Users className="h-3 w-3 mr-1" />
                              Teamskifte
                            </Badge>
                          )}
                          {(wish.leadership_interest === "yes" || wish.leadership_interest === "maybe") && (
                            <Badge variant="secondary" className="bg-amber-500/10 text-amber-600">
                              <Crown className="h-3 w-3 mr-1" />
                              Ledelse
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        <div className="space-y-1 text-sm">
                          {wish.wants_team_change === "yes" && wish.desired_team && (
                            <p><span className="text-muted-foreground">Ønsket team:</span> {wish.desired_team}</p>
                          )}
                          {wish.leadership_role_type && (
                            <p><span className="text-muted-foreground">Rolle:</span> {leadershipRoleLabels[wish.leadership_role_type as LeadershipRoleType]}</p>
                          )}
                          {wish.team_change_motivation && (
                            <p className="text-muted-foreground truncate" title={wish.team_change_motivation}>
                              {wish.team_change_motivation}
                            </p>
                          )}
                          {wish.leadership_motivation && (
                            <p className="text-muted-foreground truncate" title={wish.leadership_motivation}>
                              {wish.leadership_motivation}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(wish.created_at), "d. MMM yyyy", { locale: da })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}