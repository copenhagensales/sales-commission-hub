import { useState } from "react";
import { Monitor, Copy, Trash2, Plus, Loader2, Eye, AlertTriangle, RotateCcw, Power } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { da } from "date-fns/locale";
import { getTvBoardUrl } from "@/lib/getPublicUrl";
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
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const STALE_DAYS = 5;

function getStaleInfo(code: { last_accessed_at?: string | null; created_at?: string | null; access_count?: number | null }) {
  const ref = code.last_accessed_at || code.created_at;
  if (!ref) return { isStale: true, label: "Aldrig brugt" };
  const days = differenceInDays(new Date(), new Date(ref));
  if (days >= STALE_DAYS) return { isStale: true, label: `Ubrugt i ${days} dage` };
  return { isStale: false, label: null };
}

export function TvBoardQuickGenerator({ dashboardSlug }: TvBoardQuickGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [newCodeName, setNewCodeName] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const queryClient = useQueryClient();

  const dashboardName = DASHBOARD_LIST.find(d => d.slug === dashboardSlug)?.name || dashboardSlug;

  // Fetch ALL codes (active + inactive) for authenticated users
  const { data: allAccessCodes = [], isLoading } = useQuery({
    queryKey: ["tv-board-access", dashboardSlug, "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tv_board_access")
        .select("*")
        .eq("dashboard_slug", dashboardSlug)
        .order("is_active", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const activeCodes = allAccessCodes.filter(c => c.is_active);
  const inactiveCodes = allAccessCodes.filter(c => !c.is_active);

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

  const deactivateMutation = useMutation({
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

  const reactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tv_board_access")
        .update({ is_active: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tv-board-access", dashboardSlug] });
      toast.success("Adgangskode reaktiveret");
    },
    onError: () => {
      toast.error("Kunne ikke reaktivere adgangskode");
    },
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} kopieret`);
  };

  const getTvUrl = (code: string) => getTvBoardUrl(code);

  const renderCodeRow = (code: typeof allAccessCodes[0], isActive: boolean) => {
    const stale = getStaleInfo(code);
    return (
      <div
        key={code.id}
        className={`flex items-center justify-between gap-2 p-2 rounded-md border ${
          isActive ? "bg-muted/50" : "bg-muted/20 opacity-70 border-dashed"
        }`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate block">
              {code.name || "Unavngivet"}
            </span>
            {!isActive && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-medium">
                Deaktiveret
              </span>
            )}
            {isActive && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">
                Aktiv
              </span>
            )}
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            {code.access_code}
          </span>
          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {code.access_count || 0} visninger
            </span>
            {code.last_accessed_at && (
              <span>• Sidst: {format(new Date(code.last_accessed_at), "d. MMM HH:mm", { locale: da })}</span>
            )}
            {isActive && stale.isStale && (
              <span className="flex items-center gap-1 text-orange-500">
                <AlertTriangle className="h-3 w-3" />
                {stale.label}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          {isActive ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => copyToClipboard(getTvUrl(code.access_code), "Link")}
                title="Kopier link"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => deactivateMutation.mutate(code.id)}
                disabled={deactivateMutation.isPending}
                title="Deaktiver"
              >
                <Power className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-emerald-500 hover:text-emerald-400"
              onClick={() => reactivateMutation.mutate(code.id)}
              disabled={reactivateMutation.isPending}
              title="Reaktiver"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  };

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
          {/* Active codes */}
          <div>
            <p className="text-sm font-medium mb-2">Aktive adgangskoder:</p>
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : activeCodes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Ingen aktive koder</p>
            ) : (
              <div className="space-y-2">
                {activeCodes.map((code) => renderCodeRow(code, true))}
              </div>
            )}
          </div>

          {/* Inactive codes toggle */}
          {inactiveCodes.length > 0 && (
            <div>
              <button
                onClick={() => setShowInactive(!showInactive)}
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                <Power className="h-3 w-3" />
                {showInactive ? "Skjul" : "Vis"} deaktiverede ({inactiveCodes.length})
              </button>
              {showInactive && (
                <div className="space-y-2 mt-2">
                  {inactiveCodes.map((code) => renderCodeRow(code, false))}
                </div>
              )}
            </div>
          )}

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

          {/* Info */}
          <div className="border-t pt-4">
            <p className="text-sm text-muted-foreground">
              Klik på kopier-ikonet ved en kode for at kopiere det fulde TV-link. Deaktiverede koder kan reaktiveres.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
