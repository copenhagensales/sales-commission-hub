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
import { Loader2, X, Ban } from "lucide-react";
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
        .select("id, display_name, adversus_product_title, quantity, mapped_commission, mapped_revenue, is_cancelled")
        .eq("sale_id", saleId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!saleId && open,
  });

  const cancelItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from("sale_items")
        .update({ is_cancelled: true })
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Produkt annulleret", description: "Produktet er blevet markeret som annulleret." });
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

      const { error: itemsError } = await supabase
        .from("sale_items")
        .update({ is_cancelled: true })
        .eq("sale_id", saleId);
      if (itemsError) throw itemsError;
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
  const isPending = cancelItemMutation.isPending || cancelAllMutation.isPending;

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
            Annuller hele salget eller udvalgte produkter
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
                  <TableHead className="text-right">Provision</TableHead>
                  <TableHead className="text-right">Handling</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {saleItems.map((item) => (
                  <TableRow key={item.id} className={item.is_cancelled ? "opacity-50" : ""}>
                    <TableCell className={item.is_cancelled ? "line-through" : ""}>
                      {item.display_name ?? item.adversus_product_title ?? "Ukendt produkt"}
                    </TableCell>
                    <TableCell className={`text-right ${item.is_cancelled ? "line-through" : ""}`}>
                      {item.quantity ?? 1}
                    </TableCell>
                    <TableCell className={`text-right ${item.is_cancelled ? "line-through" : ""}`}>
                      {formatCommission(item.mapped_commission)}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.is_cancelled ? (
                        <Badge variant="outline" className="text-muted-foreground">Annulleret</Badge>
                      ) : confirmItemId === item.id ? (
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={isPending}
                            onClick={() => cancelItemMutation.mutate(item.id)}
                          >
                            {cancelItemMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Bekræft"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmItemId(null)}
                          >
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
                          <X className="h-3 w-3 mr-1" />
                          Annuller
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
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
