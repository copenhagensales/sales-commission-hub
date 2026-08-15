import { useState, useMemo, useEffect } from "react";
import {
  useEesyFmClaimSales,
  useSetEesyFmClaimApproval,
  useEesyFmProducts,
  useEesyFmSellers,
  useUpdateEesyFmClaimSale,
  type EesyFmClaimSale,
} from "@/hooks/useEesyFmClaimSales";
import { useEesyFmDeviations, type DeviationRow } from "@/hooks/useEesyFmDeviations";
import {
  useEesyFmPowerBiImports,
  useUploadPowerBiSheet,
  useRemovePowerBiImport,
  SHEET_LABELS,
  type PowerBiSheetType,
  type PowerBiImport,
} from "@/hooks/useEesyFmPowerBiImports";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";
import {
  FileSpreadsheet,
  Upload,
  X,
  Search,
  CalendarIcon,
  Pencil,
  Check,
  Trash2,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import {
  format,
  startOfDay,
  endOfDay,
  subDays,
  startOfWeek,
  endOfWeek,
  subWeeks,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
  endOfYear,
} from "date-fns";
import { da } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { VagtFlowLayout } from "@/components/vagt-flow/VagtFlowLayout";
import { cn } from "@/lib/utils";

const TABS = [
  { value: "upload", label: "Upload" },
  { value: "overview", label: "Oversigt" },
  { value: "raw", label: "Claims/Reimport" },
  { value: "mapping", label: "Mapping" },
] as const;

const OVERVIEW_COLUMNS = [
  "Salgsdato",
  "Sælger",
  "Mobil",
  "Afvigelse",
  "Tastselv",
  "PB Kampagne",
  "PB Operator",
  "Kilde",
] as const;

const XLSX_ACCEPT = {
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
};

function DateFilter({
  label,
  date,
  onSelect,
}: {
  label: string;
  date: Date | undefined;
  onSelect: (date: Date | undefined) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "dd/MM/yyyy", { locale: da }) : <span>Vælg dato...</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={onSelect}
            locale={da}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

const QUICK_RANGES: { value: string; label: string; range: () => { from: Date; to: Date } }[] = [
  { value: "today", label: "I dag", range: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
  {
    value: "yesterday",
    label: "I går",
    range: () => ({ from: startOfDay(subDays(new Date(), 1)), to: endOfDay(subDays(new Date(), 1)) }),
  },
  {
    value: "this-week",
    label: "Denne uge",
    range: () => ({
      from: startOfWeek(new Date(), { weekStartsOn: 1 }),
      to: endOfWeek(new Date(), { weekStartsOn: 1 }),
    }),
  },
  {
    value: "last-week",
    label: "Sidste uge",
    range: () => ({
      from: startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }),
      to: endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }),
    }),
  },
  {
    value: "this-month",
    label: "Denne måned",
    range: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }),
  },
  {
    value: "last-month",
    label: "Sidste måned",
    range: () => ({
      from: startOfMonth(subMonths(new Date(), 1)),
      to: endOfMonth(subMonths(new Date(), 1)),
    }),
  },
  {
    value: "this-year",
    label: "I år",
    range: () => ({ from: startOfYear(new Date()), to: endOfYear(new Date()) }),
  },
];

const MISSING_COLUMNS = [
  "Salgsdato",
  "Sælger",
  "Mobil",
  "Tastselv",
] as const;

const CLAIMS_COLUMNS = [
  "Salgsdato",
  "Sælger",
  "Mobil",
  "Tastselv",
  "Notat",
  "Status",
] as const;


const OVERVIEW_VIEWS = [
  {
    value: "deviations" as const,
    title: "Afvigelser — oversigt",
    description: "Sammenholdte salg mellem Tastselv og PowerBI med afvigelser markeret.",
    columns: OVERVIEW_COLUMNS as readonly string[],
    showRowActions: false,
  },
  {
    value: "missing" as const,
    title: "Mangler i PowerBI",
    description: "Salg registreret i Tastselv, som ikke er fundet i PowerBI.",
    columns: MISSING_COLUMNS as readonly string[],
    showRowActions: true,
  },
];

type OverviewView = (typeof OVERVIEW_VIEWS)[number]["value"];

