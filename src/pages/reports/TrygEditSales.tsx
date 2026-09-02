import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { endOfMonth, format, startOfMonth, subDays, subMonths } from "date-fns";
import { da } from "date-fns/locale";
import { CalendarIcon, Check, Copy, FileText, Mail, Pencil, Search, X } from "lucide-react";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrygSalesTable } from "@/components/reports/TrygSalesTable";
import { SendTrygMailDialog } from "@/components/reports/SendTrygMailDialog";

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
  const queryClient = useQueryClient();
  const [day, setDay] = useState<Date>(new Date());
  const [rangeFrom, setRangeFrom] = useState<Date>(new Date());
  const [rangeTo, setRangeTo] = useState<Date>(new Date());
  const [deleteTarget, setDeleteTarget] = useState<TrygKanvasSale | null>(null);
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [draftTemplate, setDraftTemplate] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [phoneSearch, setPhoneSearch] = useState("");
  const [isMailOpen, setIsMailOpen] = useState(false);

  // Nulstil markeringer og søgning ved skift af dag — perioden følger dagen
  useEffect(() => {
    setSelectedIds(new Set());
    setPhoneSearch("");
    setRangeFrom(day);
    setRangeTo(day);
  }, [day]);


  const { data: sales, isLoading } = useTrygKanvasSales(day, undefined, hasAccess);
  const { data: rangeSalesData, isLoading: isLoadingRange } = useTrygKanvasSales(
    rangeFrom,
    rangeTo,
    hasAccess
  );
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
        next.delete(deleteTarget.saleId);
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



  const toggleSelected = (saleId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(saleId)) next.delete(saleId);
      else next.add(saleId);
      return next;
    });
  };

  /** Numrene på de markerede linjer, i tabellens rækkefølge. */
  const selectedPhones = useMemo(
    () =>
      (sales || [])
        .filter((s) => selectedIds.has(s.saleId) && s.customerPhone)
        .map((s) => s.customerPhone as string),
    [sales, selectedIds]
  );

  const matchesSearch = (phone: string | null) => {
    const needle = normalizePhone(phoneSearch);
    if (!needle) return true;
    return normalizePhone(phone || "").includes(needle);
  };

  /** Synlige linjer for Gennemgang (den valgte dag) efter telefon-søgning. */
  const visibleSales = useMemo(
    () => (sales || []).filter((s) => matchesSearch(s.customerPhone)),
    [sales, phoneSearch]
  );

  /** Synlige linjer for status-fanerne (den valgte periode). */
  const visibleRangeSales = useMemo(
    () => (rangeSalesData || []).filter((s) => matchesSearch(s.customerPhone)),
    [rangeSalesData, phoneSearch]
  );

  /** Status pr. salgslinje — dagen (Gennemgang) og perioden (status-faner). */
  const saleIds = useMemo(
    () => (sales || []).map((s) => s.saleId),
    [sales]
  );
  const rangeSaleItemIds = useMemo(
    () => (rangeSalesData || []).map((s) => s.saleId),
    [rangeSalesData]
  );
  const { data: reviewMap } = useTrygSaleReviews(saleIds, hasAccess);
  const { data: rangeReviewMap } = useTrygSaleReviews(
    rangeSaleItemIds,
    hasAccess
  );
  const reviews = reviewMap ?? new Map();
  const rangeReviews = rangeReviewMap ?? new Map();
  const setReview = useSetTrygSaleReview();
  const clearReview = useClearTrygSaleReview();

  /** Perioden dækker mere end én dag → vis dato-kolonne. */
  const showDateColumn =
    format(rangeFrom, "yyyy-MM-dd") !== format(rangeTo, "yyyy-MM-dd");

  const pendingSales = useMemo(
    () => visibleSales.filter((s) => !reviews.has(s.saleId)),
    [visibleSales, reviews]
  );
  const rejectedSales = useMemo(
    () =>
      visibleRangeSales.filter(
        (s) => rangeReviews.get(s.saleId)?.status === "rejected"
      ),
    [visibleRangeSales, rangeReviews]
  );
  const approvedSales = useMemo(
    () =>
      visibleRangeSales.filter(
        (s) => rangeReviews.get(s.saleId)?.status === "approved"
      ),
    [visibleRangeSales, rangeReviews]
  );


  const applyStatus = async (ids: string[], status: TrygReviewStatus) => {
    if (ids.length === 0) return;
    try {
      await setReview.mutateAsync({ saleIds: ids, status });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      toast.success(
        status === "approved"
          ? `${ids.length} salg godkendt`
          : `${ids.length} salg afvist`
      );
    } catch (error: unknown) {
      // Salget kan være forsvundet siden listen blev hentet — hent den forfra.
      queryClient.invalidateQueries({ queryKey: ["tryg-kanvas-sales"] });
      queryClient.invalidateQueries({ queryKey: ["tryg-sale-reviews"] });
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: unknown }).message)
          : "Kunne ikke gemme status";
      toast.error(`Kunne ikke gemme status: ${message}`);
    }
  };

  const clearStatus = async (saleId: string) => {
    try {
      await clearReview.mutateAsync([saleId]);
      toast.success("Status fjernet — linjen ligger i Gennemgang igen");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Kunne ikke fjerne status"
      );
    }
  };


  const handleCopySelected = async () => {
    if (selectedPhones.length === 0) return;
    await copyText(fillPhonePlaceholders(template, selectedPhones));
  };

  const mailBody = useMemo(
    () => fillPhonePlaceholders(template, selectedPhones),
    [template, selectedPhones]
  );
  const mailSubject = `Annullering af Kanvas-møder - ${format(day, "dd/MM/yyyy", {
    locale: da,
  })}`;


  const setQuickRange = (from: Date, to: Date) => {
    setRangeFrom(from);
    setRangeTo(to);
  };

  const today = new Date();
  const periodPicker = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Periode:</span>
      {(
        [
          ["Fra", rangeFrom, setRangeFrom],
          ["Til", rangeTo, setRangeTo],
        ] as const
      ).map(([label, value, setValue]) => (
        <Popover key={label}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2">
              <CalendarIcon className="h-4 w-4" />
              {label}: {format(value, "dd/MM/yyyy", { locale: da })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={value}
              onSelect={(d) => d && setValue(d)}
              locale={da}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      ))}
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-9"
          onClick={() => setQuickRange(today, today)}
        >
          I dag
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-9"
          onClick={() => setQuickRange(subDays(today, 6), today)}
        >
          Sidste 7 dage
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-9"
          onClick={() => setQuickRange(startOfMonth(today), today)}
        >
          Denne måned
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-9"
          onClick={() => {
            const prev = subMonths(today, 1);
            setQuickRange(startOfMonth(prev), endOfMonth(prev));
          }}
        >
          Sidste måned
        </Button>
      </div>
    </div>
  );


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

                <TabsContent value="rejected" className="space-y-4">
                  {periodPicker}
                  <TrygSalesTable
                    mode="status"
                    sales={rejectedSales}
                    isLoading={isLoadingRange || loadingAccess}
                    emptyText="Ingen afviste salg i den valgte periode."
                    reviews={rangeReviews}
                    onUndo={clearStatus}
                    isPending={clearReview.isPending}
                    showDate={showDateColumn}
                  />
                </TabsContent>

                <TabsContent value="approved" className="space-y-4">
                  {periodPicker}
                  <TrygSalesTable
                    mode="status"
                    sales={approvedSales}
                    isLoading={isLoadingRange || loadingAccess}
                    emptyText="Ingen godkendte salg i den valgte periode."
                    reviews={rangeReviews}
                    onUndo={clearStatus}
                    isPending={clearReview.isPending}
                    showDate={showDateColumn}
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
