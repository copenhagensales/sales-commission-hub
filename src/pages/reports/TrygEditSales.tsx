import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { CalendarIcon, Check, Copy, FileText, Pencil, Search, X } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrygSalesTable } from "@/components/reports/TrygSalesTable";

import {
  useReportTextTemplate,
  useSaveReportTextTemplate,
} from "@/hooks/useReportTextTemplate";
import { useTrygEditAccess } from "@/hooks/useTrygEditAccess";
import {
  useTrygKanvasSales,
  useDeleteTrygKanvasSale,
  type TrygKanvasSale,
} from "@/hooks/useTrygKanvasSales";
import {
  useTrygSaleReviews,
  useSetTrygSaleReview,
  useClearTrygSaleReview,
  type TrygReviewStatus,
} from "@/hooks/useTrygSaleReviews";


const TRYG_CANCEL_TEMPLATE = `Hej Tryg,

Vil i annullerer mødet på [Telefonnummer].`;

const PHONE_PLACEHOLDER = "[Telefonnummer]";
const PHONE_PLACEHOLDER_RE = /\[Telefonnummer(\d*)\]/g;
const TEMPLATE_KEY = "tryg_cancel_meeting";

/**
 * Udfylder telefon-placeholders i skabelonen.
 * - `[Telefonnummer]` uden tal: alle numre indsættes på hver sin linje.
 * - `[Telefonnummer1]`, `[Telefonnummer2]` ...: udfyldes i rækkefølge.
 *   Overskydende numre tilføjes som ekstra linjer efter sidste plads,
 *   og ubrugte placeholder-linjer fjernes helt.
 */
function fillPhonePlaceholders(template: string, phones: string[]): string {
  const numberedSlots = [...template.matchAll(PHONE_PLACEHOLDER_RE)].filter(
    (m) => m[1] !== ""
  );

  if (numberedSlots.length === 0) {
    return template.replace(PHONE_PLACEHOLDER_RE, phones.join("\n"));
  }

  let index = 0;
  let lastFilledLine = -1;
  const lines = template.split("\n");
  const output: string[] = [];

  lines.forEach((line) => {
    let removedLine = false;
    const replaced = line.replace(PHONE_PLACEHOLDER_RE, (match, digits) => {
      if (digits === "") return phones.join("\n");
      const phone = phones[index++];
      if (phone === undefined) {
        removedLine = true;
        return "";
      }
      return phone;
    });

    // Fjern linjer hvor den eneste placeholder ikke kunne udfyldes
    if (removedLine && replaced.trim() === "") return;

    output.push(replaced);
    if (replaced !== line) lastFilledLine = output.length - 1;
  });

  // Tilføj overskydende numre lige efter sidste udfyldte plads
  if (index < phones.length && lastFilledLine >= 0) {
    output.splice(lastFilledLine + 1, 0, ...phones.slice(index));
  }

  return output.join("\n");
}


/** Kun cifre, uden dansk landekode foran — bruges til telefon-søgning. */
function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("0045")) return digits.slice(4);
  if (digits.startsWith("45") && digits.length > 8) return digits.slice(2);
  return digits;
}

