import { useState } from "react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { CalendarIcon, Copy, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useTrygEditAccess } from "@/hooks/useTrygEditAccess";
import {
  useTrygKanvasSales,
  useDeleteTrygKanvasSale,
  type TrygKanvasSale,
} from "@/hooks/useTrygKanvasSales";

const TRYG_CANCEL_TEMPLATE = `Hej Tryg,

Vil i annullerer mødet på [Telefonnummer].`;

const PHONE_PLACEHOLDER = "[Telefonnummer]";

export default function TrygEditSales() {
  const { hasAccess, isLoading: loadingAccess } = useTrygEditAccess();
  const [day, setDay] = useState<Date>(new Date());
  const [deleteTarget, setDeleteTarget] = useState<TrygKanvasSale | null>(null);

  const { data: sales, isLoading } = useTrygKanvasSales(day, hasAccess);
  const deleteSale = useDeleteTrygKanvasSale();

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteSale.mutateAsync(deleteTarget.saleId);
      toast.success("Salget er slettet");
      setDeleteTarget(null);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Kunne ikke slette salget"
      );
    }
  };

  const handleCopyTemplate = async (phone: string | null) => {
    if (!phone) return;
    try {
      await navigator.clipboard.writeText(
        TRYG_CANCEL_TEMPLATE.replace(PHONE_PLACEHOLDER, phone)
      );
      toast.success("Tekst kopieret");
    } catch {
      toast.error("Kunne ikke kopiere teksten");
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tryg - Ret salg</h1>
          <p className="text-muted-foreground">
            Retning og annullering af Tryg salg
          </p>
        </div>

        {!loadingAccess && !hasAccess ? (
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-xl">Ingen adgang</CardTitle>
              <CardDescription>
                Du har ikke adgang til at rette Tryg salg.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-xl">Kanvas-møder</CardTitle>
                <CardDescription>
                  Alle salg på "Meeting -- CPH sales Kanvas" på den valgte dag.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      {format(day, "dd/MM/yyyy", { locale: da })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={day}
                      onSelect={(d) => d && setDay(d)}
                      locale={da}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <FileText className="h-4 w-4" />
                      Skabelon
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80" align="end">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Annulleringstekst</p>
                      <Textarea
                        readOnly
                        value={TRYG_CANCEL_TEMPLATE}
                        rows={4}
                        className="resize-none text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Brug kopiér-knappen på en salgslinje for at indsætte
                        telefonnummeret automatisk.
                      </p>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border/50 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24 whitespace-nowrap">Tid</TableHead>
                      <TableHead className="whitespace-nowrap">Sælgernavn</TableHead>
                      <TableHead className="w-32 whitespace-nowrap">Telefon</TableHead>
                      <TableHead className="w-16 whitespace-nowrap text-right">
                        Antal
                      </TableHead>
                      <TableHead className="w-full min-w-[240px]">
                        Produktnavn
                      </TableHead>
                      <TableHead className="w-32 whitespace-nowrap text-right">
                        Handlinger
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading || loadingAccess ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="py-16 text-center text-sm text-muted-foreground"
                        >
                          Henter salg...
                        </TableCell>
                      </TableRow>
                    ) : (sales || []).length > 0 ? (
                      (sales || []).map((sale) => (
                        <TableRow key={sale.saleItemId}>
                          <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                            {format(new Date(sale.saleDatetime), "HH:mm")}
                          </TableCell>
                          <TableCell className="whitespace-nowrap font-medium">
                            {sale.sellerName}
                          </TableCell>
                          <TableCell className="whitespace-nowrap tabular-nums">
                            {sale.customerPhone || "—"}
                          </TableCell>
                          <TableCell className="w-16 text-right font-semibold text-primary tabular-nums">
                            {sale.quantity}
                          </TableCell>
                          <TableCell className="min-w-[240px]">
                            {sale.productName}
                          </TableCell>
                          <TableCell className="w-32 whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopyTemplate(sale.customerPhone)}
                                disabled={!sale.customerPhone}
                                title="Kopiér annulleringstekst"
                                className="h-8 gap-1.5"
                              >
                                <Copy className="h-3.5 w-3.5" />
                                Kopiér
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteTarget(sale)}
                                className="h-8 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Slet
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="py-16 text-center text-sm text-muted-foreground"
                        >
                          Ingen Kanvas-salg på den valgte dag.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        <AlertDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget
                  ? `Du er ved at slette salget fra ${deleteTarget.sellerName} kl. ${format(
                      new Date(deleteTarget.saleDatetime),
                      "HH:mm"
                    )}. Sletningen er permanent og fjerner provision og omsætning fra rapporter.`
                  : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteSale.isPending}>
                Annuller
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete();
                }}
                disabled={deleteSale.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteSale.isPending ? "Sletter..." : "Bekræft sletning"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
