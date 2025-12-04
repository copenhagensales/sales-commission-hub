import { MainLayout } from "@/components/layout/MainLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Car, Plus, Trash2, Edit, Gauge } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function VagtVehicles() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [showMileageDialog, setShowMileageDialog] = useState<any>(null);

  const [vehicleForm, setVehicleForm] = useState({
    name: "",
    license_plate: "",
    notes: "",
    is_active: true,
  });

  const [mileageForm, setMileageForm] = useState({
    date: new Date().toISOString().split("T")[0],
    start_mileage: "",
    end_mileage: "",
    notes: "",
  });

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ["vagt-vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle")
        .select("*")
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  const createVehicleMutation = useMutation({
    mutationFn: async (data: typeof vehicleForm) => {
      const { error } = await supabase.from("vehicle").insert({
        name: data.name,
        license_plate: data.license_plate,
        notes: data.notes || null,
        is_active: data.is_active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vagt-vehicles"] });
      setShowAddDialog(false);
      setVehicleForm({ name: "", license_plate: "", notes: "", is_active: true });
      toast({ title: "Køretøj oprettet" });
    },
    onError: (error: any) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const updateVehicleMutation = useMutation({
    mutationFn: async (data: { id: string } & typeof vehicleForm) => {
      const { error } = await supabase.from("vehicle").update({
        name: data.name,
        license_plate: data.license_plate,
        notes: data.notes || null,
        is_active: data.is_active,
      }).eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vagt-vehicles"] });
      setSelectedVehicle(null);
      toast({ title: "Køretøj opdateret" });
    },
  });

  const deleteVehicleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicle").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vagt-vehicles"] });
      setShowDeleteDialog(null);
      toast({ title: "Køretøj slettet" });
    },
  });

  const addMileageMutation = useMutation({
    mutationFn: async (data: { vehicle_id: string } & typeof mileageForm) => {
      const { error } = await supabase.from("vehicle_mileage").insert({
        vehicle_id: data.vehicle_id,
        date: data.date,
        start_mileage: parseInt(data.start_mileage),
        end_mileage: parseInt(data.end_mileage),
        notes: data.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setShowMileageDialog(null);
      setMileageForm({ date: new Date().toISOString().split("T")[0], start_mileage: "", end_mileage: "", notes: "" });
      toast({ title: "Kilometerstand registreret" });
    },
    onError: (error: any) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const openEditDialog = (vehicle: any) => {
    setSelectedVehicle(vehicle);
    setVehicleForm({
      name: vehicle.name,
      license_plate: vehicle.license_plate,
      notes: vehicle.notes || "",
      is_active: vehicle.is_active,
    });
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Køretøjer</h1>
            <p className="text-muted-foreground">Administrer firmabiler</p>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nyt køretøj
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <p>Indlæser...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Navn</TableHead>
                    <TableHead>Nummerplade</TableHead>
                    <TableHead>Noter</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicles?.map((vehicle) => (
                    <TableRow key={vehicle.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Car className="h-4 w-4 text-muted-foreground" />
                          {vehicle.name}
                        </div>
                      </TableCell>
                      <TableCell>{vehicle.license_plate}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{vehicle.notes || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={vehicle.is_active ? "default" : "secondary"}>
                          {vehicle.is_active ? "Aktiv" : "Inaktiv"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => setShowMileageDialog(vehicle)}>
                            <Gauge className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(vehicle)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setShowDeleteDialog(vehicle.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
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

      {/* Add/Edit vehicle dialog */}
      <Dialog open={showAddDialog || !!selectedVehicle} onOpenChange={() => { setShowAddDialog(false); setSelectedVehicle(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedVehicle ? "Rediger køretøj" : "Nyt køretøj"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Navn *</Label>
              <Input value={vehicleForm.name} onChange={(e) => setVehicleForm({ ...vehicleForm, name: e.target.value })} />
            </div>
            <div>
              <Label>Nummerplade *</Label>
              <Input value={vehicleForm.license_plate} onChange={(e) => setVehicleForm({ ...vehicleForm, license_plate: e.target.value })} />
            </div>
            <div>
              <Label>Noter</Label>
              <Textarea value={vehicleForm.notes} onChange={(e) => setVehicleForm({ ...vehicleForm, notes: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={vehicleForm.is_active} onCheckedChange={(c) => setVehicleForm({ ...vehicleForm, is_active: c })} />
              <Label>Aktiv</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); setSelectedVehicle(null); }}>Annuller</Button>
            <Button
              onClick={() => {
                if (selectedVehicle) {
                  updateVehicleMutation.mutate({ id: selectedVehicle.id, ...vehicleForm });
                } else {
                  createVehicleMutation.mutate(vehicleForm);
                }
              }}
              disabled={!vehicleForm.name || !vehicleForm.license_plate}
            >
              {selectedVehicle ? "Gem" : "Opret"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mileage dialog */}
      <Dialog open={!!showMileageDialog} onOpenChange={() => setShowMileageDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrer kilometerstand - {showMileageDialog?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Dato</Label>
              <Input type="date" value={mileageForm.date} onChange={(e) => setMileageForm({ ...mileageForm, date: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start km</Label>
                <Input type="number" value={mileageForm.start_mileage} onChange={(e) => setMileageForm({ ...mileageForm, start_mileage: e.target.value })} />
              </div>
              <div>
                <Label>Slut km</Label>
                <Input type="number" value={mileageForm.end_mileage} onChange={(e) => setMileageForm({ ...mileageForm, end_mileage: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Noter</Label>
              <Textarea value={mileageForm.notes} onChange={(e) => setMileageForm({ ...mileageForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMileageDialog(null)}>Annuller</Button>
            <Button
              onClick={() => addMileageMutation.mutate({ vehicle_id: showMileageDialog.id, ...mileageForm })}
              disabled={!mileageForm.start_mileage || !mileageForm.end_mileage}
            >
              Registrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet køretøj?</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på at du vil slette dette køretøj?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => showDeleteDialog && deleteVehicleMutation.mutate(showDeleteDialog)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Slet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
