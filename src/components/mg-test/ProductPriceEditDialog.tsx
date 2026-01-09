import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ProductPriceEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  currentCommission: number;
  currentRevenue: number;
}

type ChangeType = "retroactive" | "from_date";

export function ProductPriceEditDialog({
  open,
  onOpenChange,
  productId,
  productName,
  currentCommission,
  currentRevenue,
}: ProductPriceEditDialogProps) {
  const queryClient = useQueryClient();
  const [newCommission, setNewCommission] = useState(String(currentCommission));
  const [newRevenue, setNewRevenue] = useState(String(currentRevenue));
  const [changeType, setChangeType] = useState<ChangeType>("retroactive");
  const [effectiveDate, setEffectiveDate] = useState<Date | undefined>(new Date());

  // Reset form when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setNewCommission(String(currentCommission));
      setNewRevenue(String(currentRevenue));
      setChangeType("retroactive");
      setEffectiveDate(new Date());
    }
    onOpenChange(isOpen);
  };

  const updateProductPriceMutation = useMutation({
    mutationFn: async () => {
      const commission = parseFloat(newCommission.replace(",", ".")) || 0;
      const revenue = parseFloat(newRevenue.replace(",", ".")) || 0;
      const isRetroactive = changeType === "retroactive";

      if (isRetroactive) {
        // Update the product directly (overwrites all)
        const { error: updateError } = await supabase
          .from("products")
          .update({
            commission_dkk: commission,
            revenue_dkk: revenue,
          })
          .eq("id", productId);

        if (updateError) throw updateError;

        // Log this change to history with is_retroactive = true
        const { error: historyError } = await supabase
          .from("product_price_history")
          .insert({
            product_id: productId,
            commission_dkk: commission,
            revenue_dkk: revenue,
            effective_from: new Date().toISOString().split("T")[0],
            is_retroactive: true,
          });

        if (historyError) throw historyError;
      } else {
        // Only add to history with specific effective date
        if (!effectiveDate) throw new Error("Dato er påkrævet");

        const effectiveDateStr = effectiveDate.toISOString().split("T")[0];
        const today = new Date().toISOString().split("T")[0];

        // If effective date is today or in the past, also update the product
        if (effectiveDateStr <= today) {
          const { error: updateError } = await supabase
            .from("products")
            .update({
              commission_dkk: commission,
              revenue_dkk: revenue,
            })
            .eq("id", productId);

          if (updateError) throw updateError;
        }

        // Add to history
        const { error: historyError } = await supabase
          .from("product_price_history")
          .insert({
            product_id: productId,
            commission_dkk: commission,
            revenue_dkk: revenue,
            effective_from: effectiveDateStr,
            is_retroactive: false,
          });

        if (historyError) throw historyError;
      }
    },
    onSuccess: () => {
      toast.success(
        changeType === "retroactive"
          ? "Priser opdateret for alle salg"
          : `Priser gælder fra ${format(effectiveDate!, "d. MMMM yyyy", { locale: da })}`
      );
      queryClient.invalidateQueries({ queryKey: ["mg-aggregated-products"] });
      queryClient.invalidateQueries({ queryKey: ["mg-manual-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      handleOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error?.message || "Kunne ikke opdatere priser");
    },
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rediger priser</DialogTitle>
          <DialogDescription>
            Opdater provision og omsætning for <strong>{productName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Price inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="commission">Provision (DKK)</Label>
              <Input
                id="commission"
                type="text"
                inputMode="decimal"
                value={newCommission}
                onChange={(e) => setNewCommission(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="revenue">Omsætning (DKK)</Label>
              <Input
                id="revenue"
                type="text"
                inputMode="decimal"
                value={newRevenue}
                onChange={(e) => setNewRevenue(e.target.value)}
                placeholder="0,00"
              />
            </div>
          </div>

          {/* Change type selection */}
          <div className="space-y-3">
            <Label>Hvordan skal ændringen gælde?</Label>
            <RadioGroup
              value={changeType}
              onValueChange={(v) => setChangeType(v as ChangeType)}
              className="space-y-3"
            >
              <div className="flex items-start space-x-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="retroactive" id="retroactive" className="mt-0.5" />
                <div className="space-y-1">
                  <Label htmlFor="retroactive" className="font-medium cursor-pointer">
                    Overskriv al historik
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Prisen opdateres for alle eksisterende og fremtidige salg
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="from_date" id="from_date" className="mt-0.5" />
                <div className="space-y-1 flex-1">
                  <Label htmlFor="from_date" className="font-medium cursor-pointer">
                    Gælder fra en bestemt dato
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Tidligere salg beholder den gamle pris
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Date picker (only shown when from_date is selected) */}
          {changeType === "from_date" && (
            <div className="space-y-2">
              <Label>Gyldig fra dato</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !effectiveDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {effectiveDate
                      ? format(effectiveDate, "d. MMMM yyyy", { locale: da })
                      : "Vælg dato"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={effectiveDate}
                    onSelect={setEffectiveDate}
                    locale={da}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Annuller
            </Button>
            <Button
              onClick={() => updateProductPriceMutation.mutate()}
              disabled={updateProductPriceMutation.isPending}
            >
              {updateProductPriceMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Gem ændringer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
