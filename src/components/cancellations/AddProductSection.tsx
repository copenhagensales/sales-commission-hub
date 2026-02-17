import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus } from "lucide-react";

interface AddProductSectionProps {
  saleId: string;
  onAdded: () => void;
}

export function AddProductSection({ saleId, onAdded }: AddProductSectionProps) {
  const queryClient = useQueryClient();
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState(1);

  // Get campaign ID from the sale
  const { data: sale } = useQuery({
    queryKey: ["sale-campaign", saleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("client_campaign_id")
        .eq("id", saleId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!saleId,
  });

  // Get available products for this campaign
  const { data: products = [] } = useQuery({
    queryKey: ["products-for-campaign", sale?.client_campaign_id],
    queryFn: async () => {
      if (!sale?.client_campaign_id) return [];
      const { data, error } = await supabase
        .from("products")
        .select("id, name, commission_dkk, revenue_dkk")
        .eq("client_campaign_id", sale.client_campaign_id)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!sale?.client_campaign_id,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const product = products.find((p) => p.id === selectedProductId);
      if (!product) throw new Error("Produkt ikke fundet");

      const { error } = await supabase.from("sale_items").insert({
        sale_id: saleId,
        product_id: product.id,
        display_name: product.name,
        quantity,
        mapped_commission: (product.commission_dkk ?? 0) * quantity,
        mapped_revenue: (product.revenue_dkk ?? 0) * quantity,
        cancelled_quantity: 0,
        is_cancelled: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Produkt tilføjet", description: `${quantity} stk tilføjet til kurven.` });
      queryClient.invalidateQueries({ queryKey: ["sale-items-for-cancellation", saleId] });
      queryClient.invalidateQueries({ queryKey: ["sales-for-cancellations"] });
      setSelectedProductId("");
      setQuantity(1);
      onAdded();
    },
    onError: (error: Error) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  if (products.length === 0) return null;

  return (
    <div className="border rounded-md p-4 space-y-3 bg-muted/30">
      <Label className="text-sm font-medium">Tilføj produkt</Label>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Select value={selectedProductId} onValueChange={setSelectedProductId}>
            <SelectTrigger>
              <SelectValue placeholder="Vælg produkt..." />
            </SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} ({p.commission_dkk ?? 0} kr prov.)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-20">
          <Input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
          />
        </div>
        <Button
          size="sm"
          disabled={!selectedProductId || addMutation.isPending}
          onClick={() => addMutation.mutate()}
        >
          {addMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-1" />
          )}
          Tilføj
        </Button>
      </div>
    </div>
  );
}
