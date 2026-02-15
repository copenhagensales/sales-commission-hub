import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Ban, Minus } from "lucide-react";
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

interface CancellationDialogProps {
  saleId: string | null;
  open: boolean;
  onClose: () => void;
}

export function CancellationDialog({ saleId, open, onClose }: CancellationDialogProps) {
  const queryClient = useQueryClient();
  const [confirmItemId, setConfirmItemId] = useState<string | null>(null);

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

  const cancelOneUnitMutation = useMutation({
    mutationFn: async (item: { id: string; quantity: number; cancelled_quantity: number }) => {
      const newCancelled = (item.cancelled_quantity ?? 0) + 1;
      const fullyDone = newCancelled >= (item.quantity ?? 1);
      const { error } = await supabase
        .from("sale_items")
        .update({
          cancelled_quantity: newCancelled,
          is_cancelled: fullyDone,
        })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "1 stk annulleret", description: "Produktet er delvist annulleret." });
      queryClient.invalidateQueries({ queryKey: ["sale-items-for-cancellation", saleId] });
      queryClient.invalidateQueries({ queryKey: ["sales-for-cancellations"] });
      setConfirmItemId(null);
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

      // Set each item's cancelled_quantity = quantity and is_cancelled = true
      for (const item of saleItems) {
        const { error } = await supabase
          .from("sale_items")
          .update({
            cancelled_quantity: item.quantity ?? 1,
            is_cancelled: true,
          })
          .eq("id", item.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Salg annulleret", description: "Hele salget og alle produkter er annulleret." });
      queryClient.invalidateQueries({ queryKey: ["sale-items-for-cancellation", saleId] });
      queryClient.invalidateQueries({ queryKey: ["sales-for-cancellations"] });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const allCancelled = saleItems.length > 0 && saleItems.every((item) => item.is_cancelled);
  const isPending = cancelOneUnitMutation.isPending || cancelAllMutation.isPending;

  const formatCommission = (value: number | null) => {
    if (value == null) return "-";
    return `${Math.round(value)} kr`;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Produkter i salget</DialogTitle>
          <DialogDescription>
            Annuller hele salget eller udvalgte produkter (1 stk ad gangen)
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : saleItems.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Ingen produkter fundet for dette salg.</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produkt</TableHead>
                  <TableHead className="text-right">Antal</TableHead>
                  <TableHead className="text-right">Prov./stk</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                  <TableHead className="text-right">Handling</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {saleItems.map((item) => {
                  const qty = item.quantity ?? 1;
                  const cancelled = item.cancelled_quantity ?? 0;
                  const remaining = qty - cancelled;
                  const fullyDone = remaining <= 0;
                  const perUnit = qty > 0 && item.mapped_commission != null
                    ? item.mapped_commission / qty
                    : null;

                  return (
                    <TableRow key={item.id} className={fullyDone ? "opacity-50" : ""}>
                      <TableCell className={fullyDone ? "line-through" : ""}>
                        {item.display_name ?? item.adversus_product_title ?? "Ukendt produkt"}
                      </TableCell>
                      <TableCell className="text-right">
                        {cancelled > 0 ? (
                          <span>
                            <span className="text-muted-foreground line-through mr-1">{qty}</span>
                            {remaining}
                          </span>
                        ) : (
                          qty
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCommission(perUnit)}
                      </TableCell>
                      <TableCell className="text-right">
                        {fullyDone ? (
                          <Badge variant="outline" className="text-muted-foreground">Annulleret</Badge>
                        ) : cancelled > 0 ? (
                          <Badge variant="secondary">{cancelled} annulleret</Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">
                        {!fullyDone && (
                          confirmItemId === item.id ? (
                            <div className="flex items-center gap-1 justify-end">
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={isPending}
                                onClick={() => cancelOneUnitMutation.mutate({
                                  id: item.id,
                                  quantity: qty,
                                  cancelled_quantity: cancelled,
                                })}
                              >
                                {cancelOneUnitMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Bekræft"}
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setConfirmItemId(null)}>
                                Fortryd
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isPending}
                              onClick={() => setConfirmItemId(item.id)}
                            >
                              <Minus className="h-3 w-3 mr-1" />
                              Annuller 1 stk
                            </Button>
                          )
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Luk
          </Button>
          {saleItems.length > 0 && !allCancelled && (
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
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
