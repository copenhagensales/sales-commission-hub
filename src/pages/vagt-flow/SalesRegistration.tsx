import { useState } from "react";
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
import { Plus, Minus, Phone, Save, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useCreateFieldmarketingSale, FIELDMARKETING_CLIENTS } from "@/hooks/useFieldmarketingSales";

interface ProductSelection {
  productId: string;
  productName: string;
  quantity: number;
  phoneNumbers: string[];
}

const SalesRegistration = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [sellerId, setSellerId] = useState<string>("");
  const [locationId, setLocationId] = useState<string>("");
  const [clientId, setClientId] = useState<string>(FIELDMARKETING_CLIENTS.EESY_FM);
  const [comment, setComment] = useState("");
  const [productSelections, setProductSelections] = useState<ProductSelection[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const createSalesMutation = useCreateFieldmarketingSale();

  // Fetch fieldmarketing clients
  const { data: clients } = useQuery({
    queryKey: ["fieldmarketing-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .in("id", [FIELDMARKETING_CLIENTS.EESY_FM, FIELDMARKETING_CLIENTS.YOUSEE])
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch fieldmarketing employees
  const { data: employees } = useQuery({
    queryKey: ["fieldmarketing-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name")
        .eq("job_title", "Fieldmarketing")
        .eq("is_active", true)
        .order("first_name");
      if (error) throw error;
      return data;
    },
  });

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

  // Fetch Eesy FM Gaden products (deduplicated by name)
  const { data: products } = useQuery({
    queryKey: ["eesy-fm-gaden-products"],
    queryFn: async () => {
      // Get eesy FM Gaden Products campaign ID
      const { data: campaigns } = await supabase
        .from("client_campaigns")
        .select("id")
        .ilike("name", "eesy FM Gaden Products")
        .single();
      
      if (!campaigns) return [];
      
      const { data, error } = await supabase
        .from("products")
        .select("id, name")
        .eq("client_campaign_id", campaigns.id)
        .neq("name", "Lokation") // Exclude non-product items
        .order("name");
      if (error) throw error;
      
      // Deduplicate by product name (keep first occurrence)
      const seen = new Set<string>();
      return (data || []).filter((p) => {
        if (seen.has(p.name)) return false;
        seen.add(p.name);
        return true;
      });
    },
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
    if (!sellerId) {
      toast.error("Vælg en sælger");
      return;
    }
    if (!locationId) {
      toast.error("Vælg en lokation");
      return;
    }
    if (!clientId) {
      toast.error("Vælg en kunde");
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
    
    try {
      // Create sales records - one per product/phone combination
      const salesRecords = productSelections.flatMap((selection) =>
        selection.phoneNumbers.map((phone) => ({
          seller_id: sellerId,
          location_id: locationId,
          client_id: clientId,
          product_name: selection.productName,
          phone_number: phone.trim(),
          comment: comment || undefined,
        }))
      );

      await createSalesMutation.mutateAsync(salesRecords);
      
      toast.success(`${salesRecords.length} salg registreret!`);

      // Reset form
      setSellerId("");
      setLocationId("");
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
          <p className="text-muted-foreground mt-1">
            Registrer salg fra fieldmarketing events
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left column - Form fields */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Salgsoplysninger</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Sælger */}
              <div className="space-y-2">
                <Label htmlFor="seller">Sælger *</Label>
                <Select value={sellerId} onValueChange={setSellerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vælg sælger" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees?.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Kunde */}
              <div className="space-y-2">
                <Label htmlFor="client">Kunde *</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vælg kunde" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients?.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Lokation */}
              <div className="space-y-2">
                <Label htmlFor="location">Lokation *</Label>
                <Select value={locationId} onValueChange={setLocationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vælg lokation" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations?.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
                          placeholder="Telefonnummer"
                          value={phone}
                          onChange={(e) =>
                            updatePhoneNumber(
                              selection.productId,
                              index,
                              e.target.value
                            )
                          }
                          className="flex-1"
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
              <div className="space-y-2">
                {products?.map((product) => {
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
            </CardContent>
          </Card>

          {/* Submit button */}
          <Button
            onClick={handleSubmit}
            className="w-full"
            size="lg"
            disabled={!sellerId || !locationId || !clientId || productSelections.length === 0 || isSubmitting}
          >
            <Save className="h-5 w-5 mr-2" />
            {isSubmitting ? "Gemmer..." : "Registrer salg"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SalesRegistration;
