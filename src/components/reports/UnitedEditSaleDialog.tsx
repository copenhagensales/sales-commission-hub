import { useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type { UnitedSale } from "@/hooks/useUnitedSales";
import {
  useActiveSellerOptions,
  useUnitedProductOptions,
} from "@/hooks/useUnitedSales";
import { useUpdateUnitedSale } from "@/hooks/useUpdateUnitedSale";

interface Props {
  sale: UnitedSale | null;
  onOpenChange: (open: boolean) => void;
}

/** Ret salgsdato, sælger og produkt på ét United-salg. */
export function UnitedEditSaleDialog({ sale, onOpenChange }: Props) {
  const open = !!sale;
  const { data: sellers } = useActiveSellerOptions(open);
  const { data: products } = useUnitedProductOptions(open);
  const update = useUpdateUnitedSale();

  const [date, setDate] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [productId, setProductId] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (!sale) return;
    setDate(format(new Date(sale.saleDatetime), "yyyy-MM-dd"));
    setAgentEmail((sale.agentEmail || "").toLowerCase());
    setProductId(sale.productId || "");
    setPhone(sale.customerPhone || "");
  }, [sale]);

  if (!sale) return null;

  const originalDate = format(new Date(sale.saleDatetime), "yyyy-MM-dd");
  const originalEmail = (sale.agentEmail || "").toLowerCase();
  const originalPhone = sale.customerPhone || "";
  const productChanged = !!productId && productId !== (sale.productId || "");
  const dateChanged = !!date && date !== originalDate;
  const trimmedPhone = phone.trim();
  const phoneChanged = trimmedPhone !== originalPhone;
  const hasChanges =
    dateChanged || agentEmail !== originalEmail || productChanged || phoneChanged;

  /** Ny dato, men samme klokkeslæt som salget havde. */
  const buildNewDatetime = () => {
    const [y, m, d] = date.split("-").map(Number);
    const original = new Date(sale.saleDatetime);
    const next = new Date(original);
    next.setFullYear(y, m - 1, d);
    return next.toISOString();
  };

  const handleSave = async () => {
    try {
      await update.mutateAsync({
        saleId: sale.saleId,
        saleItemId: sale.saleItemId,
        saleDatetime: dateChanged ? buildNewDatetime() : undefined,
        agentEmail:
          agentEmail && agentEmail !== originalEmail ? agentEmail : undefined,
        productId: productChanged ? productId : undefined,
        customerPhone: phoneChanged ? trimmedPhone || null : undefined,
      });
      toast.success(
        productChanged
          ? "Salget er rettet og provisionen genberegnet"
          : "Salget er rettet"
      );
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Kunne ikke rette salget"
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ret salg</DialogTitle>
          <DialogDescription>
            Ændringer slår igennem i rapporter, boards og løngrundlag. Ved skift af
            produkt genberegnes provision og omsætning efter prisreglerne.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="united-sale-datetime">Salgsdato og tid</Label>
            <Input
              id="united-sale-datetime"
              type="datetime-local"
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Sælger</Label>
            <Select value={agentEmail} onValueChange={setAgentEmail}>
              <SelectTrigger>
                <SelectValue placeholder="Vælg sælger" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {(sellers || []).map((s) => (
                  <SelectItem key={s.email} value={s.email}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {originalEmail && !(sellers || []).some((s) => s.email === originalEmail) && (
              <p className="text-xs text-muted-foreground">
                Nuværende sælger: {sale.sellerName} (ikke aktiv medarbejder)
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Produkt</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Vælg produkt" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {(products || []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                    {p.clientName ? ` — ${p.clientName}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Nuværende: {sale.productName} ·{" "}
              {sale.mappedCommission.toLocaleString("da-DK")} kr provision /{" "}
              {sale.mappedRevenue.toLocaleString("da-DK")} kr omsætning
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={update.isPending}
          >
            Annuller
          </Button>
          <Button onClick={handleSave} disabled={update.isPending || !hasChanges}>
            {update.isPending ? "Gemmer..." : "Gem ændringer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
