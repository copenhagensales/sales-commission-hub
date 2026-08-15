import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { FileSpreadsheet, Upload, X, Search, CalendarIcon } from "lucide-react";
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
  { value: "raw", label: "Rådata" },
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
  "Produkt",
  "Tastselv",
  "Type",
] as const;

const OVERVIEW_VIEWS = [
  {
    value: "deviations" as const,
    title: "Afvigelser — oversigt",
    description: "Sammenholdte salg mellem Tastselv og PowerBI med afvigelser markeret.",
    columns: OVERVIEW_COLUMNS as readonly string[],
  },
  {
    value: "missing" as const,
    title: "Mangler i PowerBI",
    description: "Salg registreret i Tastselv, som ikke er fundet i PowerBI.",
    columns: MISSING_COLUMNS as readonly string[],
  },
];

type OverviewView = (typeof OVERVIEW_VIEWS)[number]["value"];

function DeviationsPanel({
  title,
  description,
  columns,
}: {
  title: string;
  description: string;
  columns: readonly string[];
}) {
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();
  const [search, setSearch] = useState("");
  const [employee, setEmployee] = useState<string>("all");
  const [quickRange, setQuickRange] = useState<string>("custom");

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
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-lg border border-border/50 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col} className="whitespace-nowrap">
                    {col}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-16 text-center text-sm text-muted-foreground"
                >
                  Ingen data endnu.
                </TableCell>
              </TableRow>
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
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                Indhold tilføjes her.
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </VagtFlowLayout>
  );
}
