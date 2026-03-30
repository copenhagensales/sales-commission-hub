import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "sonner";
import { useSellerSalariesCached } from "@/hooks/useSellerSalariesCached";
import { getPayrollPeriod } from "@/lib/calculations";
import ExcelJS from "exceljs";

const ALL_COLUMNS = [
  { key: "name", label: "Navn", default: true },
  { key: "team", label: "Team", default: true },
  { key: "commission", label: "Provision", default: true },
  { key: "cancellations", label: "Annulleringer", default: true },
  { key: "vacationPay", label: "Feriepenge", default: true },
  { key: "diet", label: "Diet", default: true },
  { key: "sickDays", label: "Sygdom", default: true },
  { key: "dailyBonus", label: "Dagsbonus", default: true },
  { key: "startupBonus", label: "Opstartsbonus", default: false },
  { key: "referralBonus", label: "Henvisning", default: false },
] as const;

type ColKey = (typeof ALL_COLUMNS)[number]["key"];

function generatePeriods(ref: Date) {
  const periods: { start: Date; end: Date; label: string }[] = [];
  for (let offset = -3; offset <= 2; offset++) {
    const start = new Date(ref.getFullYear(), ref.getMonth() + offset, 15);
    const end = new Date(ref.getFullYear(), ref.getMonth() + offset + 1, 14);
    periods.push({
      start,
      end,
      label: `${format(start, "d. MMM", { locale: da })} - ${format(end, "d. MMM yyyy", { locale: da })}`,
    });
  }
  return periods;
}

interface ExportSalaryDialogProps {
  currentPeriodStart: Date;
}

export function ExportSalaryDialog({ currentPeriodStart }: ExportSalaryDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedCols, setSelectedCols] = useState<Set<ColKey>>(
    () => new Set(ALL_COLUMNS.filter(c => c.default).map(c => c.key))
  );
  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState<string>("");
  const [exporting, setExporting] = useState(false);

  const periods = useMemo(() => generatePeriods(currentPeriodStart), [currentPeriodStart]);

  const currentIdx = useMemo(() => {
    const refStr = currentPeriodStart.toISOString().split("T")[0];
    const idx = periods.findIndex(
      (p) => p.start.toISOString().split("T")[0] === refStr
    );
    return idx >= 0 ? String(idx) : "3";
  }, [periods, currentPeriodStart]);

  const activeIdx = selectedPeriodIdx || currentIdx;
  const activePeriod = periods[parseInt(activeIdx)];

  const { sellerData, isLoading } = useSellerSalariesCached("all", activePeriod?.start, activePeriod?.end);

  const toggleCol = (key: ColKey) => {
    setSelectedCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size <= 1) return next;
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectAll = () => setSelectedCols(new Set(ALL_COLUMNS.map(c => c.key)));
  const selectNone = () => setSelectedCols(new Set(["name"]));

  const handleExport = async () => {
    if (!sellerData || sellerData.length === 0) {
      toast.error("Ingen data at eksportere");
      return;
    }
    setExporting(true);
    try {
      const wb = new Workbook();
      const ws = wb.addWorksheet("Sælgerlønninger");

      const cols = ALL_COLUMNS.filter(c => selectedCols.has(c.key));

      // Header row
      const headerRow = ws.addRow(cols.map(c => c.label));
      headerRow.font = { bold: true };
      headerRow.eachCell((cell: any) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1a1a2e" } };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.alignment = { horizontal: "center" };
      });

      // Data rows
      for (const seller of sellerData) {
        const row: (string | number)[] = cols.map(c => {
          const val = seller[c.key as keyof typeof seller];
          return val as string | number;
        });
        ws.addRow(row);
      }

      // Total row
      const totalRow: (string | number)[] = cols.map(c => {
        if (c.key === "name") return "Total";
        if (c.key === "team") return "";
        return sellerData.reduce((sum, s) => sum + (Number(s[c.key as keyof typeof s]) || 0), 0);
      });
      const totR = ws.addRow(totalRow);
      totR.font = { bold: true };
      totR.eachCell((cell: any) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFe8e8e8" } };
      });

      // Auto column widths
      cols.forEach((_, i) => {
        ws.getColumn(i + 1).width = i <= 1 ? 25 : 16;
      });

      // Number format for currency columns
      cols.forEach((c, i) => {
        if (!["name", "team", "sickDays"].includes(c.key)) {
          ws.getColumn(i + 1).numFmt = '#,##0.00';
        }
      });

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const periodLabel = activePeriod
        ? `${format(activePeriod.start, "d-MMM", { locale: da })}_${format(activePeriod.end, "d-MMM-yyyy", { locale: da })}`
        : "export";
      a.download = `sælgerlønninger_${periodLabel}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel-fil downloadet");
    } catch (e) {
      console.error(e);
      toast.error("Fejl ved eksport");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Download className="h-3.5 w-3.5" />
          Excel-udtræk
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Eksporter sælgerlønninger</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 pt-2">
          <div className="space-y-2">
            <Label>Lønperiode</Label>
            <Select value={activeIdx} onValueChange={setSelectedPeriodIdx}>
              <SelectTrigger>
                <SelectValue placeholder="Vælg periode" />
              </SelectTrigger>
              <SelectContent>
                {periods.map((p, idx) => (
                  <SelectItem key={idx} value={String(idx)}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Kolonner</Label>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={selectAll}>
                  Alle
                </Button>
                <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={selectNone}>
                  Nulstil
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {ALL_COLUMNS.map((col) => (
                <label
                  key={col.key}
                  className="flex items-center gap-2 cursor-pointer text-sm py-1"
                >
                  <Checkbox
                    checked={selectedCols.has(col.key)}
                    onCheckedChange={() => toggleCol(col.key)}
                    disabled={col.key === "name"}
                  />
                  {col.label}
                </label>
              ))}
            </div>
          </div>

          <Button
            onClick={handleExport}
            disabled={exporting || isLoading || !sellerData?.length}
            className="w-full"
          >
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Eksporterer...
              </>
            ) : isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Indlæser data...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-1.5" />
                Download Excel ({sellerData?.length || 0} sælgere)
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
