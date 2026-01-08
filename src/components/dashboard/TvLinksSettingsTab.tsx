import { useState } from "react";
import { Monitor, Copy, Trash2, Plus, Loader2, ExternalLink, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DASHBOARD_LIST } from "@/config/dashboards";
import { Badge } from "@/components/ui/badge";

interface TvBoardAccess {
  id: string;
  dashboard_slug: string;
  dashboard_slugs: string[] | null;
  access_code: string;
  name: string | null;
  is_active: boolean;
  created_at: string;
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function TvLinksSettingsTab() {
  const [newCodeName, setNewCodeName] = useState("");
  const [selectedDashboards, setSelectedDashboards] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const { data: accessCodes = [], isLoading } = useQuery({
    queryKey: ["tv-board-access-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tv_board_access")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as TvBoardAccess[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({ name, dashboardSlugs }: { name: string; dashboardSlugs: string[] }) => {
      const code = generateCode();
      const { error } = await supabase.from("tv_board_access").insert({
        access_code: code,
        dashboard_slug: dashboardSlugs[0], // Keep first for backward compatibility
        dashboard_slugs: dashboardSlugs,
        name: name || null,
        is_active: true,
      });
      if (error) throw error;
      return code;
    },
    onSuccess: (code) => {
      queryClient.invalidateQueries({ queryKey: ["tv-board-access-all"] });
      setNewCodeName("");
      setSelectedDashboards([]);
      toast.success(`Adgangskode oprettet: ${code}`);
    },
    onError: () => {
      toast.error("Kunne ikke oprette adgangskode");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tv_board_access")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tv-board-access-all"] });
      toast.success("Adgangskode deaktiveret");
    },
    onError: () => {
      toast.error("Kunne ikke deaktivere adgangskode");
    },
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} kopieret`);
  };

  const getTvUrl = (code: string) => `${window.location.origin}/t/${code}`;

  const getDashboardName = (slug: string) => {
    return DASHBOARD_LIST.find((d) => d.slug === slug)?.name || slug;
  };

  const getDashboardSlugs = (code: TvBoardAccess): string[] => {
    // Prefer dashboard_slugs array, fallback to single dashboard_slug
    return code.dashboard_slugs?.length ? code.dashboard_slugs : [code.dashboard_slug];
  };

  const toggleDashboard = (slug: string) => {
    setSelectedDashboards((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const handleCreate = () => {
    if (selectedDashboards.length === 0) {
      toast.error("Vælg mindst ét dashboard");
      return;
    }
    createMutation.mutate({ name: newCodeName, dashboardSlugs: selectedDashboards });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="h-5 w-5" />
          TV Links
        </CardTitle>
        <CardDescription>
          Opret og administrer TV-adgangskoder til dine dashboards
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Create new code */}
        <div className="p-4 border rounded-lg bg-muted/30">
          <p className="text-sm font-medium mb-3">Opret ny TV-adgangskode:</p>
          
          <div className="mb-4">
            <Label className="text-sm text-muted-foreground mb-2 block">Vælg dashboards:</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 border rounded-md bg-background">
              {DASHBOARD_LIST.map((dashboard) => (
                <div key={dashboard.slug} className="flex items-center space-x-2">
                  <Checkbox
                    id={`dashboard-${dashboard.slug}`}
                    checked={selectedDashboards.includes(dashboard.slug)}
                    onCheckedChange={() => toggleDashboard(dashboard.slug)}
                  />
                  <Label
                    htmlFor={`dashboard-${dashboard.slug}`}
                    className="text-sm cursor-pointer truncate"
                    title={dashboard.name}
                  >
                    {dashboard.name}
                  </Label>
                </div>
              ))}
            </div>
            {selectedDashboards.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {selectedDashboards.length} dashboard{selectedDashboards.length !== 1 ? "s" : ""} valgt
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Navn (valgfrit)"
              value={newCodeName}
              onChange={(e) => setNewCodeName(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending || selectedDashboards.length === 0}
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Opret
            </Button>
          </div>
        </div>

        {/* Existing codes */}
        <div>
          <p className="text-sm font-medium mb-3">Aktive adgangskoder:</p>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : accessCodes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Ingen aktive TV-links. Opret en ny ovenfor.
            </div>
          ) : (
            <div className="space-y-2">
              {accessCodes.map((code) => {
                const slugs = getDashboardSlugs(code);
                return (
                  <div
                    key={code.id}
                    className="flex items-start justify-between gap-4 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">
                          {code.name || "Unavngivet"}
                        </span>
                        <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                          {code.access_code}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {slugs.map((slug) => (
                          <Badge key={slug} variant="secondary" className="text-xs">
                            {getDashboardName(slug)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(getTvUrl(code.access_code), "Link")}
                        title="Kopier link"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => window.open(getTvUrl(code.access_code), "_blank")}
                        title="Åbn i nyt vindue"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate(code.id)}
                        disabled={deleteMutation.isPending}
                        title="Deaktiver"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-4 border rounded-lg bg-muted/30">
          <p className="text-sm font-medium mb-2">Sådan bruges TV Links:</p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Vælg ét eller flere dashboards til ét TV-link</li>
            <li>Med flere dashboards roterer visningen automatisk</li>
            <li>Kopier linket og åbn det på din TV-skærm</li>
            <li>Linket kræver ingen login og opdateres automatisk</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
