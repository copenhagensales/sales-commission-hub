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
import { usePermissions } from "@/hooks/usePositionPermissions";

export default function LocationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [formData, setFormData] = useState<any>(null);
  const { canEdit } = usePermissions();
  const canEditLocation = canEdit("menu_fm_locations");

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

  // Fetch Fieldmarketing team clients
  const { data: fieldmarketingClients = [] } = useQuery({
    queryKey: ["fieldmarketing-clients"],
    queryFn: async () => {
      // Find Fieldmarketing team
      const { data: fmTeam } = await supabase
        .from("teams")
        .select("id")
        .ilike("name", "%fieldmarketing%")
        .maybeSingle();
      
      if (!fmTeam) return [];

      // Get clients assigned to Fieldmarketing team
      const { data: teamClients } = await supabase
        .from("team_clients")
        .select("client_id, clients(id, name)")
        .eq("team_id", fmTeam.id);

      return teamClients?.map((tc: any) => tc.clients).filter(Boolean) || [];
    },
  });

  // Fetch campaigns for selected clients (only campaigns that are mapped in adversus_campaign_mappings)
  const { data: clientCampaigns = [] } = useQuery({
    queryKey: ["client-campaigns-for-location", formData?.bookable_client_ids],
    queryFn: async () => {
      if (!formData?.bookable_client_ids?.length) return [];
      
      // Get client_campaign_ids that are mapped in adversus_campaign_mappings
      const { data: mappings, error: mappingError } = await supabase
        .from("adversus_campaign_mappings")
        .select("client_campaign_id")
        .not("client_campaign_id", "is", null);
      
      if (mappingError) throw mappingError;
      
      const mappedCampaignIds = mappings?.map(m => m.client_campaign_id).filter(Boolean) || [];
      
      if (mappedCampaignIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("client_campaigns")
        .select("id, name, client_id")
        .in("client_id", formData.bookable_client_ids)
        .in("id", mappedCampaignIds);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!formData?.bookable_client_ids?.length,
  });

  useEffect(() => {
    if (location) {
      setFormData({
        ...location,
        bookable_client_ids: location.bookable_client_ids || [],
        client_campaign_mapping: location.client_campaign_mapping || {},
      });
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
            {canEditLocation && (
              <Button onClick={handleSave} disabled={updateMutation.isPending}>
                <Save className="h-4 w-4 mr-2" /> Gem ændringer
              </Button>
            )}
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
                  disabled={!canEditLocation}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Type</Label>
                  <Select
                    value={formData.type || ""}
                    onValueChange={(v) => setFormData({ 
                      ...formData, 
                      type: v,
                      daily_rate: formData.daily_rate || (v === "Storcenter" ? 1500 : 1000)
                    })}
                    disabled={!canEditLocation}
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
                    disabled={!canEditLocation}
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
                <Label>Dagspris (kr ex moms)</Label>
                <Input
                  type="number"
                  value={formData.daily_rate || 1000}
                  onChange={(e) => setFormData({ ...formData, daily_rate: parseInt(e.target.value) || 1000 })}
                  disabled={!canEditLocation}
                />
              </div>
              <div>
                <Label>Region</Label>
                <Input
                  value={formData.region || ""}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  disabled={!canEditLocation}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Cooldown (uger)</Label>
                  <Input
                    type="number"
                    value={formData.cooldown_weeks || 4}
                    onChange={(e) => setFormData({ ...formData, cooldown_weeks: parseInt(e.target.value) || 4 })}
                    disabled={!canEditLocation}
                  />
                </div>
                <div>
                  <Label>Tilgængelig efter</Label>
                  <Input
                    type="date"
                    value={formData.available_after_date || ""}
                    onChange={(e) => setFormData({ ...formData, available_after_date: e.target.value || null })}
                    disabled={!canEditLocation}
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
                  disabled={!canEditLocation}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Postnummer</Label>
                  <Input
                    value={formData.address_postal_code || ""}
                    onChange={(e) => setFormData({ ...formData, address_postal_code: e.target.value })}
                    disabled={!canEditLocation}
                  />
                </div>
                <div>
                  <Label>By</Label>
                  <Input
                    value={formData.address_city || ""}
                    onChange={(e) => setFormData({ ...formData, address_city: e.target.value })}
                    disabled={!canEditLocation}
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
                  disabled={!canEditLocation}
                />
              </div>
              <div>
                <Label className="flex items-center gap-2">
                  <Phone className="h-4 w-4" /> Telefon
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={formData.contact_phone || ""}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                    className="flex-1"
                    disabled={!canEditLocation}
                  />
                  {formData.contact_phone && (
                    <a
                      href={`tel:${formData.contact_phone}`}
                      className="inline-flex items-center justify-center h-10 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      <Phone className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
              <div>
                <Label className="flex items-center gap-2">
                  <Mail className="h-4 w-4" /> Email
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    value={formData.contact_email || ""}
                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                    className="flex-1"
                    disabled={!canEditLocation}
                  />
                  {formData.contact_email && (
                    <a
                      href={`mailto:${formData.contact_email}`}
                      className="inline-flex items-center justify-center h-10 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      <Mail className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Booking indstillinger */}
          <Card>
            <CardHeader>
              <CardTitle>Booking indstillinger</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {fieldmarketingClients.length === 0 ? (
                <p className="text-muted-foreground text-sm">Ingen kunder tildelt Fieldmarketing team</p>
              ) : (
                fieldmarketingClients.map((client: any) => {
                  const isChecked = formData.bookable_client_ids?.includes(client.id) || false;
                  const campaignsForClient = clientCampaigns.filter((c: any) => c.client_id === client.id);
                  const selectedCampaignId = formData.client_campaign_mapping?.[client.id] || "";
                  
                  return (
                    <div key={client.id} className="space-y-2">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id={`client-${client.id}`}
                          checked={isChecked}
                          disabled={!canEditLocation}
                          onCheckedChange={(checked) => {
                            const currentIds = formData.bookable_client_ids || [];
                            const currentMapping = formData.client_campaign_mapping || {};
                            const newIds = checked
                              ? [...currentIds, client.id]
                              : currentIds.filter((id: string) => id !== client.id);
                            
                            // Remove campaign mapping if unchecked
                            const newMapping = { ...currentMapping };
                            if (!checked) {
                              delete newMapping[client.id];
                            }
                            
                            setFormData({ 
                              ...formData, 
                              bookable_client_ids: newIds,
                              client_campaign_mapping: newMapping,
                            });
                          }}
                        />
                        <Label htmlFor={`client-${client.id}`} className="cursor-pointer">
                          Kan bookes til <Badge variant="outline" className="ml-1">{client.name}</Badge>
                        </Label>
                      </div>
                      
                      {/* Campaign dropdown - shows when client is checked */}
                      {isChecked && campaignsForClient.length > 0 && (
                        <div className="ml-7">
                          <Select
                            value={selectedCampaignId}
                            onValueChange={(value) => {
                              const currentMapping = formData.client_campaign_mapping || {};
                              setFormData({
                                ...formData,
                                client_campaign_mapping: {
                                  ...currentMapping,
                                  [client.id]: value,
                                },
                              });
                            }}
                            disabled={!canEditLocation}
                          >
                            <SelectTrigger className="w-full max-w-xs">
                              <SelectValue placeholder="Vælg kampagne" />
                            </SelectTrigger>
                            <SelectContent>
                              {campaignsForClient.map((campaign: any) => (
                                <SelectItem key={campaign.id} value={campaign.id}>
                                  {campaign.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
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
                disabled={!canEditLocation}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
