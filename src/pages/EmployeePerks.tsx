import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Copy, Gift, Globe, MapPin, Pencil, Plus, Search, Trash2, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useEmployeePerks,
  useCanManagePerks,
  useDeletePerk,
  type EmployeePerk,
  type PerkRedemptionType,
} from "@/hooks/useEmployeePerks";
import { PerkDialog } from "@/components/perks/PerkDialog";

const TYPE_LABEL: Record<PerkRedemptionType, string> = {
  online: "Online",
  fysisk: "Fysisk",
  begge: "Online & fysisk",
};

const FILTERS: Array<{ value: "alle" | PerkRedemptionType; label: string }> = [
  { value: "alle", label: "Alle" },
  { value: "online", label: "Online" },
  { value: "fysisk", label: "Fysisk" },
  { value: "begge", label: "Begge" },
];

export default function EmployeePerks() {
  const { toast } = useToast();
  const { data: perks = [], isLoading } = useEmployeePerks();
  const { canManage } = useCanManagePerks();
  const deletePerk = useDeletePerk();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"alle" | PerkRedemptionType>("alle");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeePerk | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmployeePerk | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return perks.filter((p) => {
      if (filter !== "alle" && p.redemption_type !== filter) return false;
      if (!term) return true;
      return (
        p.partner_name.toLowerCase().includes(term) ||
        (p.description ?? "").toLowerCase().includes(term)
      );
    });
  }, [perks, search, filter]);

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast({ title: "Rabatkode kopieret", description: code });
    } catch {
      toast({ title: "Kunne ikke kopiere", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deletePerk.mutateAsync(deleteTarget.id);
      toast({ title: "Aftale slettet" });
    } catch (error) {
      toast({
        title: "Kunne ikke slette",
        description: error instanceof Error ? error.message : "Ukendt fejl",
        variant: "destructive",
      });
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Gift className="h-6 w-6 text-primary" />
            Fordele
          </h1>
          <p className="text-sm text-muted-foreground">
            Rabataftaler vi har som medarbejdere hos Copenhagen Sales.
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Tilføj aftale
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Søg efter partner eller beskrivelse"
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={filter === f.value ? "default" : "outline"}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Indlæser...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Der er ingen aftaler at vise endnu.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((perk) => (
            <Card key={perk.id} className={perk.is_active ? "" : "opacity-70"}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg">{perk.partner_name}</CardTitle>
                  <div className="flex items-center gap-1">
                    <Badge variant="secondary" className="gap-1">
                      {perk.redemption_type === "fysisk" ? (
                        <MapPin className="h-3 w-3" />
                      ) : (
                        <Globe className="h-3 w-3" />
                      )}
                      {TYPE_LABEL[perk.redemption_type]}
                    </Badge>
                    {!perk.is_active && <Badge variant="outline">Inaktiv</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {perk.discount_value && (
                  <p className="text-xl font-bold text-primary">{perk.discount_value}</p>
                )}

                {perk.description && (
                  <p className="whitespace-pre-line text-sm text-muted-foreground">{perk.description}</p>
                )}

                {perk.address && (
                  <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{perk.address}</span>
                  </p>
                )}


                {perk.discount_code && (
                  <div className="flex items-center gap-2">
                    <code className="rounded bg-muted px-2 py-1 text-sm font-semibold">
                      {perk.discount_code}
                    </code>
                    <Button size="sm" variant="ghost" className="gap-1" onClick={() => copyCode(perk.discount_code!)}>
                      <Copy className="h-3.5 w-3.5" />
                      Kopiér
                    </Button>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {perk.link_url && (
                    <Button size="sm" variant="outline" className="gap-1" asChild>
                      <a href={perk.link_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                        Åbn link
                      </a>
                    </Button>
                  )}
                  {canManage && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1"
                        onClick={() => {
                          setEditing(perk);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Ret
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(perk)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Slet
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PerkDialog open={dialogOpen} onOpenChange={setDialogOpen} perk={editing} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet aftale?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.partner_name} fjernes permanent. Du kan i stedet sætte aftalen inaktiv.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Slet</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
