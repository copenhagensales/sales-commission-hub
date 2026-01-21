import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Monitor, ClipboardList, Users, Eye, Copy, ExternalLink, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";

interface TvBoardAccess {
  id: string;
  name: string;
  dashboard_slug: string;
  access_code: string;
  is_active: boolean;
  access_count: number;
  last_accessed_at: string | null;
  created_at: string;
}

interface PulseSurvey {
  id: string;
  year: number;
  month: number;
  is_active: boolean;
  created_at: string;
  completions_count?: number;
}

interface ReferralLookup {
  id: string;
  first_name: string;
  last_name: string;
  referral_code: string;
}

const DASHBOARD_NAMES: Record<string, string> = {
  relatel: "Relatel",
  tdc: "TDC",
  "field-marketing": "Field Marketing",
  overview: "Overblik",
};

export function PublicLinksOverview() {
  const baseUrl = window.location.origin;

  // Fetch TV Board access data
  const { data: tvBoards, isLoading: loadingTvBoards } = useQuery({
    queryKey: ["tv-board-access-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tv_board_access")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as TvBoardAccess[];
    },
  });

  // Fetch Pulse Surveys
  const { data: surveys, isLoading: loadingSurveys } = useQuery({
    queryKey: ["pulse-surveys-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pulse_surveys")
        .select("id, year, month, is_active, created_at")
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      if (error) throw error;

      // Get completion counts
      const surveysWithCounts = await Promise.all(
        (data || []).map(async (survey) => {
          const { count } = await supabase
            .from("pulse_survey_completions")
            .select("*", { count: "exact", head: true })
            .eq("survey_id", survey.id);
          return { ...survey, completions_count: count || 0 };
        })
      );

      return surveysWithCounts as PulseSurvey[];
    },
  });

  // Fetch Referral Links (limited to 50 most recent)
  const { data: referrals, isLoading: loadingReferrals } = useQuery({
    queryKey: ["referral-lookup-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_referral_lookup")
        .select("id, first_name, last_name, referral_code")
        .order("first_name")
        .limit(100);
      if (error) throw error;
      return data as ReferralLookup[];
    },
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} kopieret til udklipsholder`);
  };

  const totalViews = tvBoards?.reduce((sum, board) => sum + (board.access_count || 0), 0) || 0;
  const activeTvBoards = tvBoards?.filter((b) => b.is_active).length || 0;
  const activeSurveys = surveys?.filter((s) => s.is_active).length || 0;

  const getMonthName = (month: number) => {
    const date = new Date(2024, month - 1, 1);
    return format(date, "MMMM", { locale: da });
  };

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Monitor className="h-8 w-8 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{activeTvBoards}</div>
                <div className="text-xs text-muted-foreground">Aktive TV Boards</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <ClipboardList className="h-8 w-8 text-emerald-500" />
              <div>
                <div className="text-2xl font-bold">{activeSurveys}</div>
                <div className="text-xs text-muted-foreground">Aktive Surveys</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-purple-500" />
              <div>
                <div className="text-2xl font-bold">{referrals?.length || 0}</div>
                <div className="text-xs text-muted-foreground">Referral Links</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Eye className="h-8 w-8 text-amber-500" />
              <div>
                <div className="text-2xl font-bold">{totalViews.toLocaleString("da-DK")}</div>
                <div className="text-xs text-muted-foreground">Samlet Visninger</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* TV Boards section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            TV Board Links
          </CardTitle>
          <CardDescription>
            Offentlige TV-skærm dashboards med adgangskode
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingTvBoards ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : tvBoards?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Ingen TV board links oprettet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Navn</TableHead>
                  <TableHead>Dashboard</TableHead>
                  <TableHead>Adgangskode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sidst brugt</TableHead>
                  <TableHead className="text-right">Visninger</TableHead>
                  <TableHead className="text-right">Handlinger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tvBoards?.map((board) => (
                  <TableRow key={board.id}>
                    <TableCell className="font-medium">{board.name}</TableCell>
                    <TableCell>{DASHBOARD_NAMES[board.dashboard_slug] || board.dashboard_slug}</TableCell>
                    <TableCell>
                      <code className="bg-muted px-2 py-1 rounded text-sm">{board.access_code}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={board.is_active ? "default" : "secondary"}>
                        {board.is_active ? "Aktiv" : "Inaktiv"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {board.last_accessed_at
                        ? format(new Date(board.last_accessed_at), "d. MMM yyyy", { locale: da })
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">{board.access_count}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard(`${baseUrl}/t/${board.access_code}`, "Link")}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(`/t/${board.access_code}`, "_blank")}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pulse Surveys section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Pulse Surveys
          </CardTitle>
          <CardDescription>
            Månedlige medarbejder-surveys
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingSurveys ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : surveys?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Ingen surveys oprettet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Periode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Oprettet</TableHead>
                  <TableHead className="text-right">Besvarelser</TableHead>
                  <TableHead className="text-right">Handlinger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {surveys?.map((survey) => (
                  <TableRow key={survey.id}>
                    <TableCell className="font-medium">
                      {getMonthName(survey.month)} {survey.year}
                    </TableCell>
                    <TableCell>
                      <Badge variant={survey.is_active ? "default" : "secondary"}>
                        {survey.is_active ? "Aktiv" : "Afsluttet"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(survey.created_at), "d. MMM yyyy", { locale: da })}
                    </TableCell>
                    <TableCell className="text-right">{survey.completions_count}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard(`${baseUrl}/survey`, "Survey link")}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open("/survey", "_blank")}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Referral Links section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Referral Links
          </CardTitle>
          <CardDescription>
            Medarbejdernes personlige henvisningslinks
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingReferrals ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : referrals?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Ingen referral links fundet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medarbejder</TableHead>
                  <TableHead>Kode</TableHead>
                  <TableHead className="text-right">Handlinger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referrals?.map((referral) => (
                  <TableRow key={referral.id}>
                    <TableCell className="font-medium">
                      {referral.first_name} {referral.last_name}
                    </TableCell>
                    <TableCell>
                      <code className="bg-muted px-2 py-1 rounded text-sm">{referral.referral_code}</code>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard(`${baseUrl}/refer/${referral.referral_code}`, "Referral link")}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(`/refer/${referral.referral_code}`, "_blank")}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
