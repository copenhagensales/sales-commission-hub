import { useState } from "react";
import { Monitor, Copy, Trash2, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DASHBOARD_LIST } from "@/config/dashboards";

interface TvBoardQuickGeneratorProps {
  dashboardSlug: string;
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function TvBoardQuickGenerator({ dashboardSlug }: TvBoardQuickGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [newCodeName, setNewCodeName] = useState("");
  const queryClient = useQueryClient();

  const dashboardName = DASHBOARD_LIST.find(d => d.slug === dashboardSlug)?.name || dashboardSlug;

  const { data: accessCodes = [], isLoading } = useQuery({
    queryKey: ["tv-board-access", dashboardSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tv_board_access")
        .select("*")
        .eq("dashboard_slug", dashboardSlug)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const code = generateCode();
      const { error } = await supabase.from("tv_board_access").insert({
        access_code: code,
        dashboard_slug: dashboardSlug,
        name: name || null,
        is_active: true,
      });
      if (error) throw error;
      return code;
    },
    onSuccess: (code) => {
      queryClient.invalidateQueries({ queryKey: ["tv-board-access", dashboardSlug] });
      setNewCodeName("");
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
      queryClient.invalidateQueries({ queryKey: ["tv-board-access", dashboardSlug] });
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

  const tvUrl = `${window.location.origin}/tv/${dashboardSlug}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Monitor className="h-4 w-4" />
          <span className="hidden md:inline">TV Link</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            TV Link til "{dashboardName}"
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Existing codes */}
          <div>
            <p className="text-sm font-medium mb-2">Eksisterende adgangskoder:</p>
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : accessCodes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Ingen aktive koder</p>
            ) : (
              <div className="space-y-2">
                {accessCodes.map((code) => (
                  <div
                    key={code.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-md border bg-muted/50"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block">
                        {code.name || "Unavngivet"}
                      </span>
                      <span className="text-xs font-mono text-muted-foreground">
                        {code.access_code}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => copyToClipboard(code.access_code, "Kode")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate(code.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Create new code */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2">Opret ny adgangskode:</p>
            <div className="flex gap-2">
              <Input
                placeholder="Navn (valgfrit)"
                value={newCodeName}
                onChange={(e) => setNewCodeName(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={() => createMutation.mutate(newCodeName)}
                disabled={createMutation.isPending}
                size="sm"
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* TV URL */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2">TV URL:</p>
            <div className="flex gap-2">
              <Input value={tvUrl} readOnly className="flex-1 text-xs font-mono" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(tvUrl, "URL")}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
