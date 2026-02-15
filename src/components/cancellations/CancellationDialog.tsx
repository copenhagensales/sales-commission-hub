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
import { Loader2, Ban, Minus, ThumbsDown } from "lucide-react";
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
  const [confirmAction, setConfirmAction] = useState<{ itemId: string; type: "cancel" | "reject" } | null>(null);

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
  };

  const cancelOneUnitMutation = useMutation({
    mutationFn: async (item: { id: string; quantity: number; cancelled_quantity: number }) => {
      const newCancelled = (item.cancelled_quantity ?? 0) + 1;
      const fullyDone = newCancelled >= (item.quantity ?? 1);
      const { error } = await supabase
        .from("sale_items")
        .update({ cancelled_quantity: newCancelled, is_cancelled: fullyDone })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "1 stk annulleret", description: "Produktet er delvist annulleret." });
      invalidateQueries();
      setConfirmAction(null);
    },
    onError: (error: Error) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const rejectOneUnitMutation = useMutation({
    mutationFn: async (item: { id: string; quantity: number; cancelled_quantity: number }) => {
      const newCancelled = (item.cancelled_quantity ?? 0) + 1;
      const fullyDone = newCancelled >= (item.quantity ?? 1);
      const { error } = await supabase
        .from("sale_items")
        .update({ cancelled_quantity: newCancelled, is_cancelled: fullyDone })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "1 stk afvist", description: "Produktet er delvist afvist." });
      invalidateQueries();
      setConfirmAction(null);
    },
    onError: (error: Error) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const undoOneUnitMutation = useMutation({
    mutationFn: async (item: { id: string; cancelled_quantity: number }) => {
      if (!saleId) throw new Error("No saleId");
      const newCancelled = Math.max((item.cancelled_quantity ?? 0) - 1, 0);
      const { error } = await supabase
        .from("sale_items")
        .update({ cancelled_quantity: newCancelled, is_cancelled: false })
        .eq("id", item.id);
      if (error) throw error;

      // Check if at least one unit is now active across all sale_items
      const { data: allItems, error: fetchError } = await supabase
        .from("sale_items")
        .select("quantity, cancelled_quantity")
        .eq("sale_id", saleId);
      if (fetchError) throw fetchError;

      const hasActiveUnit = (allItems ?? []).some(
        (si) => (si.quantity ?? 1) - (si.cancelled_quantity ?? 0) > 0
      );

      if (hasActiveUnit) {
        const { error: salesError } = await supabase
          .from("sales")
          .update({ validation_status: null })
          .eq("id", saleId);
        if (salesError) throw salesError;
      }
    },
    onSuccess: () => {
      toast({ title: "1 stk gendannet", description: "Annulleringen er fortrudt for 1 stk." });
      invalidateQueries();
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
  const isPending = cancelOneUnitMutation.isPending || rejectOneUnitMutation.isPending || cancelAllMutation.isPending || rejectAllMutation.isPending || undoOneUnitMutation.isPending;

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
            Annuller eller afvis hele salget eller udvalgte produkter (1 stk ad gangen)
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
                        {cancelled > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isPending}
                            onClick={() => undoOneUnitMutation.mutate({ id: item.id, cancelled_quantity: cancelled })}
                            className="text-primary hover:text-primary/80 mr-1"
                          >
                            {undoOneUnitMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Fortryd 1"}
                          </Button>
                        )}
                        {!fullyDone && (
                          confirmAction?.itemId === item.id ? (
                            <div className="flex items-center gap-1 justify-end">
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={isPending}
                                onClick={() => {
                                  const mutate = confirmAction.type === "cancel" ? cancelOneUnitMutation : rejectOneUnitMutation;
                                  mutate.mutate({ id: item.id, quantity: qty, cancelled_quantity: cancelled });
                                }}
                              >
                                {(cancelOneUnitMutation.isPending || rejectOneUnitMutation.isPending) ? <Loader2 className="h-3 w-3 animate-spin" /> : "Bekræft"}
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setConfirmAction(null)}>
                                Fortryd
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={isPending}
                                onClick={() => setConfirmAction({ itemId: item.id, type: "cancel" })}
                              >
                                <Minus className="h-3 w-3 mr-1" />
                                Annuller 1
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={isPending}
                                onClick={() => setConfirmAction({ itemId: item.id, type: "reject" })}
                                className="text-destructive border-destructive/50 hover:bg-destructive/10"
                              >
                                <ThumbsDown className="h-3 w-3 mr-1" />
                                Afvis 1
                              </Button>
                            </div>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
