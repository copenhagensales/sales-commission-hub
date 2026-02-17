import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Loader2, Ban, ThumbsDown, Trash2, Check } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AddProductSection } from "./AddProductSection";

interface EditCartDialogProps {
  saleId: string | null;
  open: boolean;
  onClose: () => void;
}

export function EditCartDialog({ saleId, open, onClose }: EditCartDialogProps) {
  const queryClient = useQueryClient();
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setIsDirty(false);
  }, [saleId]);

  const { data: saleItems = [], isLoading } = useQuery({
    queryKey: ["sale-items-for-cancellation", saleId],
    queryFn: async () => {
      if (!saleId) return [];
      const { data, error } = await supabase
        .from("sale_items")
        .select("id, display_name, adversus_product_title, quantity, mapped_commission, mapped_revenue, is_cancelled, cancelled_quantity")
        .eq("sale_id", saleId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!saleId && open,
  });

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["sale-items-for-cancellation", saleId] });
    queryClient.invalidateQueries({ queryKey: ["sales-for-cancellations"] });
    queryClient.invalidateQueries({ queryKey: ["sales-for-duplicates"] });
  };

  const updateQuantityMutation = useMutation({
    mutationFn: async ({ id, oldQuantity, newQuantity, oldCommission, oldRevenue }: {
      id: string;
      oldQuantity: number;
      newQuantity: number;
      oldCommission: number | null;
      oldRevenue: number | null;
    }) => {
      const perUnitCommission = oldQuantity > 0 && oldCommission != null ? oldCommission / oldQuantity : 0;
      const perUnitRevenue = oldQuantity > 0 && oldRevenue != null ? oldRevenue / oldQuantity : 0;
      const { error } = await supabase
        .from("sale_items")
        .update({
          quantity: newQuantity,
          mapped_commission: perUnitCommission * newQuantity,
          mapped_revenue: perUnitRevenue * newQuantity,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Antal opdateret", description: "Produktets antal er ændret." });
      setIsDirty(true);
      invalidateQueries();
    },
    onError: (error: Error) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("sale_items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Produkt fjernet", description: "Produktet er fjernet fra kurven." });
      setIsDirty(true);
      invalidateQueries();
      setDeleteItemId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const cancelAllMutation = useMutation({
    mutationFn: async () => {
      if (!saleId) return;
      const { error: salesError } = await supabase
        .from("sales")
        .update({ validation_status: "cancelled" })
        .eq("id", saleId);
      if (salesError) throw salesError;

      for (const item of saleItems) {
        const { error } = await supabase
          .from("sale_items")
          .update({ cancelled_quantity: item.quantity ?? 1, is_cancelled: true })
          .eq("id", item.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Salg annulleret", description: "Hele salget og alle produkter er annulleret." });
      invalidateQueries();
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const rejectAllMutation = useMutation({
    mutationFn: async () => {
      if (!saleId) return;
      const { error: salesError } = await supabase
        .from("sales")
        .update({ validation_status: "rejected" })
        .eq("id", saleId);
      if (salesError) throw salesError;

      for (const item of saleItems) {
        const { error } = await supabase
          .from("sale_items")
          .update({ cancelled_quantity: item.quantity ?? 1, is_cancelled: true })
          .eq("id", item.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Salg afvist", description: "Hele salget og alle produkter er afvist." });
      invalidateQueries();
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const allCancelled = saleItems.length > 0 && saleItems.every((item) => item.is_cancelled);
  const isPending = cancelAllMutation.isPending || rejectAllMutation.isPending || deleteItemMutation.isPending || updateQuantityMutation.isPending;

  const formatCommission = (value: number | null) => {
    if (value == null) return "-";
    return `${Math.round(value)} kr`;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Rediger kurv</DialogTitle>
          <DialogDescription>
            Tilføj eller fjern produkter, eller annuller/afvis hele salget
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {saleId && <AddProductSection saleId={saleId} onAdded={() => setIsDirty(true)} />}

            {saleItems.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Ingen produkter i kurven.</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produkt</TableHead>
                      <TableHead className="text-right w-24">Antal</TableHead>
                      <TableHead className="text-right">Prov./stk</TableHead>
                      <TableHead className="text-right w-16">Handling</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {saleItems.map((item) => {
                      const qty = item.quantity ?? 1;
                      const perUnit = qty > 0 && item.mapped_commission != null
                        ? item.mapped_commission / qty
                        : null;

                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            {item.display_name ?? item.adversus_product_title ?? "Ukendt produkt"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min={1}
                              defaultValue={qty}
                              className="w-20 h-8 text-right ml-auto"
                              disabled={isPending}
                              onBlur={(e) => {
                                const newQty = parseInt(e.target.value, 10);
                                if (!isNaN(newQty) && newQty >= 1 && newQty !== qty) {
                                  updateQuantityMutation.mutate({
                                    id: item.id,
                                    oldQuantity: qty,
                                    newQuantity: newQty,
                                    oldCommission: item.mapped_commission,
                                    oldRevenue: item.mapped_revenue,
                                  });
                                } else {
                                  e.target.value = String(qty);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                              }}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCommission(perUnit)}
                          </TableCell>
                          <TableCell className="text-right">
                            <AlertDialog open={deleteItemId === item.id} onOpenChange={(o) => !o && setDeleteItemId(null)}>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={isPending}
                                  onClick={() => setDeleteItemId(item.id)}
                                  className="text-destructive hover:text-destructive/80"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Fjern produkt</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Er du sikker på at du vil fjerne "{item.display_name ?? item.adversus_product_title ?? "dette produkt"}" fra kurven?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Fortryd</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteItemMutation.mutate(item.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Ja, fjern produkt
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Luk
          </Button>
          {!allCancelled && (
            <>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={isPending}>
                    <Ban className="h-4 w-4 mr-1" />
                    Annuller hele salget
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Bekræft annullering af hele salget</AlertDialogTitle>
                    <AlertDialogDescription>
                      Er du sikker på at du vil annullere hele salget og alle tilhørende produkter? Denne handling kan ikke fortrydes.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Fortryd</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => cancelAllMutation.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Ja, annuller hele salget
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" disabled={isPending} className="text-destructive border-destructive/50 hover:bg-destructive/10">
                    <ThumbsDown className="h-4 w-4 mr-1" />
                    Afvis hele salget
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Bekræft afvisning af hele salget</AlertDialogTitle>
                    <AlertDialogDescription>
                      Er du sikker på at du vil afvise hele salget og alle tilhørende produkter? Denne handling kan ikke fortrydes.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Fortryd</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => rejectAllMutation.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Ja, afvis hele salget
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
          {isDirty && (
            <Button
              onClick={onClose}
              disabled={isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Check className="h-4 w-4 mr-1" />
              Gem
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