function ClaimEditDialog({
  sale,
  onOpenChange,
  claimMode = "remove",
}: {
  sale: EesyFmClaimSale | null;
  onOpenChange: (open: boolean) => void;
  claimMode?: "remove" | "add";
}) {
  const { data: products } = useEesyFmProducts();
  const { data: sellers } = useEesyFmSellers();
  const updateSale = useUpdateEesyFmClaimSale();

  const [productName, setProductName] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [sellerQuery, setSellerQuery] = useState("");
  const [sellerOpen, setSellerOpen] = useState(false);
  const [saleDatetime, setSaleDatetime] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [removeClaim, setRemoveClaim] = useState(false);

  useEffect(() => {
    if (!sale) return;
    setProductName(sale.productName || "");
    setSellerId(sale.sellerId || "");
    setSellerQuery(sale.sellerName || "");
    setSellerOpen(false);
    setSaleDatetime(format(new Date(sale.saleDatetime), "yyyy-MM-dd'T'HH:mm"));
    setPhone(sale.phone || "");
    setNote(sale.note || "");
    setRemoveClaim(false);
  }, [sale]);

  const normalize = (v: string) =>
    v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  const sellerSuggestions = useMemo(() => {
    const q = normalize(sellerQuery);
    if (q.length < 3) return [];
    const list = sellers || [];
    const firstNameMatches = list.filter((s) => normalize(s.name).startsWith(q));
    const otherNameMatches = list.filter(
      (s) =>
        !firstNameMatches.includes(s) &&
        normalize(s.name)
          .split(/\s+/)
          .some((part) => part.startsWith(q)),
    );
    return [...firstNameMatches, ...otherNameMatches].slice(0, 20);
  }, [sellerQuery, sellers]);

  const selectedSeller = (sellers || []).find((s) => s.id === sellerId);


  const handleSave = () => {
    if (!sale) return;
    if (!productName) {
      toast.error("Vælg et produkt");
      return;
    }
    if (!sellerId) {
      toast.error("Vælg en sælger fra søgeforslagene");
      return;
    }
    if (!saleDatetime) {
      toast.error("Angiv en dato");
      return;
    }
    updateSale.mutate(
      {
        saleId: sale.id,
        productName,
        sellerId,
        saleDatetime: new Date(saleDatetime).toISOString(),
        phone: phone.trim() || null,
        note: note.trim() || null,
        keepClaim: claimMode === "add" ? removeClaim : !removeClaim,
      },
      {
        onSuccess: () => {
          toast.success("Salget er opdateret");
          onOpenChange(false);
        },
        onError: (err: any) =>
          toast.error(err?.message || "Kunne ikke opdatere salget"),
      },
    );
  };

  return (
    <Dialog open={!!sale} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ret salgsregistrering</DialogTitle>
          <DialogDescription>
            Ændringer gemmes på salget og slår igennem i hele Stork.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Produkt</Label>
            <Select value={productName} onValueChange={setProductName}>
              <SelectTrigger>
                <SelectValue placeholder="Vælg produkt" />
              </SelectTrigger>
              <SelectContent>
                {(products || []).map((p) => (
                  <SelectItem key={p.id} value={p.name}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Sælger</Label>
            <div className="relative">
              <Input
                value={sellerQuery}
                placeholder="Søg sælger (min. 3 tegn)"
                autoComplete="off"
                onChange={(e) => {
                  setSellerQuery(e.target.value);
                  setSellerOpen(true);
                  if (selectedSeller && e.target.value !== selectedSeller.name) {
                    setSellerId("");
                  }
                }}
                onFocus={() => setSellerOpen(true)}
                onBlur={() => setTimeout(() => setSellerOpen(false), 120)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && sellerSuggestions.length > 0) {
                    e.preventDefault();
                    const first = sellerSuggestions[0];
                    setSellerId(first.id);
                    setSellerQuery(first.name);
                    setSellerOpen(false);
                  }
                  if (e.key === "Escape") setSellerOpen(false);
                }}
              />
              {sellerOpen && sellerQuery.trim().length >= 3 && (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-56 overflow-y-auto">
                  {sellerSuggestions.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Ingen sælgere fundet
                    </div>
                  ) : (
                    sellerSuggestions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setSellerId(s.id);
                          setSellerQuery(s.name);
                          setSellerOpen(false);
                        }}
                      >
                        {s.name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {selectedSeller ? (
              <p className="text-xs text-muted-foreground">
                Valgt: {selectedSeller.name}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Ingen sælger valgt — vælg et forslag fra listen.
              </p>
            )}
          </div>


          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Dato og tid</Label>
              <Input
                type="datetime-local"
                value={saleDatetime}
                onChange={(e) => setSaleDatetime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Mobil/telefonnummer</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="12345678"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notat/kommentar</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Kommentar til salget"
            />
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-border/50 p-3">
            <Checkbox
              id="remove-claim"
              checked={removeClaim}
              onCheckedChange={(v) => setRemoveClaim(v === true)}
            />
            <div className="space-y-0.5">
              <Label htmlFor="remove-claim" className="cursor-pointer">
                {claimMode === "add"
                  ? "Marker som Claim/Reimport"
                  : "Fjern Claim/Reimport-registrering"}
              </Label>
              <p className="text-xs text-muted-foreground">
                {claimMode === "add"
                  ? "Salget markeres og vises på fanen Claims/Reimport."
                  : "Salget bevares, men fjernes fra denne liste."}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuller
          </Button>
          <Button onClick={handleSave} disabled={updateSale.isPending}>
            {updateSale.isPending ? "Gemmer..." : "Gem ændringer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function deviationRowToClaimSale(row: DeviationRow): EesyFmClaimSale {
  return {
    id: row.id,
    saleDatetime: row.saleDatetime,
    sellerId: row.sellerId,
    sellerName: row.sellerName,
    phone: row.phone,
    productName: row.storkProduct,
    note: row.note,
    approved: false,
    approvedAt: null,
    approvedByName: null,
  };
}

function DeviationsPanel({
  title,
  description,
  columns,
  showRowActions = false,
  claimsMode = false,
  deviationMode,
}: {
  title: string;
  description: string;
  columns: readonly string[];
  showRowActions?: boolean;
  claimsMode?: boolean;
  deviationMode?: "deviations" | "missing";
}) {
  const [fromDate, setFromDate] = useState<Date | undefined>(
    claimsMode ? startOfMonth(new Date()) : undefined,
  );
  const [toDate, setToDate] = useState<Date | undefined>(
    claimsMode ? endOfMonth(new Date()) : undefined,
  );
  const [search, setSearch] = useState("");
  const [employee, setEmployee] = useState<string>("all");
  const [quickRange, setQuickRange] = useState<string>(claimsMode ? "this-month" : "custom");
  const [sortKey, setSortKey] = useState<"date" | "seller">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved">("all");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const setApproval = useSetEesyFmClaimApproval();
  const [editSale, setEditSale] = useState<EesyFmClaimSale | null>(null);

  const handleApproval = (saleId: string, approved: boolean) => {
    setPendingId(saleId);
    setApproval.mutate(
      { saleId, approved },
      {
        onSuccess: () =>
          toast.success(approved ? "Salget er godkendt" : "Godkendelse fortrudt"),
        onError: (err: any) =>
          toast.error(err?.message || "Kunne ikke opdatere godkendelse"),
        onSettled: () => setPendingId(null),
      },
    );
  };


  const { data: claimSales, isLoading: loadingClaims } = useEesyFmClaimSales(
    fromDate,
    toDate,
    claimsMode,
  );

  const {
    rows: rawDeviationRows,
    isLoading: loadingDeviations,
    hasImports,
  } = useEesyFmDeviations(deviationMode || "missing", fromDate, toDate, !!deviationMode);

  const employeeOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const sale of claimSales || []) {
      if (sale.sellerId) map.set(sale.sellerId, sale.sellerName);
    }
    for (const row of rawDeviationRows) {
      if (row.sellerId) map.set(row.sellerId, row.sellerName);
    }
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name, "da"),
    );
  }, [claimSales, rawDeviationRows]);

  const deviationRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = rawDeviationRows.filter((row) => {
      if (employee !== "all" && row.sellerId !== employee) return false;
      if (!term) return true;
      return [
        row.sellerName,
        row.phone,
        row.storkProduct,
        row.powerBiProduct,
        row.powerBiCampaign,
        row.powerBiOperator,
        row.sheetLabel,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "seller") {
        return dir * (a.sellerName || "").localeCompare(b.sellerName || "", "da");
      }
      return dir * (new Date(a.saleDatetime).getTime() - new Date(b.saleDatetime).getTime());
    });
  }, [rawDeviationRows, search, employee, sortKey, sortDir]);


  const claimRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = (claimSales || []).filter((sale) => {
      if (employee !== "all" && sale.sellerId !== employee) return false;
      if (statusFilter === "approved" && !sale.approved) return false;
      if (statusFilter === "pending" && sale.approved) return false;
      if (!term) return true;
      return [sale.sellerName, sale.phone, sale.productName, sale.note]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "seller") {
        return dir * (a.sellerName || "").localeCompare(b.sellerName || "", "da");
      }
      return (
        dir * (new Date(a.saleDatetime).getTime() - new Date(b.saleDatetime).getTime())
      );
    });
  }, [claimSales, search, employee, statusFilter, sortKey, sortDir]);


  const toggleSort = (key: "date" | "seller") => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "asc");
    }
  };

  const handleQuickRange = (value: string) => {
    setQuickRange(value);
    const preset = QUICK_RANGES.find((r) => r.value === value);
    if (preset) {
      const { from, to } = preset.range();
      setFromDate(from);
      setToDate(to);
    }
  };


  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Hurtig valg</label>
            <Select value={quickRange} onValueChange={handleQuickRange}>
              <SelectTrigger>
                <SelectValue placeholder="Vælg periode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Brugerdefineret</SelectItem>
                {QUICK_RANGES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DateFilter
            label="Fra dato"
            date={fromDate}
            onSelect={(d) => {
              setFromDate(d);
              setQuickRange("custom");
            }}
          />
          <DateFilter
            label="Til dato"
            date={toDate}
            onSelect={(d) => {
              setToDate(d);
              setQuickRange("custom");
            }}
          />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Søg (alle felter)</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Søg..."
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Vælg medarbejder</label>
            <Select value={employee} onValueChange={setEmployee}>
              <SelectTrigger>
                <SelectValue placeholder="Alle medarbejdere" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle medarbejdere</SelectItem>
                {employeeOptions.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {opt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {claimsMode && (
          <div className="flex flex-wrap items-center gap-2">
            {[
              { value: "all" as const, label: "Alle" },
              { value: "pending" as const, label: "Afventer" },
              { value: "approved" as const, label: "Godkendt" },
            ].map((opt) => (
              <Button
                key={opt.value}
                size="sm"
                variant={statusFilter === opt.value ? "default" : "outline"}
                className="h-8 rounded-full"
                onClick={() => setStatusFilter(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        )}



        <div className="rounded-lg border border-border/50 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => {
                  const sortable = claimsMode || !!deviationMode;
                  const sortableKey =
                    sortable && col === "Salgsdato"
                      ? ("date" as const)
                      : sortable && col === "Sælger"
                        ? ("seller" as const)
                        : null;
                  return (
                    <TableHead
                      key={col}
                      className={
                        col === "Notat"
                          ? "w-full min-w-[240px]"
                          : col === "Status"
                            ? "w-[260px] min-w-[260px] whitespace-nowrap"
                            : "whitespace-nowrap"
                      }
                    >
                      {sortableKey ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(sortableKey)}
                          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                        >
                          {col}
                          {sortKey === sortableKey ? (
                            sortDir === "asc" ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 opacity-30" />
                          )}
                        </button>
                      ) : (
                        col
                      )}
                    </TableHead>
                  );
                })}
                {showRowActions && (
                  <TableHead
                    className={`${claimsMode ? "w-56" : deviationMode === "missing" ? "w-44" : "w-40"} whitespace-nowrap text-right`}
                  >
                    {claimsMode || deviationMode === "missing" ? "Handlinger" : "Ret salg"}
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {deviationMode ? (
                loadingDeviations ? (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length + (showRowActions ? 1 : 0)}
                      className="py-16 text-center text-sm text-muted-foreground"
                    >
                      Sammenholder salg...
                    </TableCell>
                  </TableRow>
                ) : deviationRows.length > 0 ? (
                  deviationRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(row.saleDatetime), "dd/MM/yyyy HH:mm", { locale: da })}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{row.sellerName}</TableCell>
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        {row.phone || "-"}
                      </TableCell>
                      {deviationMode === "deviations" && (
                        <TableCell className="whitespace-nowrap">
                          <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-500">
                            {row.deviation}
                          </span>
                        </TableCell>
                      )}
                      <TableCell className="min-w-[200px]">{row.storkProduct || "-"}</TableCell>
                      {deviationMode === "deviations" && (
                        <>
                          <TableCell className="min-w-[180px]">
                            {row.powerBiCampaign || "-"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {row.powerBiOperator || "-"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {row.sheetLabel || "-"}
                          </TableCell>
                        </>
                      )}
                      {showRowActions && (
                        <TableCell className="w-44 whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditSale(deviationRowToClaimSale(row))}
                              className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Rediger
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Slet
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>

                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length + (showRowActions ? 1 : 0)}
                      className="py-16 text-center text-sm text-muted-foreground"
                    >
                      {hasImports
                        ? "Ingen afvigelser i den valgte periode."
                        : "Upload et PowerBI-ark under fanen Upload for at sammenligne."}
                    </TableCell>
                  </TableRow>
                )
              ) : claimsMode && loadingClaims ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length + (showRowActions ? 1 : 0)}
                    className="py-16 text-center text-sm text-muted-foreground"
                  >
                    Henter salg...
                  </TableCell>
                </TableRow>
              ) : claimsMode && claimRows.length > 0 ? (
                claimRows.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(sale.saleDatetime), "dd/MM/yyyy HH:mm", { locale: da })}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{sale.sellerName}</TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      {sale.phone || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{sale.productName || "-"}</TableCell>
                    <TableCell className="min-w-[240px] text-muted-foreground">
                      {sale.note || "-"}
                    </TableCell>
                    <TableCell className="w-[260px] min-w-[260px] whitespace-nowrap">
                      {sale.approved ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-500">
                          <Check className="h-3 w-3" />
                          Godkendt
                          {sale.approvedAt
                            ? ` · ${format(new Date(sale.approvedAt), "dd/MM", { locale: da })}`
                            : ""}
                          {sale.approvedByName ? ` · ${sale.approvedByName}` : ""}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                          Afventer
                        </span>
                      )}
                    </TableCell>
                    {showRowActions && (
                      <TableCell className="w-56 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {sale.approved ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={pendingId === sale.id}
                              onClick={() => handleApproval(sale.id, false)}
                              className="h-8 gap-1.5"
                            >
                              Fortryd
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              disabled={pendingId === sale.id}
                              onClick={() => handleApproval(sale.id, true)}
                              className="h-8 gap-1.5 bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Godkend
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditSale(sale)}
                            className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Rediger
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Slet
                          </Button>
                        </div>
                      </TableCell>
                    )}


                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length + (showRowActions ? 1 : 0)}
                    className="py-16 text-center text-sm text-muted-foreground"
                  >
                    Ingen data endnu.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <ClaimEditDialog
          claimMode={deviationMode === "missing" ? "add" : "remove"}
          sale={editSale}
          onOpenChange={(open) => {
            if (!open) setEditSale(null);
          }}
        />
      </CardContent>
    </Card>
  );
}

