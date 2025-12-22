import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Monitor, Plus, Copy, Trash2, ExternalLink, Eye } from "lucide-react";
import { DASHBOARD_LIST } from "@/config/dashboards";
import { format } from "date-fns";
import { da } from "date-fns/locale";

interface TvBoardAccess {
  id: string;
  dashboard_slug: string;
  access_code: string;
  name: string | null;
  is_active: boolean;
  created_at: string;
  last_accessed_at: string | null;
  access_count: number;
}

export default function TvBoardAdmin() {
  const queryClient = useQueryClient();
  const [newBoardName, setNewBoardName] = useState("");
  const [selectedDashboard, setSelectedDashboard] = useState("");

  const { data: boards = [], isLoading } = useQuery({
    queryKey: ["tv-board-access"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tv_board_access")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as TvBoardAccess[];
    },
  });

  const createBoardMutation = useMutation({
    mutationFn: async ({ name, dashboardSlug }: { name: string; dashboardSlug: string }) => {
      // Generate a random 6-character code
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let code = "";
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const { data, error } = await supabase
        .from("tv_board_access")
        .insert({
          name,
          dashboard_slug: dashboardSlug,
          access_code: code,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tv-board-access"] });
      setNewBoardName("");
      setSelectedDashboard("");
      toast.success("TV Board oprettet!");
    },
    onError: (error: any) => {
      toast.error("Kunne ikke oprette TV Board: " + error.message);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("tv_board_access")
        .update({ is_active: isActive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tv-board-access"] });
    },
  });

  const deleteBoardMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tv_board_access")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tv-board-access"] });
      toast.success("TV Board slettet");
    },
  });

  const copyLink = (code: string, slug: string) => {
    const url = `${window.location.origin}/tv/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success(`Link kopieret! Kode: ${code}`);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Kode kopieret!");
  };

  const getDashboardName = (slug: string) => {
    return DASHBOARD_LIST.find(d => d.slug === slug)?.name || slug;
  };

  const handleCreate = () => {
    if (!newBoardName.trim() || !selectedDashboard) {
      toast.error("Udfyld venligst alle felter");
      return;
    }
    createBoardMutation.mutate({ name: newBoardName, dashboardSlug: selectedDashboard });
  };

  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Monitor className="h-8 w-8 text-primary" />
              TV Board Administration
            </h1>
            <p className="text-muted-foreground mt-1">
              Opret og administrer adgangskoder til TV-dashboards
            </p>
          </div>
        </div>

        {/* Create new board */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Opret nyt TV Board
            </CardTitle>
            <CardDescription>
              Opret et nyt TV board med en unik adgangskode
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="name">Navn (valgfrit)</Label>
                <Input
                  id="name"
                  placeholder="f.eks. Kontor TV 1"
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="dashboard">Dashboard</Label>
                <Select value={selectedDashboard} onValueChange={setSelectedDashboard}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vælg dashboard" />
                  </SelectTrigger>
                  <SelectContent>
                    {DASHBOARD_LIST.map((dashboard) => (
                      <SelectItem key={dashboard.slug} value={dashboard.slug}>
                        {dashboard.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} disabled={createBoardMutation.isPending}>
                <Plus className="h-4 w-4 mr-2" />
                Opret
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Existing boards */}
        <Card>
          <CardHeader>
            <CardTitle>Eksisterende TV Boards</CardTitle>
            <CardDescription>
              Administrer adgangskoder og se statistik
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Indlæser...</p>
            ) : boards.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Ingen TV Boards oprettet endnu
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Navn</TableHead>
                    <TableHead>Dashboard</TableHead>
                    <TableHead>Adgangskode</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sidst brugt</TableHead>
                    <TableHead>Visninger</TableHead>
                    <TableHead className="text-right">Handlinger</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boards.map((board) => (
                    <TableRow key={board.id}>
                      <TableCell className="font-medium">
                        {board.name || <span className="text-muted-foreground">Ikke navngivet</span>}
                      </TableCell>
                      <TableCell>{getDashboardName(board.dashboard_slug)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="bg-muted px-2 py-1 rounded font-mono text-lg tracking-wider">
                            {board.access_code}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyCode(board.access_code)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={board.is_active}
                            onCheckedChange={(checked) =>
                              toggleActiveMutation.mutate({ id: board.id, isActive: checked })
                            }
                          />
                          <Badge variant={board.is_active ? "default" : "secondary"}>
                            {board.is_active ? "Aktiv" : "Inaktiv"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {board.last_accessed_at
                          ? format(new Date(board.last_accessed_at), "d. MMM yyyy HH:mm", { locale: da })
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Eye className="h-4 w-4 text-muted-foreground" />
                          {board.access_count}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyLink(board.access_code, board.dashboard_slug)}
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Kopier link
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm("Er du sikker på du vil slette dette TV Board?")) {
                                deleteBoardMutation.mutate(board.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
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

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Sådan bruger du TV Boards</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Opret et nyt TV Board og vælg det dashboard der skal vises</li>
              <li>Kopier linket og åbn det i en browser på TV'et</li>
              <li>Indtast den 6-tegns adgangskode</li>
              <li>Dashboardet opdateres automatisk hver 30. sekund</li>
            </ol>
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm font-medium">TV Link format:</p>
              <code className="text-primary">{window.location.origin}/tv/[dashboard-slug]</code>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
