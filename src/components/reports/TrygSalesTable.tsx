import { format } from "date-fns";
import { Check, RotateCcw, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { TrygKanvasSale } from "@/hooks/useTrygKanvasSales";
import type { TrygSaleReview } from "@/hooks/useTrygSaleReviews";

interface CommonProps {
  sales: TrygKanvasSale[];
  isLoading: boolean;
  emptyText: string;
}

interface ReviewProps extends CommonProps {
  mode: "review";
  selectedIds: Set<string>;
  onToggleSelected: (saleItemId: string) => void;
  onApprove: (saleItemId: string) => void;
  onReject: (saleItemId: string) => void;
  onApproveSelected: () => void;
  onRejectSelected: () => void;
  isPending: boolean;
}

interface StatusProps extends CommonProps {
  mode: "status";
  reviews: Map<string, TrygSaleReview>;
  onUndo: (saleItemId: string) => void;
  isPending: boolean;
  /** Vis dato-kolonne når perioden dækker mere end én dag. */
  showDate?: boolean;
}

type Props = ReviewProps | StatusProps;

/** Fælles tabel-skabelon for de tre faner på "Tryg - Ret salg". */
export function TrygSalesTable(props: Props) {
  const { sales, isLoading, emptyText, mode } = props;
  const showDate = mode === "status" && props.showDate === true;
  const colSpan = (mode === "review" ? 6 : 8) + (showDate ? 1 : 0);


  return (
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
            <TableHead className="w-full min-w-[240px]">Produktnavn</TableHead>
            {mode === "status" && (
              <>
                <TableHead className="w-40 whitespace-nowrap">
                  Behandlet af
                </TableHead>
                <TableHead className="w-36 whitespace-nowrap">
                  Tidspunkt
                </TableHead>
              </>
            )}
            <TableHead className="w-64 whitespace-nowrap text-right">
              {mode === "review" ? (
                <div className="flex items-center justify-end gap-1.5">
                  <Button
                    size="sm"
                    className="h-7 gap-1.5 text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
                    disabled={props.selectedIds.size === 0 || props.isPending}
                    onClick={props.onApproveSelected}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Godkend markerede
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-7 gap-1.5 text-xs font-medium"
                    disabled={props.selectedIds.size === 0 || props.isPending}
                    onClick={props.onRejectSelected}
                  >
                    <X className="h-3.5 w-3.5" />
                    Afvis markerede
                  </Button>
                  <span>Handlinger</span>
                </div>
              ) : (
                "Handlinger"
              )}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell
                colSpan={colSpan}
                className="py-16 text-center text-sm text-muted-foreground"
              >
                Henter salg...
              </TableCell>
            </TableRow>
          ) : sales.length > 0 ? (
            sales.map((sale) => {
              const review =
                mode === "status" ? props.reviews.get(sale.saleItemId) : undefined;
              return (
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
                  {mode === "status" && (
                    <>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {review?.reviewedByName || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                        {review
                          ? format(new Date(review.reviewedAt), "dd/MM HH:mm")
                          : "—"}
                      </TableCell>
                    </>
                  )}
                  <TableCell className="w-64 whitespace-nowrap">
                    {mode === "review" ? (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="destructive"
                          size="sm"
                          title="Afvis salg"
                          className="h-8 gap-1.5 font-medium"
                          disabled={props.isPending}
                          onClick={() => props.onReject(sale.saleItemId)}
                        >
                          <X className="h-3.5 w-3.5" />
                          Afvis
                        </Button>
                        <Button
                          size="sm"
                          title="Godkend salg"
                          className="h-8 gap-1.5 font-medium bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
                          disabled={props.isPending}
                          onClick={() => props.onApprove(sale.saleItemId)}
                        >
                          <Check className="h-3.5 w-3.5" />
                          Godkend
                        </Button>
                        <label
                          className={`flex h-8 cursor-pointer items-center gap-2 rounded-md border px-2.5 text-xs font-medium transition-colors ${
                            props.selectedIds.has(sale.saleItemId)
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-input bg-muted text-muted-foreground hover:bg-muted/70"
                          } ${!sale.customerPhone ? "pointer-events-none opacity-50" : ""}`}
                        >
                          <Checkbox
                            checked={props.selectedIds.has(sale.saleItemId)}
                            onCheckedChange={() =>
                              props.onToggleSelected(sale.saleItemId)
                            }
                            disabled={!sale.customerPhone}
                            aria-label="Markér salg"
                            className="h-5 w-5 border-muted-foreground/50"
                          />
                          Markér
                        </label>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5"
                          disabled={props.isPending}
                          onClick={() => props.onUndo(sale.saleItemId)}
                          title="Fortryd — send tilbage til Gennemgang"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Fortryd
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell
                colSpan={colSpan}
                className="py-16 text-center text-sm text-muted-foreground"
              >
                {emptyText}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
