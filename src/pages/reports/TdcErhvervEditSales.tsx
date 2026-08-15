import { useState } from "react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { CalendarIcon, Pencil, Trash2 } from "lucide-react";
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
import { toast } from "sonner";
import {
  useTdcErhvervSales,
  useDeleteTdcErhvervOpp,
  useIsTdcErhvervLeader,
  type TdcOppGroup,
} from "@/hooks/useTdcErhvervSales";

export default function TdcErhvervEditSales() {
  const [day, setDay] = useState<Date>(new Date());
  const [deleteTarget, setDeleteTarget] = useState<TdcOppGroup | null>(null);

  const { data: hasAccess, isLoading: loadingAccess } = useIsTdcErhvervLeader();
  const { data: groups, isLoading } = useTdcErhvervSales(day, hasAccess === true);
  const deleteOpp = useDeleteTdcErhvervOpp();

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteOpp.mutateAsync(deleteTarget.saleIds);
      toast.success("Salget er slettet");
      setDeleteTarget(null);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Kunne ikke slette salget"
      );
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">TDC Erhverv - ret salg</h1>
          <p className="text-muted-foreground">
            Retning og korrektion af TDC Erhverv salg
          </p>
        </div>

        {!loadingAccess && hasAccess === false ? (
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-xl">Ingen adgang</CardTitle>
              <CardDescription>
                Siden er forbeholdt leder og assisterende leder på TDC Erhverv.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-xl">Salg pr. OPP</CardTitle>
                <CardDescription>
                  Alle TDC Erhverv salg på den valgte dag, samlet pr. OPP-nummer.
                </CardDescription>
              </div>
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
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border/50 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">OPP nr.</TableHead>
                      <TableHead className="whitespace-nowrap">Sælgernavn</TableHead>
                      <TableHead className="w-full min-w-[280px]">
                        Produktnavn (inkl. antal)
                      </TableHead>
                      <TableHead className="w-44 whitespace-nowrap text-right">
                        Handlinger
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading || loadingAccess ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="py-16 text-center text-sm text-muted-foreground"
                        >
                          Henter salg...
                        </TableCell>
                      </TableRow>
                    ) : (groups || []).length > 0 ? (
                      (groups || []).map((group) => (
                        <TableRow key={group.saleIds.join("-")} className="align-top">
                          <TableCell className="font-mono text-xs whitespace-nowrap align-top">
                            {group.opp || "Uden OPP"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap align-top">
                            {group.sellerName}
                          </TableCell>
                          <TableCell className="min-w-[280px] align-top">
                            {group.products.length > 0 ? (
                              <div className="flex flex-col gap-1">
                                {group.products.map((p, i) => (
                                  <span key={`${p.name}-${i}`}>
                                    {p.name} x{p.quantity}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="w-44 whitespace-nowrap align-top">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled
                                className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Rediger
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteTarget(group)}
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
                          colSpan={4}
                          className="py-16 text-center text-sm text-muted-foreground"
                        >
                          Ingen TDC Erhverv salg på den valgte dag.
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
                  ? `Du er ved at slette ${deleteTarget.saleIds.length} salgsregistrering(er) under ${
                      deleteTarget.opp || "salg uden OPP"
                    } (${deleteTarget.sellerName}). Sletningen er permanent og fjerner provision og omsætning fra rapporter.`
                  : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteOpp.isPending}>
                Annuller
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete();
                }}
                disabled={deleteOpp.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteOpp.isPending ? "Sletter..." : "Bekræft sletning"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
