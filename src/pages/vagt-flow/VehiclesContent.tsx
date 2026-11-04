import { useState } from "react";
import { Car, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SkeletonList } from "@/components/mobile";
import { toast } from "sonner";
import {
  useAllVehicles, useCanManageVehicles, useSaveVehicle, useSetVehicleActive, useDeleteVehicle, type Vehicle,
} from "@/hooks/useVehicles";

export default function VehiclesContent() {
  const { data: vehicles, isLoading } = useAllVehicles();
  const { data: canManage } = useCanManageVehicles();
  const save = useSaveVehicle();
  const setActive = useSetVehicleActive();
  const del = useDeleteVehicle();
  const [sletter, setSletter] = useState<Vehicle | null>(null);
  const [editing, setEditing] = useState<Vehicle | "new" | null>(null);
  const [form, setForm] = useState({ name: "", license_plate: "", notes: "" });

  const open = (v: Vehicle | "new") => {
    setEditing(v);
    setForm(v === "new" ? { name: "", license_plate: "", notes: "" }
      : { name: v.name, license_plate: v.license_plate, notes: v.notes ?? "" });
  };

  const submit = () => {
    if (!form.name.trim() || !form.license_plate.trim()) {
      toast.error("Udfyld navn og nummerplade.");
      return;
    }
    save.mutate(
      {
        id: editing && editing !== "new" ? editing.id : undefined,
        input: { name: form.name.trim(), license_plate: form.license_plate.trim(), notes: form.notes.trim() || null },
      },
      {
        onSuccess: () => { toast.success("Bilen er gemt."); setEditing(null); },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Kunne ikke gemme bilen."),
      },
    );
  };

  const toggle = (v: Vehicle) =>
    setActive.mutate(
      { id: v.id, active: !v.is_active },
      {
        onSuccess: () => toast.success(v.is_active ? "Bilen er slået fra." : "Bilen er aktiv igen."),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Kunne ikke ændre bilen."),
      },
    );

  if (isLoading) return <SkeletonList />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Aktive biler vises i »Vælg bil«. Udgåede biler slås fra, så gamle bookinger bevares.
        </p>
        {canManage && (
          <Button onClick={() => open("new")} className="min-h-11">
            <Plus className="mr-2 h-4 w-4" /> Tilføj bil
          </Button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(vehicles ?? []).map((v) => (
          <Card key={v.id} className={v.is_active ? "" : "opacity-60"}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start gap-3">
                <Car className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium break-words">{v.name}</p>
                  <p className="text-sm text-muted-foreground">{v.license_plate}</p>
                  {v.notes && <p className="mt-1 text-sm text-muted-foreground break-words">{v.notes}</p>}
                </div>
                <Badge variant={v.is_active ? "default" : "secondary"}>{v.is_active ? "Aktiv" : "Udgået"}</Badge>
              </div>
              {canManage && (
                <div className="flex gap-2">
                  <Button variant="outline" className="min-h-11 flex-1" onClick={() => open(v)}>
                    <Pencil className="mr-2 h-4 w-4" /> Ret
                  </Button>
                  <Button variant="outline" className="min-h-11 flex-1" disabled={setActive.isPending} onClick={() => toggle(v)}>
                    {v.is_active ? "Slå fra" : "Slå til"}
                  </Button>
                  <Button variant="outline" className="min-h-11 min-w-11" aria-label={`Slet ${v.name}`} onClick={() => setSletter(v)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {(vehicles ?? []).length === 0 && <p className="text-sm text-muted-foreground">Ingen biler oprettet.</p>}
      </div>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Tilføj bil" : "Ret bil"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="v-name">Navn</Label>
              <Input id="v-name" className="text-base" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Fx Hvid Berlingo (Bil 5)" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="v-plate">Nummerplade</Label>
              <Input id="v-plate" className="text-base" autoCapitalize="characters" value={form.license_plate} onChange={(e) => setForm({ ...form, license_plate: e.target.value })} placeholder="Fx AB12345" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="v-notes">Note (valgfri)</Label>
              <Input id="v-notes" className="text-base" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="min-h-11" onClick={() => setEditing(null)}>Annullér</Button>
            <Button className="min-h-11" disabled={save.isPending} onClick={submit}>Gem</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={sletter !== null} onOpenChange={(o) => !o && setSletter(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Slet {sletter?.name}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Kun biler, der aldrig er brugt på en booking eller i kørsel, kan slettes. Er bilen brugt, så slå den fra i stedet.
          </p>
          <DialogFooter>
            <Button variant="outline" className="min-h-11" onClick={() => setSletter(null)}>Annullér</Button>
            <Button
              variant="destructive"
              className="min-h-11"
              disabled={del.isPending}
              onClick={() =>
                sletter &&
                del.mutate(sletter.id, {
                  onSuccess: () => { toast.success("Bilen er slettet."); setSletter(null); },
                  onError: (e) => toast.error(e instanceof Error ? e.message : "Kunne ikke slette bilen."),
                })
              }
            >
              Slet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
