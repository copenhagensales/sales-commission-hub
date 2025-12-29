import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Minus, Phone, Save, ArrowLeft, MapPin, Building2, Tag, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useCreateFieldmarketingSale } from "@/hooks/useFieldmarketingSales";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePositionPermissions";
import { format } from "date-fns";
import { da } from "date-fns/locale";

interface ProductSelection {
  productId: string;
  productName: string;
  quantity: number;
  phoneNumbers: string[];
}

interface TodayBooking {
  id: string;
  location: { id: string; name: string } | null;
  client: { id: string; name: string } | null;
  brand: { id: string; name: string; color_hex: string } | null;
  campaign: { id: string; name: string } | null;
  startTime: string;
  endTime: string;
}

const SalesRegistration = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { position } = usePermissions();
  const isOwner = position?.name?.toLowerCase() === "ejer";
  const [locationId, setLocationId] = useState<string>("");
  const [comment, setComment] = useState("");
  const [productSelections, setProductSelections] = useState<ProductSelection[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string>("");
  
  const createSalesMutation = useCreateFieldmarketingSale();
  const today = format(new Date(), "yyyy-MM-dd");

  // Get current employee ID from logged-in user
  const { data: currentEmployee } = useQuery({
    queryKey: ["current-employee", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name")
        .or(`private_email.ilike.${user.email},work_email.ilike.${user.email}`)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.email,
  });

  // Fetch today's booking assignment for the current employee
  const { data: todayBooking } = useQuery({
    queryKey: ["today-booking-assignment", currentEmployee?.id, today],
    queryFn: async () => {
      if (!currentEmployee?.id) return null;
      
      const { data: assignment, error } = await supabase
        .from("booking_assignment")
        .select(`
          id,
          start_time,
          end_time,
          booking:booking_id (
            id,
            location:location_id (id, name),
            client:client_id (id, name),
            brand:brand_id (id, name, color_hex),
            campaign:campaign_id (id, name)
          )
        `)
        .eq("employee_id", currentEmployee.id)
        .eq("date", today)
        .maybeSingle();
      
      if (error) throw error;
      if (!assignment) return null;

      const booking = assignment.booking as any;
      
      return {
        id: assignment.id,
        location: booking?.location || null,
        client: booking?.client || null,
        brand: booking?.brand || null,
        campaign: booking?.campaign || null,
        startTime: assignment.start_time,
        endTime: assignment.end_time,
      } as TodayBooking;
    },
    enabled: !!currentEmployee?.id,
  });

  // Fetch all bookings for owner to select from
  const { data: allBookings } = useQuery({
    queryKey: ["all-bookings-for-owner", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking")
        .select(`
          id,
          location:location_id (id, name),
          client:client_id (id, name),
          brand:brand_id (id, name, color_hex),
          campaign:campaign_id (id, name)
        `)
        .gte("end_date", today)
        .lte("start_date", today)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isOwner && !todayBooking,
  });

  // Owner-selected booking
  const { data: ownerSelectedBooking } = useQuery({
    queryKey: ["owner-selected-booking", selectedBookingId],
    queryFn: async () => {
      if (!selectedBookingId) return null;
      const { data, error } = await supabase
        .from("booking")
        .select(`
          id,
          location:location_id (id, name),
          client:client_id (id, name),
          brand:brand_id (id, name, color_hex),
          campaign:campaign_id (id, name)
        `)
        .eq("id", selectedBookingId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        location: data.location as { id: string; name: string } | null,
        client: data.client as { id: string; name: string } | null,
        brand: data.brand as { id: string; name: string; color_hex: string } | null,
        campaign: data.campaign as { id: string; name: string } | null,
        startTime: "",
        endTime: "",
      } as TodayBooking;
    },
    enabled: !!selectedBookingId && isOwner,
  });

  // Use either today's booking or owner-selected booking
  const activeBooking = todayBooking || ownerSelectedBooking;

  // Auto-set location when today's booking is loaded
  useEffect(() => {
    if (activeBooking?.location?.id && !locationId) {
      setLocationId(activeBooking.location.id);
    }
  }, [activeBooking, locationId]);

  // Fetch locations
  const { data: locations } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("location")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch products based on the campaign from active booking
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["campaign-products", activeBooking?.campaign?.id, activeBooking?.brand?.name, activeBooking?.client?.id],
    queryFn: async () => {
      // If booking has a direct campaign_id, use it
      if (activeBooking?.campaign?.id) {
        const { data, error } = await supabase
          .from("products")
          .select("id, name")
          .eq("client_campaign_id", activeBooking.campaign.id)
          .neq("name", "Lokation")
          .order("name");
        if (error) throw error;
        
        const seen = new Set<string>();
        return (data || []).filter((p) => {
          if (seen.has(p.name)) return false;
          seen.add(p.name);
          return true;
        });
      }
      
      // Fallback 1: search by brand name if no campaign_id
      if (activeBooking?.brand?.name) {
        const { data: campaigns } = await supabase
          .from("client_campaigns")
          .select("id, name")
          .ilike("name", `%${activeBooking.brand.name}%`);
        
        if (campaigns && campaigns.length > 0) {
          const campaignIds = campaigns.map(c => c.id);
          
          const { data, error } = await supabase
            .from("products")
            .select("id, name")
            .in("client_campaign_id", campaignIds)
            .neq("name", "Lokation")
            .order("name");
          if (error) throw error;
          
          const seen = new Set<string>();
          return (data || []).filter((p) => {
            if (seen.has(p.name)) return false;
            seen.add(p.name);
            return true;
          });
        }
      }
      
      // Fallback 2: search by client_id if no campaign or brand
      if (activeBooking?.client?.id) {
        const { data: campaigns } = await supabase
          .from("client_campaigns")
          .select("id")
          .eq("client_id", activeBooking.client.id);
        
        if (campaigns && campaigns.length > 0) {
          const campaignIds = campaigns.map(c => c.id);
          
          const { data, error } = await supabase
            .from("products")
            .select("id, name")
            .in("client_campaign_id", campaignIds)
            .neq("name", "Lokation")
            .order("name");
          if (error) throw error;
          
          const seen = new Set<string>();
          return (data || []).filter((p) => {
            if (seen.has(p.name)) return false;
            seen.add(p.name);
            return true;
          });
        }
      }
      
      return [];
    },
    enabled: !!(activeBooking?.campaign?.id || activeBooking?.brand?.name || activeBooking?.client?.id),
  });

  const addProduct = (productId: string) => {
    const product = products?.find((p) => p.id === productId);
    if (!product) return;

    const existing = productSelections.find((p) => p.productId === productId);
    if (existing) {
      // Increase quantity and add phone number field
      setProductSelections((prev) =>
        prev.map((p) =>
          p.productId === productId
            ? {
                ...p,
                quantity: p.quantity + 1,
                phoneNumbers: [...p.phoneNumbers, ""],
              }
            : p
        )
      );
    } else {
      // Add new product
      setProductSelections((prev) => [
        ...prev,
        {
          productId,
          productName: product.name,
          quantity: 1,
          phoneNumbers: [""],
        },
      ]);
    }
  };

  const removeProduct = (productId: string) => {
    setProductSelections((prev) => {
      const existing = prev.find((p) => p.productId === productId);
      if (!existing) return prev;

      if (existing.quantity <= 1) {
        return prev.filter((p) => p.productId !== productId);
      }

      return prev.map((p) =>
        p.productId === productId
          ? {
              ...p,
              quantity: p.quantity - 1,
              phoneNumbers: p.phoneNumbers.slice(0, -1),
            }
          : p
      );
    });
  };

  const updatePhoneNumber = (
    productId: string,
    index: number,
    value: string
  ) => {
    setProductSelections((prev) =>
      prev.map((p) =>
        p.productId === productId
          ? {
              ...p,
              phoneNumbers: p.phoneNumbers.map((phone, i) =>
                i === index ? value : phone
              ),
            }
          : p
      )
    );
  };

  const getProductQuantity = (productId: string) => {
    return productSelections.find((p) => p.productId === productId)?.quantity || 0;
  };

  const handleSubmit = async () => {
    if (!currentEmployee) {
      toast.error("Kunne ikke finde din medarbejderprofil");
      return;
    }
    if (!activeBooking?.location?.id) {
      toast.error("Ingen lokation fundet for vagten");
      return;
    }
    if (productSelections.length === 0) {
      toast.error("Tilføj mindst ét produkt");
      return;
    }

    // Check all phone numbers are filled
    const missingPhones = productSelections.some((p) =>
      p.phoneNumbers.some((phone) => !phone.trim())
    );
    if (missingPhones) {
      toast.error("Udfyld alle telefonnumre");
      return;
    }

    setIsSubmitting(true);
    
    // Use client from booking if available, otherwise use locationId to look it up
    const clientId = activeBooking?.client?.id;
    
    if (!clientId) {
      toast.error("Kunne ikke finde kunde for denne booking");
      setIsSubmitting(false);
      return;
    }
    
    try {
      // Create sales records - one per product/phone combination
      const salesRecords = productSelections.flatMap((selection) =>
        selection.phoneNumbers.map((phone) => ({
          seller_id: currentEmployee.id,
          location_id: activeBooking.location!.id,
          client_id: clientId,
          product_name: selection.productName,
          phone_number: phone.trim(),
          comment: comment || undefined,
        }))
      );

      await createSalesMutation.mutateAsync(salesRecords);
      
      toast.success(`${salesRecords.length} salg registreret!`);

      // Reset form
      
      setComment("");
      setProductSelections([]);
    } catch (error) {
      console.error("Error saving sales:", error);
      toast.error("Kunne ikke gemme salg");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalProducts = productSelections.reduce((sum, p) => sum + p.quantity, 0);

  const renderFormContent = () => (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Left column - Form fields */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Salgsoplysninger</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Kommentar */}
            <div className="space-y-2">
              <Label htmlFor="comment">Kommentar</Label>
              <Textarea
                id="comment"
                placeholder="Eventuelle bemærkninger..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Phone numbers for selected products */}
        {productSelections.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Telefonnumre *
                Telefonnumre
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {productSelections.map((selection) => (
                <div key={selection.productId} className="space-y-2">
                  <Label className="font-medium text-primary">
                    {selection.productName}
                  </Label>
                  {selection.phoneNumbers.map((phone, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground w-8">
                        #{index + 1}
                      </span>
                      <Input
                        type="tel"
                        placeholder="Telefonnummer *"
                        value={phone}
                        onChange={(e) =>
                          updatePhoneNumber(
                            selection.productId,
                            index,
                            e.target.value
                          )
                        }
                        className="flex-1"
                        required
                      />
                    </div>
                  ))}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right column - Products */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Abonnementer ({totalProducts} valgt)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {productsLoading ? (
              <p className="text-muted-foreground text-sm">Henter produkter...</p>
            ) : !products || products.length === 0 ? (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <p className="text-sm text-destructive">Din leder mangler at udfylde booking</p>
              </div>
            ) : (
              <div className="space-y-2">
                {products.map((product) => {
                  const quantity = getProductQuantity(product.id);
                  return (
                    <div
                      key={product.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        quantity > 0
                          ? "border-primary bg-primary/5"
                          : "border-border"
                      }`}
                    >
                      <span className="text-sm font-medium flex-1">
                        {product.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => removeProduct(product.id)}
                          disabled={quantity === 0}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center font-medium">
                          {quantity}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => addProduct(product.id)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit button */}
        <Button
          onClick={handleSubmit}
          className="w-full"
          size="lg"
          disabled={!currentEmployee || !activeBooking?.location?.id || productSelections.length === 0 || isSubmitting}
        >
          <Save className="h-5 w-5 mr-2" />
          {isSubmitting ? "Gemmer..." : "Registrer salg"}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/vagt-flow")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t("sidebar.salesRegistration")}
          </h1>
          {currentEmployee && (
            <p className="text-muted-foreground mt-1">
              {currentEmployee.first_name} {currentEmployee.last_name}
            </p>
          )}
        </div>
      </div>

      {/* Today's booking info card */}
      {activeBooking && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="text-primary">{todayBooking ? "Dagens vagt" : "Valgt booking"}</span>
              <span className="text-muted-foreground text-sm font-normal">
                ({format(new Date(), "EEEE d. MMMM", { locale: da })})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {activeBooking.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Lokation</p>
                    <p className="font-medium">{activeBooking.location.name}</p>
                  </div>
                </div>
              )}
              {activeBooking.client && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Kunde</p>
                    <p className="font-medium">{activeBooking.client.name}</p>
                  </div>
                </div>
              )}
              {activeBooking.brand && (
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Kampagne</p>
                    <p className="font-medium flex items-center gap-2">
                      <span 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: activeBooking.brand.color_hex }}
                      />
                      {activeBooking.brand.name}
                    </p>
                  </div>
                </div>
              )}
            </div>
            {activeBooking.startTime && activeBooking.endTime && (
              <p className="text-sm text-muted-foreground mt-2">
                Arbejdstid: {activeBooking.startTime.slice(0, 5)} - {activeBooking.endTime.slice(0, 5)}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Owner booking selector - shown when no booking but owner */}
      {!todayBooking && isOwner && currentEmployee && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="text-primary">Vælg booking (Ejer-adgang)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedBookingId} onValueChange={setSelectedBookingId}>
              <SelectTrigger>
                <SelectValue placeholder="Vælg en booking..." />
              </SelectTrigger>
              <SelectContent>
                {allBookings?.map((booking: any) => (
                  <SelectItem key={booking.id} value={booking.id}>
                    {booking.location?.name || "Ukendt lokation"} - {booking.client?.name || "Ukendt kunde"} {booking.brand?.name ? `(${booking.brand.name})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {!activeBooking && !isOwner && currentEmployee && (
        <Card className="border-muted bg-muted/20">
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground text-center">
              Ingen booking fundet for i dag. Vælg lokation manuelt nedenfor.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Show form content if there's an active booking with products */}
      {activeBooking ? (
        products && products.length > 0 ? (
          renderFormContent()
        ) : productsLoading ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">Henter produkter...</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="py-6">
              <div className="flex items-center gap-3 justify-center">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <p className="text-sm text-destructive">
                  Ingen produkter fundet for kampagnen "{activeBooking.brand?.name}".
                </p>
              </div>
            </CardContent>
          </Card>
        )
      ) : !isOwner ? (
        <Card className="border-muted">
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              Du har ingen booking i dag. Kontakt din leder for at få tildelt en vagt.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};

export default SalesRegistration;