function OverviewTab() {
  const [view, setView] = useState<OverviewView>("deviations");
  const active = OVERVIEW_VIEWS.find((v) => v.value === view)!;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {OVERVIEW_VIEWS.map((v) => {
          const isActive = v.value === view;
          return (
            <button key={v.value} type="button" onClick={() => setView(v.value)} className="text-left">
              <Card
                className={cn(
                  "h-full transition-colors backdrop-blur-sm",
                  isActive
                    ? "border-primary bg-primary/10"
                    : "border-border/50 bg-card/50 hover:border-primary/50",
                )}
              >
                <CardHeader>
                  <CardTitle className="text-base">{v.title}</CardTitle>
                  <CardDescription>{v.description}</CardDescription>
                </CardHeader>
              </Card>
            </button>
          );
        })}
      </div>

      <DeviationsPanel
        key={active.value}
        title={active.title}
        description={active.description}
        columns={active.columns}
        showRowActions={active.showRowActions}
        deviationMode={active.value}
      />


    </div>
  );
}



function PowerBiDropzone({
  sheetType,
  existing,
}: {
  sheetType: PowerBiSheetType;
  existing?: PowerBiImport;
}) {
  const label = SHEET_LABELS[sheetType];
  const upload = useUploadPowerBiSheet();
  const remove = useRemovePowerBiImport();

  const handleFile = (file: File) => {
    upload.mutate(
      { file, sheetType },
      {
        onSuccess: (res) =>
          toast.success(`${label}: ${res.rowCount} rækker indlæst`),
        onError: (err: any) =>
          toast.error(err?.message || "Kunne ikke indlæse arket"),
      },
    );
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted) => {
      if (accepted[0]) handleFile(accepted[0]);
    },
    accept: XLSX_ACCEPT,
    maxFiles: 1,
    disabled: upload.isPending,
  });

  const replaceInput = (
    <input
      type="file"
      accept=".xlsx"
      className="hidden"
      id={`replace-${sheetType}`}
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
        e.target.value = "";
      }}
    />
  );

  if (upload.isPending) {
    return (
      <div className="border-2 border-dashed rounded-lg p-8 text-center border-primary/40 bg-primary/5">
        <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 text-primary animate-pulse" />
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
        <p className="text-sm font-medium">Indlæser ark...</p>
      </div>
    );
  }

  if (existing) {
    const period =
      existing.periodFrom && existing.periodTo
        ? `${format(new Date(existing.periodFrom), "dd/MM/yyyy", { locale: da })} – ${format(
            new Date(existing.periodTo),
            "dd/MM/yyyy",
            { locale: da },
          )}`
        : "Ukendt periode";
    return (
      <div className="border-2 border-dashed rounded-lg p-8 text-center border-success/40 bg-success/5">
        <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 text-success" />
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
        <p className="text-sm font-medium truncate">{existing.fileName}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {existing.rowCount} rækker · {period}
        </p>
        <p className="text-xs text-muted-foreground">
          Uploadet {format(new Date(existing.createdAt), "dd/MM/yyyy HH:mm", { locale: da })}
        </p>
        <div className="mt-2 flex items-center justify-center gap-1">
          {replaceInput}
          <Button
            variant="ghost"
            size="sm"
            className="h-7"
            onClick={() => document.getElementById(`replace-${sheetType}`)?.click()}
          >
            <Upload className="h-3.5 w-3.5 mr-1" /> Skift fil
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(existing, {
                onSuccess: () => toast.success(`${label}-arket er fjernet`),
                onError: (err: any) =>
                  toast.error(err?.message || "Kunne ikke fjerne arket"),
              })
            }
          >
            <X className="h-3.5 w-3.5 mr-1" /> Fjern
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
        isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
      }`}
    >
      <input {...getInputProps()} />
      <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
      {isDragActive ? (
        <p className="text-base">Slip filen her...</p>
      ) : (
        <>
          <p className="text-base mb-1">Træk og slip {label}-fil</p>
          <p className="text-xs text-muted-foreground">eller klik for at vælge</p>
        </>
      )}
    </div>
  );
}

export default function EesyFmDeviations() {
  const { data: imports } = useEesyFmPowerBiImports();
  const findImport = (type: PowerBiSheetType) =>
    (imports || []).find((i) => i.sheetType === type);

  return (
    <VagtFlowLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Afstem automatisk salg</h1>
          <p className="text-muted-foreground">
            Afvigelser på Eesy FM — upload, overblik og rådata
          </p>
        </div>

        <Tabs defaultValue="upload" className="space-y-4">
          <TabsList>
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="upload">
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Upload className="h-5 w-5" />
                  Upload kurv-fil
                </CardTitle>
                <CardDescription>
                  Upload Excel-filer (.xlsx). Én fil for Gaden/Coop og én for Marked. Arkene
                  forbliver indlæst indtil de fjernes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <PowerBiDropzone sheetType="gaden_coop" existing={findImport("gaden_coop")} />
                  <PowerBiDropzone sheetType="marked" existing={findImport("marked")} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="overview">
            <OverviewTab />
          </TabsContent>

          <TabsContent value="raw">
            <DeviationsPanel
              title="Claims/Reimport"
              description="Salg klar til claim eller reimport — med notat pr. salg."
              columns={CLAIMS_COLUMNS as readonly string[]}
              showRowActions
              claimsMode
            />
          </TabsContent>

          <TabsContent value="mapping">
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-xl">Mapping</CardTitle>
                <CardDescription>Indhold tilføjes senere.</CardDescription>
              </CardHeader>
            </Card>
          </TabsContent>


        </Tabs>
      </div>
    </VagtFlowLayout>
  );
}