export default function TrygEditSales() {
  const { hasAccess, isLoading: loadingAccess } = useTrygEditAccess();
  const [day, setDay] = useState<Date>(new Date());
  const [deleteTarget, setDeleteTarget] = useState<TrygKanvasSale | null>(null);
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [draftTemplate, setDraftTemplate] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [phoneSearch, setPhoneSearch] = useState("");

  // Nulstil markeringer og søgning ved skift af dag
  useEffect(() => {
    setSelectedIds(new Set());
    setPhoneSearch("");
  }, [day]);


  const { data: sales, isLoading } = useTrygKanvasSales(day, hasAccess);
  const deleteSale = useDeleteTrygKanvasSale();
  const { body: template } = useReportTextTemplate(
    TEMPLATE_KEY,
    TRYG_CANCEL_TEMPLATE
  );
  const saveTemplate = useSaveReportTextTemplate(TEMPLATE_KEY);

  const startEditTemplate = () => {
    setDraftTemplate(template);
    setIsEditingTemplate(true);
  };

  const handleSaveTemplate = async () => {
    try {
      await saveTemplate.mutateAsync(draftTemplate);
      toast.success("Skabelonen er gemt");
      setIsEditingTemplate(false);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Kunne ikke gemme skabelonen"
      );
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteSale.mutateAsync(deleteTarget.saleId);
      toast.success("Salget er slettet");
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteTarget.saleItemId);
        return next;
      });
      setDeleteTarget(null);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Kunne ikke slette salget"
      );
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Tekst kopieret");
    } catch {
      toast.error("Kunne ikke kopiere teksten");
    }
  };



  const toggleSelected = (saleItemId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(saleItemId)) next.delete(saleItemId);
      else next.add(saleItemId);
      return next;
    });
  };

  /** Numrene på de markerede linjer, i tabellens rækkefølge. */
  const selectedPhones = useMemo(
    () =>
      (sales || [])
        .filter((s) => selectedIds.has(s.saleItemId) && s.customerPhone)
        .map((s) => s.customerPhone as string),
    [sales, selectedIds]
  );

  /** Synlige linjer efter telefon-søgning. */
  const visibleSales = useMemo(() => {
    const needle = normalizePhone(phoneSearch);
    if (!needle) return sales || [];
    return (sales || []).filter((s) =>
      normalizePhone(s.customerPhone || "").includes(needle)
    );
  }, [sales, phoneSearch]);



  const handleCopySelected = async () => {
    if (selectedPhones.length === 0) return;
    await copyText(fillPhonePlaceholders(template, selectedPhones));
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
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={phoneSearch}
                    onChange={(e) => setPhoneSearch(e.target.value)}
                    placeholder="Søg telefonnummer"
                    inputMode="tel"
                    className="h-10 w-56 pl-9 pr-8"
                  />
                  {phoneSearch && (
                    <button
                      type="button"
                      onClick={() => setPhoneSearch("")}
                      aria-label="Ryd søgning"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={handleCopySelected}
                  disabled={selectedPhones.length === 0}
                  title="Kopiér annulleringstekst med alle markerede numre"
                >
                  <Copy className="h-4 w-4" />
                  Kopiér markerede
                  {selectedPhones.length > 0 ? ` (${selectedPhones.length})` : ""}
                </Button>
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
                  <PopoverContent className="w-[30rem] max-w-[90vw]" align="end">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">Annulleringstekst</p>
                        {!isEditingTemplate && hasAccess && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={startEditTemplate}
                            className="h-8 gap-1.5"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Rediger
                          </Button>
                        )}
                      </div>
                      <Textarea
                        readOnly={!isEditingTemplate}
                        value={isEditingTemplate ? draftTemplate : template}
                        onChange={(e) => setDraftTemplate(e.target.value)}
                        rows={9}
                        className="resize-y text-sm"
                      />
                      {isEditingTemplate ? (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">
                            Behold en placeholder: {PHONE_PLACEHOLDER} (alle
                            numre på hver sin linje) eller [Telefonnummer1],
                            [Telefonnummer2] osv. — de udfyldes i rækkefølge, og
                            ubrugte linjer fjernes.
                          </p>

                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setIsEditingTemplate(false)}
                              disabled={saveTemplate.isPending}
                            >
                              Annuller
                            </Button>
                            <Button
                              size="sm"
                              onClick={handleSaveTemplate}
                              disabled={saveTemplate.isPending}
                            >
                              {saveTemplate.isPending ? "Gemmer..." : "Gem"}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Brug kopiér-knappen på en salgslinje for at indsætte
                          telefonnummeret automatisk.
                        </p>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="review">
                <TabsList className="mb-4">
                  <TabsTrigger value="review">
                    Gennemgang ({pendingSales.length})
                  </TabsTrigger>
                  <TabsTrigger value="rejected">
                    Afviste salg ({rejectedSales.length})
                  </TabsTrigger>
                  <TabsTrigger value="approved">
                    Godkendte salg ({approvedSales.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="review">
                  <TrygSalesTable
                    mode="review"
                    sales={pendingSales}
                    isLoading={isLoading || loadingAccess}
                    emptyText={
                      phoneSearch
                        ? "Ingen salg matcher søgningen."
                        : "Ingen Kanvas-salg til gennemgang på den valgte dag."
                    }
                    selectedIds={selectedIds}
                    onToggleSelected={toggleSelected}
                    onApprove={(id) => applyStatus([id], "approved")}
                    onReject={(id) => applyStatus([id], "rejected")}
                    onApproveSelected={() =>
                      applyStatus(Array.from(selectedIds), "approved")
                    }
                    onRejectSelected={() =>
                      applyStatus(Array.from(selectedIds), "rejected")
                    }
                    isPending={setReview.isPending}
                  />
                </TabsContent>

                <TabsContent value="rejected">
                  <TrygSalesTable
                    mode="status"
                    sales={rejectedSales}
                    isLoading={isLoading || loadingAccess}
                    emptyText="Ingen afviste salg på den valgte dag."
                    reviews={reviews}
                    onUndo={clearStatus}
                    isPending={clearReview.isPending}
                  />
                </TabsContent>

                <TabsContent value="approved">
                  <TrygSalesTable
                    mode="status"
                    sales={approvedSales}
                    isLoading={isLoading || loadingAccess}
                    emptyText="Ingen godkendte salg på den valgte dag."
                    reviews={reviews}
                    onUndo={clearStatus}
                    isPending={clearReview.isPending}
                  />
                </TabsContent>
              </Tabs>
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
