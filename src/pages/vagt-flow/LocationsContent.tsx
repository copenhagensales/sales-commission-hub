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
import { usePermissions } from "@/hooks/usePositionPermissions";

export default function LocationsContent() {
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
    bookable_client_ids: [] as string[],
    daily_rate: 1000,
  });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { canEdit } = usePermissions();
  const canEditLocation = canEdit("menu_fm_locations");

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

  const { data: fieldmarketingClients = [] } = useQuery({
    queryKey: ["fieldmarketing-clients-locations"],
    queryFn: async () => {
      const { data: team } = await supabase
        .from("teams")
        .select("id")
        .ilike("name", "%fieldmarketing%")
        .maybeSingle();
      
      if (!team) return [];

      const { data: teamClients } = await supabase
        .from("team_clients")
        .select("client_id, clients(id, name)")
        .eq("team_id", team.id);
      
      return teamClients?.map((tc: any) => tc.clients).filter(Boolean) || [];
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
    onError: (error: any) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newLocation) => {
      const { error } = await supabase.from("location").insert({
        name: data.name,
        type: data.type || null,
        address_street: data.address_street || null,
        address_postal_code: data.address_postal_code || null,
        address_city: data.address_city || null,
        region: data.region || null,
        contact_person_name: data.contact_person_name || null,
        contact_phone: data.contact_phone || null,
        contact_email: data.contact_email || null,
        bookable_client_ids: data.bookable_client_ids,
        daily_rate: data.daily_rate || 1000,
        status: "Ny",
      });
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
        bookable_client_ids: [],
        daily_rate: 1000,
      });
    },
    onError: (error: any) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const filtered = locations?.filter((loc) => {
    const matchesSearch =
      loc.name?.toLowerCase().includes(search.toLowerCase()) ||
      loc.address_city?.toLowerCase().includes(search.toLowerCase()) ||
      loc.type?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || loc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusColors: Record<string, string> = {
    Ny: "bg-blue-100 text-blue-700",
    Aktiv: "bg-green-100 text-green-700",
    Pause: "bg-yellow-100 text-yellow-700",
    Sortlistet: "bg-red-100 text-red-700",
  };

  const toggleClientSelection = (clientId: string) => {
    setNewLocation(prev => ({
      ...prev,
      bookable_client_ids: prev.bookable_client_ids.includes(clientId)
        ? prev.bookable_client_ids.filter(id => id !== clientId)
        : [...prev.bookable_client_ids, clientId]
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Lokationer</h2>
          <p className="text-muted-foreground">Administrer butikker og markeder</p>
        </div>
        <div className="flex gap-2">
          {canEditLocation && (
            <Button onClick={() => setNewLocationOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Ny lokation
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Søg på navn, by eller type..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Alle statusser" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle statusser</SelectItem>
                <SelectItem value="Ny">Ny</SelectItem>
                <SelectItem value="Aktiv">Aktiv</SelectItem>
                <SelectItem value="Pause">Pause</SelectItem>
                <SelectItem value="Sortlistet">Sortlistet</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Indlæser...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Navn</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Handlinger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Ingen lokationer fundet
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered?.map((loc) => (
                    <TableRow 
                      key={loc.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/vagt-flow/locations/${loc.id}`)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {loc.is_favorite && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          {loc.name}
                        </div>
                      </TableCell>
                      <TableCell>{loc.type || "-"}</TableCell>
                      <TableCell>{loc.address_city || "-"}</TableCell>
                      <TableCell>{loc.region || "-"}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[loc.status || ""] || "bg-gray-100 text-gray-700"}>
                          {loc.status || "Ukendt"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {canEditLocation && (
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
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New Location Dialog */}
      <Dialog open={newLocationOpen} onOpenChange={setNewLocationOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Opret ny lokation</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Navn *</Label>
              <Input
                id="name"
                value={newLocation.name}
                onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                placeholder="F.eks. Bilka Hundige"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={newLocation.type}
                  onValueChange={(value) => setNewLocation({ ...newLocation, type: value })}
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
              <div className="grid gap-2">
                <Label htmlFor="region">Region</Label>
                <Select
                  value={newLocation.region}
                  onValueChange={(value) => setNewLocation({ ...newLocation, region: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Vælg region" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sjælland">Sjælland</SelectItem>
                    <SelectItem value="Fyn">Fyn</SelectItem>
                    <SelectItem value="Jylland">Jylland</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">Adresse</Label>
              <Input
                id="address"
                value={newLocation.address_street}
                onChange={(e) => setNewLocation({ ...newLocation, address_street: e.target.value })}
                placeholder="Gade og nummer"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="postal">Postnummer</Label>
                <Input
                  id="postal"
                  value={newLocation.address_postal_code}
                  onChange={(e) => setNewLocation({ ...newLocation, address_postal_code: e.target.value })}
                  placeholder="2670"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="city">By</Label>
                <Input
                  id="city"
                  value={newLocation.address_city}
                  onChange={(e) => setNewLocation({ ...newLocation, address_city: e.target.value })}
                  placeholder="Greve"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Kunder der kan booke</Label>
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded-md p-2">
                {fieldmarketingClients.map((client: any) => (
                  <div key={client.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`client-${client.id}`}
                      checked={newLocation.bookable_client_ids.includes(client.id)}
                      onCheckedChange={() => toggleClientSelection(client.id)}
                    />
                    <label htmlFor={`client-${client.id}`} className="text-sm cursor-pointer">
                      {client.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="daily_rate">Dagspris (kr)</Label>
              <Input
                id="daily_rate"
                type="number"
                value={newLocation.daily_rate}
                onChange={(e) => setNewLocation({ ...newLocation, daily_rate: parseInt(e.target.value) || 1000 })}
                placeholder="1000"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewLocationOpen(false)}>
              Annuller
            </Button>
            <Button
              onClick={() => createMutation.mutate(newLocation)}
              disabled={!newLocation.name || createMutation.isPending}
            >
              Opret
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!locationToDelete} onOpenChange={() => setLocationToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet lokation?</AlertDialogTitle>
            <AlertDialogDescription>
              Denne handling kan ikke fortrydes. Lokationen vil blive permanent slettet.
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
    </div>
  );
}
