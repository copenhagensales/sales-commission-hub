import { useState, useMemo } from "react";
import {
  useEesyFmClaimSales,
  useSetEesyFmClaimApproval,
} from "@/hooks/useEesyFmClaimSales";
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
import { VagtFlowLayout } from "@/components/vagt-flow/VagtFlowLayout";
import { cn } from "@/lib/utils";

const TABS = [
  { value: "upload", label: "Upload" },
  { value: "overview", label: "Oversigt" },
  { value: "raw", label: "Claims/Reimport" },
] as const;

const OVERVIEW_COLUMNS = [
  "Salgsdato",
  "Sælger",
  "Mobil",
  "Afvigelse",
  "Tastselv",
  "PowerBI",
  "Type",
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

function DeviationsPanel({
  title,
  description,
  columns,
  showRowActions = false,
  claimsMode = false,
}: {
  title: string;
  description: string;
  columns: readonly string[];
  showRowActions?: boolean;
  claimsMode?: boolean;
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

  const employeeOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const sale of claimSales || []) {
      if (sale.sellerId) map.set(sale.sellerId, sale.sellerName);
    }
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name, "da"),
    );
  }, [claimSales]);

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
                  const sortableKey =
                    claimsMode && col === "Salgsdato"
                      ? ("date" as const)
                      : claimsMode && col === "Sælger"
                        ? ("seller" as const)
                        : null;
                  return (
                    <TableHead
                      key={col}
                      className={col === "Notat" ? "w-full min-w-[240px]" : "whitespace-nowrap"}
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
                  <TableHead className={`${claimsMode ? "w-56" : "w-40"} whitespace-nowrap text-right`}>
                    {claimsMode ? "Handlinger" : "Ret salg"}
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {claimsMode && loadingClaims ? (
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
                    <TableCell className="whitespace-nowrap">
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
      />

    </div>
  );
}



function FileDropzone({
  label,
  dropText,
  file,
  onFile,
  onClear,
}: {
  label: string;
  dropText: string;
  file: File | null;
  onFile: (file: File) => void;
  onClear: () => void;
}) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted) => {
      if (accepted[0]) onFile(accepted[0]);
    },
    accept: XLSX_ACCEPT,
    maxFiles: 1,
  });

  if (file) {
    return (
      <div className="border-2 border-dashed rounded-lg p-8 text-center border-success/40 bg-success/5">
        <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 text-success" />
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
        <p className="text-sm font-medium truncate">{file.name}</p>
        <Button variant="ghost" size="sm" className="mt-2 h-7" onClick={onClear}>
          <X className="h-3.5 w-3.5 mr-1" /> Skift fil
        </Button>
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
          <p className="text-base mb-1">{dropText}</p>
          <p className="text-xs text-muted-foreground">eller klik for at vælge</p>
        </>
      )}
    </div>
  );
}

export default function EesyFmDeviations() {
  const [gadenCoopFile, setGadenCoopFile] = useState<File | null>(null);
  const [markedFile, setMarkedFile] = useState<File | null>(null);

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
                  Upload Excel-filer (.xlsx). Én fil for Gaden/Coop og én for Marked.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <FileDropzone
                    label="Gaden/Coop"
                    dropText="Træk og slip Gaden/Coop-fil"
                    file={gadenCoopFile}
                    onFile={setGadenCoopFile}
                    onClear={() => setGadenCoopFile(null)}
                  />
                  <FileDropzone
                    label="Marked"
                    dropText="Træk og slip Marked-fil"
                    file={markedFile}
                    onFile={setMarkedFile}
                    onClear={() => setMarkedFile(null)}
                  />
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

        </Tabs>
      </div>
    </VagtFlowLayout>
  );
}
