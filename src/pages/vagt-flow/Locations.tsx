import { MainLayout } from "@/components/layout/MainLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Search, Plus, Trash2, Star, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export default function VagtLocations() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [locationToDelete, setLocationToDelete] = useState<string | null>(null);
  const [newLocationOpen, setNewLocationOpen] = useState(false);
  const [newLocation, setNewLocation] = useState({
    name: "",
    type: "",
    address_street: "",
    address_postal_code: "",
    address_city: "",
    region: "",
    contact_person_name: "",
    contact_phone: "",
    contact_email: "",
    can_book_eesy: false,
    can_book_yousee: false,
    daily_rate: 1000,
    is_active: true,
  });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: locations, isLoading } = useQuery({
    queryKey: ["vagt-locations-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("location")
        .select("*")
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("location").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vagt-locations-list"] });
      toast({ title: "Lokation slettet" });
      setLocationToDelete(null);
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("location").insert(newLocation);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vagt-locations-list"] });
      toast({ title: "Lokation oprettet" });
      setNewLocationOpen(false);
      setNewLocation({
        name: "",
        type: "",
        address_street: "",
        address_postal_code: "",
        address_city: "",
        region: "",
        contact_person_name: "",
        contact_phone: "",
        contact_email: "",
        can_book_eesy: false,
        can_book_yousee: false,
        daily_rate: 1000,
        is_active: true,
      });
    },
    onError: (error: any) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const toggleFavorite = useMutation({
    mutationFn: async ({ id, isFavorite }: { id: string; isFavorite: boolean }) => {
      const { error } = await supabase.from("location").update({ is_favorite: isFavorite }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vagt-locations-list"] });
    },
  });

  const updateCooldown = useMutation({
    mutationFn: async ({ id, cooldown_weeks }: { id: string; cooldown_weeks: number }) => {
      const { error } = await supabase.from("location").update({ cooldown_weeks }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vagt-locations-list"] });
      toast({ title: "Cooldown opdateret" });
    },
  });

  const updateDailyRate = useMutation({
    mutationFn: async ({ id, daily_rate }: { id: string; daily_rate: number }) => {
      const { error } = await supabase.from("location").update({ daily_rate }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vagt-locations-list"] });
      toast({ title: "Dagspris opdateret" });
    },
  });

  const handleCsvImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    const headers = lines[0].split(';');

    const idIndex = headers.indexOf('id');
    const contactPersonIndex = headers.indexOf('contact_person_name');
    const contactPhoneIndex = headers.indexOf('contact_phone');
    const contactEmailIndex = headers.indexOf('contact_email');
    const notesIndex = headers.indexOf('notes');

    if (idIndex === -1) {
      toast({ title: "Fejl", description: "CSV mangler 'id' kolonne", variant: "destructive" });
      return;
    }

    let updated = 0;
    let errors = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(';');
      const id = values[idIndex]?.trim();
      
      if (!id) continue;

      const updateData: Record<string, string | null> = {};
      
      if (contactPersonIndex !== -1 && values[contactPersonIndex]?.trim()) {
        updateData.contact_person_name = values[contactPersonIndex].trim();
      }
      if (contactPhoneIndex !== -1 && values[contactPhoneIndex]?.trim()) {
        updateData.contact_phone = values[contactPhoneIndex].trim();
      }
      if (contactEmailIndex !== -1 && values[contactEmailIndex]?.trim()) {
        updateData.contact_email = values[contactEmailIndex].trim();
      }
      if (notesIndex !== -1 && values[notesIndex]?.trim()) {
        updateData.notes = values[notesIndex].trim();
      }

      if (Object.keys(updateData).length === 0) continue;

      const { error } = await supabase
        .from("location")
        .update(updateData)
        .eq("id", id);

      if (error) {
        errors++;
      } else {
        updated++;
      }
    }

    queryClient.invalidateQueries({ queryKey: ["vagt-locations-list"] });
    toast({ 
      title: "Import færdig", 
      description: `${updated} lokationer opdateret${errors > 0 ? `, ${errors} fejl` : ''}` 
    });

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const filteredLocations = locations?.filter((loc) => {
    const matchesSearch =
      !search ||
      loc.name?.toLowerCase().includes(search.toLowerCase()) ||
      loc.address_city?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "all" || loc.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const statusColors: Record<string, string> = {
    Ny: "bg-blue-500",
    Aktiv: "bg-green-500",
    Pause: "bg-yellow-500",
    Sortlistet: "bg-red-500",
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Lokationer</h1>
            <p className="text-muted-foreground">Administrer butikker og steder</p>
          </div>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleCsvImport}
              className="hidden"
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" /> Importer kontaktinfo
            </Button>
            <Button onClick={() => setNewLocationOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Ny lokation
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Søg efter navn eller by..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  <SelectItem value="Ny">Ny</SelectItem>
                  <SelectItem value="Aktiv">Aktiv</SelectItem>
                  <SelectItem value="Pause">Pause</SelectItem>
                  <SelectItem value="Sortlistet">Sortlistet</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <p>Indlæser...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead></TableHead>
                    <TableHead>Navn</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead>Dagspris</TableHead>
                    <TableHead>Cooldown</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Brands</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLocations?.map((loc) => (
                    <TableRow 
                      key={loc.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/vagt-flow/locations/${loc.id}`)}
                    >
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite.mutate({ id: loc.id, isFavorite: !loc.is_favorite });
                          }}
                        >
                          <Star className={`h-4 w-4 ${loc.is_favorite ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"}`} />
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">{loc.name}</TableCell>
                      <TableCell>{loc.type || "-"}</TableCell>
                      <TableCell>{loc.address_city || "-"}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            className="w-20 h-8 text-center"
                            defaultValue={loc.daily_rate || 1000}
                            onBlur={(e) => {
                              const value = parseInt(e.target.value) || 1000;
                              if (value !== (loc.daily_rate || 1000)) {
                                updateDailyRate.mutate({ id: loc.id, daily_rate: value });
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                          />
                          <span className="text-muted-foreground text-sm">kr</span>
                        </div>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={1}
                            max={52}
                            className="w-16 h-8 text-center"
                            defaultValue={loc.cooldown_weeks || 4}
                            onBlur={(e) => {
                              const value = parseInt(e.target.value) || 4;
                              if (value !== (loc.cooldown_weeks || 4)) {
                                updateCooldown.mutate({ id: loc.id, cooldown_weeks: value });
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                          />
                          <span className="text-muted-foreground text-sm">uger</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${statusColors[loc.status || "Ny"]} text-white`}>
                          {loc.status || "Ny"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {loc.can_book_eesy && <Badge variant="outline" className="text-orange-500 border-orange-500">Eesy</Badge>}
                          {loc.can_book_yousee && <Badge variant="outline" className="text-blue-600 border-blue-600">YouSee</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocationToDelete(loc.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* New location dialog */}
      <Dialog open={newLocationOpen} onOpenChange={setNewLocationOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ny lokation</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Navn *</Label>
                <Input value={newLocation.name} onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })} />
              </div>
              <div>
                <Label>Type</Label>
                <Select 
                  value={newLocation.type} 
                  onValueChange={(v) => setNewLocation({ 
                    ...newLocation, 
                    type: v,
                    daily_rate: v === "Storcenter" ? 1500 : 1000
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Vælg type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Butik">Butik</SelectItem>
                    <SelectItem value="Storcenter">Storcenter</SelectItem>
                    <SelectItem value="Markeder">Markeder</SelectItem>
                    <SelectItem value="Messer">Messer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Dagspris (kr ex moms)</Label>
                <Input 
                  type="number" 
                  value={newLocation.daily_rate} 
                  onChange={(e) => setNewLocation({ ...newLocation, daily_rate: parseInt(e.target.value) || 1000 })} 
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Label>Adresse</Label>
                <Input value={newLocation.address_street} onChange={(e) => setNewLocation({ ...newLocation, address_street: e.target.value })} />
              </div>
              <div>
                <Label>Postnummer</Label>
                <Input value={newLocation.address_postal_code} onChange={(e) => setNewLocation({ ...newLocation, address_postal_code: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>By</Label>
                <Input value={newLocation.address_city} onChange={(e) => setNewLocation({ ...newLocation, address_city: e.target.value })} />
              </div>
              <div>
                <Label>Region</Label>
                <Input value={newLocation.region} onChange={(e) => setNewLocation({ ...newLocation, region: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Kontaktperson</Label>
                <Input value={newLocation.contact_person_name} onChange={(e) => setNewLocation({ ...newLocation, contact_person_name: e.target.value })} />
              </div>
              <div>
                <Label>Telefon</Label>
                <Input value={newLocation.contact_phone} onChange={(e) => setNewLocation({ ...newLocation, contact_phone: e.target.value })} />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={newLocation.contact_email} onChange={(e) => setNewLocation({ ...newLocation, contact_email: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="eesy"
                  checked={newLocation.can_book_eesy}
                  onCheckedChange={(c) => setNewLocation({ ...newLocation, can_book_eesy: !!c })}
                />
                <Label htmlFor="eesy">Kan bookes til Eesy</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="yousee"
                  checked={newLocation.can_book_yousee}
                  onCheckedChange={(c) => setNewLocation({ ...newLocation, can_book_yousee: !!c })}
                />
                <Label htmlFor="yousee">Kan bookes til YouSee</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewLocationOpen(false)}>Annuller</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!newLocation.name || createMutation.isPending}>
              Opret lokation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!locationToDelete} onOpenChange={() => setLocationToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet lokation?</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på at du vil slette denne lokation? Alle tilhørende bookinger vil også blive slettet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => locationToDelete && deleteMutation.mutate(locationToDelete)}
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
