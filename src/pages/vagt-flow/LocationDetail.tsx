import { MainLayout } from "@/components/layout/MainLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, MapPin, Phone, Mail, User, Building } from "lucide-react";
import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function LocationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [formData, setFormData] = useState<any>(null);

  const { data: location, isLoading } = useQuery({
    queryKey: ["vagt-location", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("location")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (location) {
      setFormData(location);
    }
  }, [location]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from("location")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vagt-location", id] });
      queryClient.invalidateQueries({ queryKey: ["vagt-locations-list"] });
      toast({ title: "Lokation opdateret" });
    },
    onError: (error: any) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const statusColors: Record<string, string> = {
    Ny: "bg-blue-500",
    Aktiv: "bg-green-500",
    Pause: "bg-yellow-500",
    Sortlistet: "bg-red-500",
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Indlæser...</p>
        </div>
      </MainLayout>
    );
  }

  if (!location || !formData) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-muted-foreground">Lokation ikke fundet</p>
          <Button variant="outline" onClick={() => navigate("/vagt-flow/locations")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Tilbage til lokationer
          </Button>
        </div>
      </MainLayout>
    );
  }

  const handleSave = () => {
    const { id: _, created_at, updated_at, ...updateData } = formData;
    updateMutation.mutate(updateData);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/vagt-flow/locations")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{formData.name}</h1>
              <p className="text-muted-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {formData.address_city || "Ingen by angivet"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`${statusColors[formData.status || "Ny"]} text-white`}>
              {formData.status || "Ny"}
            </Badge>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              <Save className="h-4 w-4 mr-2" /> Gem ændringer
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Stamdata */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" /> Stamdata
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Navn</Label>
                <Input
                  value={formData.name || ""}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Type</Label>
                  <Select
                    value={formData.type || ""}
                    onValueChange={(v) => setFormData({ ...formData, type: v })}
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
                  <Label>Status</Label>
                  <Select
                    value={formData.status || "Ny"}
                    onValueChange={(v) => setFormData({ ...formData, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ny">Ny</SelectItem>
                      <SelectItem value="Aktiv">Aktiv</SelectItem>
                      <SelectItem value="Pause">Pause</SelectItem>
                      <SelectItem value="Sortlistet">Sortlistet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Region</Label>
                <Input
                  value={formData.region || ""}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Cooldown (uger)</Label>
                  <Input
                    type="number"
                    value={formData.cooldown_weeks || 4}
                    onChange={(e) => setFormData({ ...formData, cooldown_weeks: parseInt(e.target.value) || 4 })}
                  />
                </div>
                <div>
                  <Label>Tilgængelig efter</Label>
                  <Input
                    type="date"
                    value={formData.available_after_date || ""}
                    onChange={(e) => setFormData({ ...formData, available_after_date: e.target.value || null })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Adresse */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" /> Adresse
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Gadenavn</Label>
                <Input
                  value={formData.address_street || ""}
                  onChange={(e) => setFormData({ ...formData, address_street: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Postnummer</Label>
                  <Input
                    value={formData.address_postal_code || ""}
                    onChange={(e) => setFormData({ ...formData, address_postal_code: e.target.value })}
                  />
                </div>
                <div>
                  <Label>By</Label>
                  <Input
                    value={formData.address_city || ""}
                    onChange={(e) => setFormData({ ...formData, address_city: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Kontaktperson */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" /> Kontaktperson
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Navn</Label>
                <Input
                  value={formData.contact_person_name || ""}
                  onChange={(e) => setFormData({ ...formData, contact_person_name: e.target.value })}
                />
              </div>
              <div>
                <Label className="flex items-center gap-2">
                  <Phone className="h-4 w-4" /> Telefon
                </Label>
                <Input
                  value={formData.contact_phone || ""}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                />
              </div>
              <div>
                <Label className="flex items-center gap-2">
                  <Mail className="h-4 w-4" /> Email
                </Label>
                <Input
                  type="email"
                  value={formData.contact_email || ""}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Booking indstillinger */}
          <Card>
            <CardHeader>
              <CardTitle>Booking indstillinger</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="eesy"
                  checked={formData.can_book_eesy || false}
                  onCheckedChange={(c) => setFormData({ ...formData, can_book_eesy: !!c })}
                />
                <Label htmlFor="eesy" className="cursor-pointer">
                  Kan bookes til <Badge variant="outline" className="text-orange-500 border-orange-500 ml-1">Eesy</Badge>
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox
                  id="yousee"
                  checked={formData.can_book_yousee || false}
                  onCheckedChange={(c) => setFormData({ ...formData, can_book_yousee: !!c })}
                />
                <Label htmlFor="yousee" className="cursor-pointer">
                  Kan bookes til <Badge variant="outline" className="text-blue-600 border-blue-600 ml-1">YouSee</Badge>
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Noter */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Noter</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Tilføj noter om lokationen..."
                value={formData.notes || ""}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={4}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
