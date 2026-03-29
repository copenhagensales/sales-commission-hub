import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { extractOpp } from "./utils/extractOpp";
import { groupConditionsByProduct, findMatchingProductId, evaluateConditions } from "@/utils/productConditionMatcher";
import { formatCurrency } from "@/lib/calculations/formatting";
import { useAgentNameResolver } from "@/hooks/useAgentNameResolver";
import { useDropzone } from "react-dropzone";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseExcelFile } from "@/utils/excel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, Check, X, Loader2, AlertCircle, Save, Settings, ArrowLeft, ArrowRight, Ban, ShoppingCart, Pencil, Plus, Trash2, Layers } from "lucide-react";
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
import { CancellationHistoryTable } from "./CancellationHistoryTable";
import { useAuth } from "@/hooks/useAuth";

interface ParsedRow {
  phone?: string;
  company?: string;
  originalRow: Record<string, unknown>;
  originalIndex: number;
}

interface MatchedSale {
  saleId: string;
  phone: string;
  company: string;
  oppNumber: string;
  saleDate: string;
  employee: string;
  currentStatus: string;
  uploadedRowData: Record<string, unknown>;
  targetProductName?: string;
  realProductName?: string;
  commission?: number;
  revenue?: number;
  matchConfidence?: "high" | "medium";
}

interface ProductPhoneMapping {
  phoneColumn?: string;
  payloadPhoneField?: string;
  productName: string;
}

interface FallbackProductMapping {
  excelProductPattern: string;
  saleItemTitle: string;
}

interface UploadConfig {
  id: string;
  client_id: string;
  name: string;
  phone_column: string | null;
  company_column: string | null;
  opp_column: string | null;
  member_number_column: string | null;
  product_columns: string[];
  revenue_column: string | null;
  commission_column: string | null;
  product_match_mode: string;
  is_default: boolean;
  filter_column: string | null;
  filter_value: string | null;
  product_phone_mappings?: ProductPhoneMapping[];
  seller_column?: string | null;
  date_column?: string | null;
  fallback_product_mappings?: FallbackProductMapping[];
  skip_empty_row_filter?: boolean;
  type_detection_column?: string | null;
  type_detection_values?: string[] | null;
  phone_excluded_products?: string[] | null;
}

interface UnmatchedSellerRow {
  rowIndex: number;
  excelSellerName: string;
  excelDate: string;
  excelProduct: string;
  originalRow: Record<string, unknown>;
}

interface UploadCancellationsTabProps {
  clientId: string;
}

function getCaseInsensitive(obj: Record<string, unknown> | undefined, key: string): unknown {
  if (!obj) return undefined;
  // Exact case-insensitive match first
  const lowerKey = key.toLowerCase();
  for (const k of Object.keys(obj)) {
    if (k.toLowerCase() === lowerKey) return obj[k];
  }
  // Fuzzy: ignore hyphens, spaces, dots
  const normalize = (s: string) => s.toLowerCase().replace(/[-\s.]/g, "");
  const normKey = normalize(key);
  for (const k of Object.keys(obj)) {
    if (normalize(k) === normKey) return obj[k];
  }
  return undefined;
}

/** Normalize phone: strip non-digits + remove Danish country code prefix */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0045")) return digits.slice(4);
  if (digits.startsWith("45") && digits.length === 10) return digits.slice(2);
  return digits;
}

type WizardStep = "type" | "upload" | "preview" | "done";

const WIZARD_STEPS = [
  { key: "type" as const, label: "Vælg type", number: 1 },
  { key: "upload" as const, label: "Upload fil", number: 2 },
  { key: "preview" as const, label: "Forhåndsvisning", number: 3 },
  { key: "done" as const, label: "Sendt", number: 4 },
];

function StepIndicator({ currentStep }: { currentStep: WizardStep }) {
  const currentIdx = WIZARD_STEPS.findIndex(s => s.key === currentStep);

  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {WIZARD_STEPS.map((step, idx) => {
        const isActive = idx === currentIdx;
        const isDone = idx < currentIdx;
        return (
          <div key={step.key} className="flex items-center gap-2">
            {idx > 0 && (
              <div className={`h-px w-8 ${isDone ? "bg-primary" : "bg-border"}`} />
            )}
            <div className="flex items-center gap-1.5">
              <div
                className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors
                  ${isDone ? "bg-primary text-primary-foreground" : isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : step.number}
              </div>
              <span className={`text-sm hidden sm:inline ${isActive ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Inline config creation form for clients without a saved config
function ConfigCreationForm({ clientId, columns: parentColumns, setColumns: setParentColumns, onConfigSaved }: {
  clientId: string;
  columns: string[];
  setColumns: (cols: string[]) => void;
  onConfigSaved: () => void;
}) {
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [sampleColumns, setSampleColumns] = useState<string[]>([]);
  const [sampleData, setSampleData] = useState<Record<string, unknown>[]>([]);
  const [cfgName, setCfgName] = useState("");
  const [cfgPhone, setCfgPhone] = useState("__none__");
  const [cfgOpp, setCfgOpp] = useState("__none__");
  const [cfgMemberNr, setCfgMemberNr] = useState("__none__");
  const [cfgCompany, setCfgCompany] = useState("__none__");
  const [cfgFilterCol, setCfgFilterCol] = useState("__none__");
  const [cfgFilterVal, setCfgFilterVal] = useState("");
  const [cfgProductCol, setCfgProductCol] = useState("__none__");
  const [cfgSkipEmptyFilter, setCfgSkipEmptyFilter] = useState(false);
  const [cfgTypeDetCol, setCfgTypeDetCol] = useState("__none__");
  const [cfgTypeDetVals, setCfgTypeDetVals] = useState("");
  const [cfgPhoneExcluded, setCfgPhoneExcluded] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredCount = (cfgFilterCol !== "__none__" && cfgFilterVal.trim())
    ? sampleData.filter(row => String(row[cfgFilterCol] ?? "").trim() === cfgFilterVal.trim()).length
    : sampleData.length;

  const onSampleDrop = useCallback((files: File[]) => {
    const f = files[0];
    if (!f) return;
    setSampleFile(f);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const { rows, columns: cols } = await parseExcelFile(buffer, { defval: "" });
        setSampleColumns(cols);
        setSampleData(rows);
        setParentColumns(cols);
      } catch {
        toast({ title: "Fejl", description: "Kunne ikke læse filen.", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(f);
  }, []);

  const { getRootProps: getSampleRootProps, getInputProps: getSampleInputProps, isDragActive: isSampleDragActive } = useDropzone({
    onDrop: onSampleDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
  });

  const handleSave = async () => {
    if (!cfgName.trim()) {
      toast({ title: "Angiv navn", description: "Opsætningen skal have et navn.", variant: "destructive" });
      return;
    }
    if (cfgPhone === "__none__" && cfgOpp === "__none__" && cfgMemberNr === "__none__") {
      toast({ title: "Vælg kolonne", description: "Vælg mindst én match-kolonne.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("cancellation_upload_configs").insert({
        client_id: clientId,
        name: cfgName.trim(),
        phone_column: cfgPhone !== "__none__" ? cfgPhone : null,
        company_column: cfgCompany !== "__none__" ? cfgCompany : null,
        opp_column: cfgOpp !== "__none__" ? cfgOpp : null,
        member_number_column: cfgMemberNr !== "__none__" ? cfgMemberNr : null,
        product_columns: cfgProductCol !== "__none__" ? [cfgProductCol] : [],
        product_match_mode: "strip_percent_suffix",
        is_default: true,
        filter_column: cfgFilterCol !== "__none__" ? cfgFilterCol : null,
        filter_value: cfgFilterVal.trim() || null,
        skip_empty_row_filter: cfgSkipEmptyFilter,
        type_detection_column: cfgTypeDetCol !== "__none__" ? cfgTypeDetCol : null,
        type_detection_values: cfgTypeDetVals.trim() ? cfgTypeDetVals.split(",").map(v => v.trim()).filter(Boolean) : null,
        phone_excluded_products: cfgPhoneExcluded.trim() ? cfgPhoneExcluded.split(",").map(v => v.trim()).filter(Boolean) : null,
      } as any);
      if (error) throw error;
      toast({ title: "Gemt!", description: `Opsætning "${cfgName}" oprettet.` });
      onConfigSaved();
    } catch (err: any) {
      toast({ title: "Fejl", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const colSelect = (label: string, value: string, onChange: (v: string) => void) => (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Vælg kolonne" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">– Ingen –</SelectItem>
          {sampleColumns.map(col => <SelectItem key={col} value={col}>{col}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Plus className="h-4 w-4" />
        <span className="font-medium text-foreground">Opret opsætning for denne kunde</span>
      </div>

      {!sampleFile ? (
        <div
          {...getSampleRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
            ${isSampleDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}`}
        >
          <input {...getSampleInputProps()} />
          <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm mb-1">Upload en eksempelfil for at hente kolonnenavne</p>
          <p className="text-xs text-muted-foreground">Excel (.xlsx / .xls)</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50 border text-sm">
            <FileSpreadsheet className="h-5 w-5 text-primary shrink-0" />
            <span className="truncate">{sampleFile.name}</span>
            <Badge variant="secondary">{sampleData.length} rækker</Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {colSelect("Telefonkolonne", cfgPhone, setCfgPhone)}
            {colSelect("OPP-kolonne", cfgOpp, setCfgOpp)}
            {colSelect("Medlemsnummer", cfgMemberNr, setCfgMemberNr)}
            {colSelect("Virksomhed", cfgCompany, setCfgCompany)}
            {colSelect("Produktkolonne", cfgProductCol, setCfgProductCol)}
          </div>

          <div className="border-t pt-3 space-y-3">
            <Label className="text-sm font-medium">Filter rækker (valgfri)</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {colSelect("Filterkolonne", cfgFilterCol, setCfgFilterCol)}
              <div className="space-y-1.5">
                <Label className="text-sm">Filterværdi</Label>
                <Input
                  value={cfgFilterVal}
                  onChange={(e) => setCfgFilterVal(e.target.value)}
                  placeholder="f.eks. 1"
                />
              </div>
            </div>
            {cfgFilterCol !== "__none__" && cfgFilterVal.trim() && (
              <Badge variant="secondary">
                {filteredCount} af {sampleData.length} rækker inkluderet
              </Badge>
            )}
          </div>

          <div className="border-t pt-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm">Behold rækker uden telefonnummer</Label>
                <p className="text-xs text-muted-foreground">Slå til hvis filen indeholder rækker uden telefon/OPP som stadig er reelle data</p>
              </div>
              <Switch checked={cfgSkipEmptyFilter} onCheckedChange={setCfgSkipEmptyFilter} />
            </div>
          </div>

          <div className="border-t pt-3 space-y-3">
            <Label className="text-sm font-medium">Type-detektering (Begge-upload)</Label>
            <p className="text-xs text-muted-foreground">Vælg kolonne og værdier der indikerer at en række er en annullering (resten bliver kurvrettelse)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {colSelect("Type-kolonne", cfgTypeDetCol, setCfgTypeDetCol)}
              <div className="space-y-1.5">
                <Label className="text-sm">Annulleringsværdier</Label>
                <Input
                  value={cfgTypeDetVals}
                  onChange={(e) => setCfgTypeDetVals(e.target.value)}
                  placeholder="f.eks. Nedlagt, Annulleret"
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-3 space-y-3">
            <Label className="text-sm font-medium">Produkter uden telefon-match</Label>
            <p className="text-xs text-muted-foreground">Produkter der skal skippe telefon-matching og i stedet matches via sælger+dato+produkt (komma-separeret)</p>
            <Input
              value={cfgPhoneExcluded}
              onChange={(e) => setCfgPhoneExcluded(e.target.value)}
              placeholder="f.eks. 5G Internet, 5G Router"
            />
          </div>

          <div className="border-t pt-3 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Opsætningsnavn</Label>
              <Input
                value={cfgName}
                onChange={(e) => setCfgName(e.target.value)}
                placeholder="f.eks. Eesy TM Standard"
              />
            </div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Gem opsætning
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// Edit config dialog
function EditConfigDialog({ open, onOpenChange, config, onSaved }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: UploadConfig;
  onSaved: () => void;
}) {
  const [cfgPhone, setCfgPhone] = useState(config.phone_column || "__none__");
  const [cfgOpp, setCfgOpp] = useState(config.opp_column || "__none__");
  const [cfgMemberNr, setCfgMemberNr] = useState(config.member_number_column || "__none__");
  const [cfgCompany, setCfgCompany] = useState(config.company_column || "__none__");
  const [cfgFilterCol, setCfgFilterCol] = useState(config.filter_column || "__none__");
  const [cfgFilterVal, setCfgFilterVal] = useState(config.filter_value || "");
  const [cfgProductCol, setCfgProductCol] = useState(config.product_columns?.[0] || "__none__");
  const [cfgName, setCfgName] = useState(config.name);
  const [cfgSkipEmptyFilter, setCfgSkipEmptyFilter] = useState(config.skip_empty_row_filter ?? false);
  const [cfgTypeDetectionCol, setCfgTypeDetectionCol] = useState(config.type_detection_column || "__none__");
  const [cfgTypeDetectionVals, setCfgTypeDetectionVals] = useState((config.type_detection_values || []).join(", "));
  const [cfgPhoneExcluded, setCfgPhoneExcluded] = useState(((config as any).phone_excluded_products || []).join(", "));
  const [saving, setSaving] = useState(false);

  // We don't have file columns in edit mode, so we use known column names from config
  const knownCols = Array.from(new Set([
    config.phone_column, config.opp_column, config.member_number_column,
    config.company_column, config.filter_column, config.revenue_column,
    config.commission_column, config.type_detection_column, ...(config.product_columns || []),
  ].filter(Boolean) as string[]));

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("cancellation_upload_configs")
        .update({
          name: cfgName.trim(),
          phone_column: cfgPhone !== "__none__" ? cfgPhone : null,
          company_column: cfgCompany !== "__none__" ? cfgCompany : null,
          opp_column: cfgOpp !== "__none__" ? cfgOpp : null,
          member_number_column: cfgMemberNr !== "__none__" ? cfgMemberNr : null,
          filter_column: cfgFilterCol !== "__none__" ? cfgFilterCol : null,
          filter_value: cfgFilterVal.trim() || null,
          product_columns: cfgProductCol !== "__none__" ? [cfgProductCol] : [],
          skip_empty_row_filter: cfgSkipEmptyFilter,
          type_detection_column: cfgTypeDetectionCol !== "__none__" ? cfgTypeDetectionCol : null,
          type_detection_values: cfgTypeDetectionVals.trim() ? cfgTypeDetectionVals.split(",").map(v => v.trim()).filter(Boolean) : null,
          phone_excluded_products: cfgPhoneExcluded.trim() ? cfgPhoneExcluded.split(",").map(v => v.trim()).filter(Boolean) : null,
        } as any)
        .eq("id", config.id);
      if (error) throw error;
      toast({ title: "Opdateret", description: `Opsætning "${cfgName}" er gemt.` });
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Fejl", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const colSelect = (label: string, value: string, onChange: (v: string) => void) => (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">– Ingen –</SelectItem>
          {knownCols.map(col => <SelectItem key={col} value={col}>{col}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rediger opsætning</DialogTitle>
          <DialogDescription>Opdater kolonne-mapping og filter for denne opsætning.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Navn</Label>
            <Input value={cfgName} onChange={(e) => setCfgName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {colSelect("Telefon", cfgPhone, setCfgPhone)}
            {colSelect("OPP", cfgOpp, setCfgOpp)}
            {colSelect("Medlemsnr.", cfgMemberNr, setCfgMemberNr)}
            {colSelect("Virksomhed", cfgCompany, setCfgCompany)}
            {colSelect("Produktkolonne", cfgProductCol, setCfgProductCol)}
          </div>
          <div className="border-t pt-3 space-y-3">
            <Label className="text-sm font-medium">Filter</Label>
            <div className="grid grid-cols-2 gap-3">
              {colSelect("Filterkolonne", cfgFilterCol, setCfgFilterCol)}
              <div className="space-y-1.5">
                <Label className="text-sm">Filterværdi</Label>
                <Input value={cfgFilterVal} onChange={(e) => setCfgFilterVal(e.target.value)} placeholder="f.eks. 1" />
              </div>
            </div>
          </div>
          <div className="border-t pt-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm">Behold rækker uden telefonnummer</Label>
                <p className="text-xs text-muted-foreground">Slå til hvis filen indeholder rækker uden telefon/OPP som stadig er reelle data</p>
              </div>
              <Switch checked={cfgSkipEmptyFilter} onCheckedChange={setCfgSkipEmptyFilter} />
            </div>
          </div>
          <div className="border-t pt-3 space-y-3">
            <Label className="text-sm font-medium">Type-detektering (Begge-upload)</Label>
            <p className="text-xs text-muted-foreground">Vælg kolonne og værdier der indikerer at en række er en annullering (resten bliver kurvrettelse)</p>
            <div className="grid grid-cols-2 gap-3">
              {colSelect("Type-kolonne", cfgTypeDetectionCol, setCfgTypeDetectionCol)}
              <div className="space-y-1.5">
                <Label className="text-sm">Annulleringsværdier</Label>
                <Input value={cfgTypeDetectionVals} onChange={(e) => setCfgTypeDetectionVals(e.target.value)} placeholder="f.eks. Nedlagt, Annulleret" />
              </div>
            </div>
          </div>
          <div className="border-t pt-3 space-y-3">
            <Label className="text-sm font-medium">Produkter uden telefon-match</Label>
            <p className="text-xs text-muted-foreground">Produkter der skal skippe telefon-matching og i stedet matches via sælger+dato+produkt (komma-separeret)</p>
            <Input value={cfgPhoneExcluded} onChange={(e) => setCfgPhoneExcluded(e.target.value)} placeholder="f.eks. 5G Internet, 5G Router" />
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Gem ændringer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function UploadCancellationsTab({ clientId: selectedClientId }: UploadCancellationsTabProps) {
  const { resolve } = useAgentNameResolver();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [phoneColumn, setPhoneColumn] = useState<string>("__none__");
  const [companyColumn, setCompanyColumn] = useState<string>("__none__");
  const [oppColumn, setOppColumn] = useState<string>("__none__");
  const [productColumn, setProductColumn] = useState<string>("__none__");
  const [revenueColumn, setRevenueColumn] = useState<string>("__none__");
  const [commissionColumn, setCommissionColumn] = useState<string>("__none__");
  const [memberNumberColumn, setMemberNumberColumn] = useState<string>("__none__");
  const [selectedConfigId, setSelectedConfigId] = useState<string>("__none__");
  const [matchedSales, setMatchedSales] = useState<MatchedSale[]>([]);
  const [matchedRowIndices, setMatchedRowIndices] = useState<Set<number>>(new Set());
  const [isMatching, setIsMatching] = useState(false);
  const [uploadType, setUploadType] = useState<"cancellation" | "basket_difference" | "both">("cancellation");
  const [step, setStep] = useState<WizardStep>("type");
  const [configName, setConfigName] = useState("");
  const [showSaveConfig, setShowSaveConfig] = useState(false);
  const [filterColumn, setFilterColumn] = useState<string>("__none__");
  const [filterValue, setFilterValue] = useState<string>("");
  const [appliedConfigName, setAppliedConfigName] = useState<string>("");
  const [showEditConfig, setShowEditConfig] = useState(false);
  const autoMatchPending = useRef(false);
  const [unmatchedSellerRows, setUnmatchedSellerRows] = useState<UnmatchedSellerRow[]>([]);
  const [sellerDropdownSelections, setSellerDropdownSelections] = useState<Record<string, string>>({});

  // Check for active import blocking new uploads (includes orphan imports with NULL client_id)
  const { data: activeImport } = useQuery({
    queryKey: ["active-import-block", selectedClientId],
    enabled: !!selectedClientId,
    queryFn: async () => {
      // First check imports for this client
      const { data: imports } = await supabase
        .from("cancellation_imports")
        .select("id, file_name")
        .eq("client_id", selectedClientId)
        .order("created_at", { ascending: false })
        .limit(10);
      
      // Also check for orphan imports (NULL client_id) that might block the system
      const { data: orphanImports } = await supabase
        .from("cancellation_imports")
        .select("id, file_name")
        .is("client_id", null)
        .order("created_at", { ascending: false })
        .limit(10);

      const allImports = [...(imports || []), ...(orphanImports || [])];
      if (!allImports.length) return null;

      const { data: pending } = await supabase
        .from("cancellation_queue")
        .select("import_id")
        .in("import_id", allImports.map(d => d.id))
        .eq("status", "pending")
        .limit(1);
      if (pending?.length) {
        const imp = allImports.find(d => d.id === pending[0].import_id);
        return imp || null;
      }
      return null;
    },
  });

  // Fetch all active employees for seller dropdown
  const { data: allEmployees = [] } = useQuery({
    queryKey: ["employees-for-seller-dropdown"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, work_email")
        .eq("is_active", true)
        .order("first_name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch existing seller mappings for this client
  const { data: sellerMappings = [], refetch: refetchSellerMappings } = useQuery({
    queryKey: ["cancellation-seller-mappings", selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const { data, error } = await supabase
        .from("cancellation_seller_mappings")
        .select("id, excel_seller_name, employee_id")
        .eq("client_id", selectedClientId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedClientId,
  });

  // Fetch configs for selected client
  const { data: clientConfigs = [] } = useQuery({
    queryKey: ["cancellation-upload-configs", selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const { data, error } = await supabase
        .from("cancellation_upload_configs")
        .select("*")
        .eq("client_id", selectedClientId)
        .order("is_default", { ascending: false });
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        product_phone_mappings: Array.isArray(d.product_phone_mappings) ? d.product_phone_mappings : [],
      })) as UploadConfig[];
    },
    enabled: !!selectedClientId,
  });

  // Auto-load default config when client changes
  useEffect(() => {
    if (clientConfigs.length > 0) {
      const defaultConfig = clientConfigs.find(c => c.is_default) || clientConfigs[0];
      if (defaultConfig) {
        applyConfig(defaultConfig);
        setSelectedConfigId(defaultConfig.id);
      }
    } else {
      setSelectedConfigId("__none__");
    }
  }, [clientConfigs]);

  const applyConfig = (config: UploadConfig) => {
    setPhoneColumn(config.phone_column || "__none__");
    setCompanyColumn(config.company_column || "__none__");
    setOppColumn(config.opp_column || "__none__");
    setMemberNumberColumn(config.member_number_column || "__none__");
    setProductColumn(config.product_columns?.[0] || "__none__");
    setRevenueColumn(config.revenue_column || "__none__");
    setCommissionColumn(config.commission_column || "__none__");
    setFilterColumn(config.filter_column || "__none__");
    setFilterValue(config.filter_value || "");
  };

  const handleConfigChange = (configId: string) => {
    setSelectedConfigId(configId);
    if (configId !== "__none__") {
      const config = clientConfigs.find(c => c.id === configId);
      if (config) applyConfig(config);
    }
  };

  // Save config mutation
  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      if (!selectedClientId || !configName.trim()) throw new Error("Vælg kunde og angiv et navn");
      const productCols = productColumn !== "__none__" ? [productColumn] : [];
      const { error } = await supabase
        .from("cancellation_upload_configs")
        .insert({
          client_id: selectedClientId,
          name: configName.trim(),
          phone_column: phoneColumn !== "__none__" ? phoneColumn : null,
          company_column: companyColumn !== "__none__" ? companyColumn : null,
          opp_column: oppColumn !== "__none__" ? oppColumn : null,
          member_number_column: memberNumberColumn !== "__none__" ? memberNumberColumn : null,
          product_columns: productCols,
          revenue_column: revenueColumn !== "__none__" ? revenueColumn : null,
          commission_column: commissionColumn !== "__none__" ? commissionColumn : null,
          product_match_mode: "strip_percent_suffix",
          is_default: clientConfigs.length === 0,
          filter_column: filterColumn !== "__none__" ? filterColumn : null,
          filter_value: filterValue.trim() || null,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Gemt", description: `Opsætning "${configName}" er gemt.` });
      setShowSaveConfig(false);
      setConfigName("");
      queryClient.invalidateQueries({ queryKey: ["cancellation-upload-configs", selectedClientId] });
    },
    onError: (err: Error) => {
      toast({ title: "Fejl", description: err.message, variant: "destructive" });
    },
  });

  // Fetch employee ID for the current user
  const { data: currentEmployee } = useQuery({
    queryKey: ["current-employee-for-upload", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const lowerEmail = user.email.toLowerCase();
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id")
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.email,
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const uploadedFile = acceptedFiles[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const { rows: jsonData, columns: cols } = await parseExcelFile(buffer, { defval: "" });

        if (jsonData.length === 0) {
          toast({
            title: "Tom fil",
            description: "Filen indeholder ingen data.",
            variant: "destructive",
          });
          return;
        }

        setColumns(cols);
        setParsedData(jsonData.map((row, idx) => ({ originalRow: row, originalIndex: idx })));

        // Check if a default config exists – if so, auto-match
        const defaultConfig = clientConfigs.find(c => c.is_default) || (clientConfigs.length > 0 ? clientConfigs[0] : null);
        if (defaultConfig) {
          applyConfig(defaultConfig);
          setSelectedConfigId(defaultConfig.id);
          setAppliedConfigName(defaultConfig.name);
          autoMatchPending.current = true;
        }

        toast({
          title: "Fil indlæst",
          description: `${jsonData.length} rækker fundet.`,
        });
      } catch (error) {
        toast({
          title: "Fejl ved læsning af fil",
          description: "Kunne ikke læse Excel-filen. Kontroller formatet.",
          variant: "destructive",
        });
      }
    };
    reader.readAsArrayBuffer(uploadedFile);
  }, [clientConfigs]);

  // Auto-match when file is parsed and a default config was applied
  useEffect(() => {
    if (autoMatchPending.current && parsedData.length > 0) {
      autoMatchPending.current = false;
      handleMatch();
    }
  }, [parsedData]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
  });

  const handleMatch = async () => {
    // Get the active config for product_phone_mappings
    const activeConfig = clientConfigs.find(c => c.id === selectedConfigId) || clientConfigs.find(c => c.is_default) || clientConfigs[0];
    const productPhoneMappings = activeConfig?.product_phone_mappings || [];
    const hasProductPhoneMappings = productPhoneMappings.length > 0;

    if (!hasProductPhoneMappings && phoneColumn === "__none__" && companyColumn === "__none__" && oppColumn === "__none__" && memberNumberColumn === "__none__") {
      toast({
        title: "Vælg kolonner",
        description: "Vælg mindst én kolonne at matche på (telefon, virksomhed, OPP-nummer eller medlemsnummer).",
        variant: "destructive",
      });
      return;
    }

    if (!selectedClientId) {
      toast({
        title: "Vælg kunde",
        description: "Du skal vælge en kunde at matche salg mod.",
        variant: "destructive",
      });
      return;
    }

    setIsMatching(true);

    try {
      // Apply row filter if configured — read from config directly to avoid stale state
      const cfgFilterColumn = activeConfig?.filter_column || "__none__";
      const cfgFilterValue = activeConfig?.filter_value || "";
      const filteredData = (uploadType !== "both" && cfgFilterColumn !== "__none__" && cfgFilterValue.trim())
        ? parsedData.filter(row => String(getCaseInsensitive(row.originalRow, cfgFilterColumn) ?? "").trim() === cfgFilterValue.trim())
        : parsedData;

      // Filter out junk rows (Total/subtotal/header rows from pivot tables)
      const sellerCol = activeConfig?.seller_column;
      const isJunkRow = (row: Record<string, any>): boolean => {
        const phoneVal = phoneColumn !== "__none__" ? String(getCaseInsensitive(row, phoneColumn) ?? "").trim().toLowerCase() : "";
        const sellerVal = sellerCol ? String(getCaseInsensitive(row, sellerCol) ?? "").trim().toLowerCase() : "";
        const companyVal = companyColumn !== "__none__" ? String(getCaseInsensitive(row, companyColumn) ?? "").trim().toLowerCase() : "";
        const oppVal = oppColumn !== "__none__" ? String(getCaseInsensitive(row, oppColumn) ?? "").trim().toLowerCase() : "";
        const memberVal = memberNumberColumn !== "__none__" ? String(getCaseInsensitive(row, memberNumberColumn) ?? "").trim().toLowerCase() : "";

        // Rule 1: phone column contains "total" → junk
        if (phoneVal === "total" || phoneVal === "subtotal" || phoneVal === "i alt" || phoneVal === "sum") return true;

        // Rule 2: phone column is empty and seller/other columns contain "total" → junk
        if (!phoneVal) {
          if (sellerVal === "total" || sellerVal === "subtotal") return true;
          if (companyVal === "total" || companyVal === "subtotal") return true;

           // Rule 3: phone is empty and no other match-relevant columns have real values → junk
          // Only active if customer has NOT enabled skip_empty_row_filter
          if (!activeConfig?.skip_empty_row_filter) {
            const hasAnyMatchValue = sellerVal.length > 0 || companyVal.length > 0 || oppVal.length > 0 || memberVal.length > 0;
            if (!hasAnyMatchValue) return true;
          }
        }

        return false;
      };

      const cleanedData = filteredData.filter(row => !isJunkRow(row.originalRow));
      const junkRowCount = filteredData.length - cleanedData.length;

      console.log("[handleMatch] total rows:", parsedData.length, "after filter:", filteredData.length, "junk rows removed:", junkRowCount, "clean rows:", cleanedData.length);

      if (junkRowCount > 0) {
        toast({
          title: `${junkRowCount} header/total-rækker ignoreret`,
          description: `${cleanedData.length} datarækker bruges til matching.`,
        });
      }

      // Extract values from cleaned data
      const phones: string[] = [];
      const companies: string[] = [];
      const oppNumbers: string[] = [];
      const memberNumbers: string[] = [];

      cleanedData.forEach(row => {
        if (phoneColumn !== "__none__") {
          const pv = getCaseInsensitive(row.originalRow, phoneColumn);
          if (pv) phones.push(normalizePhone(String(pv)));
        }
        // Note: product_phone_mappings now refer to raw_payload fields in DB, not Excel columns
        // Phones are collected from the single phoneColumn above
        if (companyColumn !== "__none__") {
          const cv = getCaseInsensitive(row.originalRow, companyColumn);
          if (cv) companies.push(String(cv).toLowerCase().trim());
        }
        if (oppColumn !== "__none__") {
          const ov = getCaseInsensitive(row.originalRow, oppColumn);
          if (ov) oppNumbers.push(String(ov).trim());
        }
        if (memberNumberColumn !== "__none__") {
          const mv = getCaseInsensitive(row.originalRow, memberNumberColumn);
          if (mv) memberNumbers.push(String(mv).trim());
        }
      });

      console.log("[handleMatch] phones:", phones.length, "companies:", companies.length, "oppNumbers:", oppNumbers.length, "memberNumbers:", memberNumbers.length);
      if (phones.length > 0) console.log("[handleMatch] sample phones from file:", phones.slice(0, 5));

      // First get client_campaign_ids for this client
      const { data: campaigns } = await supabase
        .from("client_campaigns")
        .select("id")
        .eq("client_id", selectedClientId);

      const campaignIds = campaigns?.map(c => c.id) || [];
      if (campaignIds.length === 0) {
        setMatchedSales([]);
        setStep("preview");
        return;
      }

      let allMatched: any[] = [];
      const existingIds = new Set<string>();

      const fetchCandidateSales = async () => {
        const candidates: any[] = [];
        let from = 0;
        const pageSize = 1000;
        while (true) {
          const { data, error } = await supabase
            .from("sales")
            .select(`
              id,
              sale_datetime,
              customer_phone,
              customer_company,
              validation_status,
              agent_name,
              agent_email,
              raw_payload,
              normalized_data
            `)
            .in("client_campaign_id", campaignIds)
            .neq("validation_status", "cancelled")
            .order("sale_datetime", { ascending: false })
            .range(from, from + pageSize - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          candidates.push(...data);
          if (data.length < pageSize) break;
          from += pageSize;
        }
        return candidates;
      };

      const candidateSales = (phones.length > 0 || companies.length > 0 || oppNumbers.length > 0 || memberNumbers.length > 0 || hasProductPhoneMappings)
        ? await fetchCandidateSales()
        : [];

      // Use normalizePhone for phone matching
      const phoneSet = new Set(phones.map(p => normalizePhone(p)));
      const companySet = new Set(companies);

      // Pre-fetch sale_items for all candidate sales (used by both Pass 1 and Pass 2)
      const candidateSaleIds = candidateSales.map(s => s.id);
      const saleItemsMap = new Map<string, { adversus_product_title: string; mapped_commission: number | null; mapped_revenue: number | null }[]>();
      
      for (let i = 0; i < candidateSaleIds.length; i += 500) {
        const batch = candidateSaleIds.slice(i, i + 500);
        const { data: items } = await supabase
          .from("sale_items")
          .select("sale_id, adversus_product_title, mapped_commission, mapped_revenue")
          .in("sale_id", batch);
        if (items) {
          for (const item of items) {
            const arr = saleItemsMap.get(item.sale_id) || [];
            arr.push({ adversus_product_title: item.adversus_product_title || "", mapped_commission: item.mapped_commission, mapped_revenue: item.mapped_revenue });
            saleItemsMap.set(item.sale_id, arr);
          }
        }
      }

      // --- Shared product resolution sources ---
      const { data: conditionRows } = await supabase
        .from("cancellation_product_conditions")
        .select("product_id, column_name, operator, values")
        .eq("client_id", selectedClientId);
      const groupedConditions = conditionRows && conditionRows.length > 0
        ? groupConditionsByProduct(conditionRows)
        : [];
      let condProductNames = new Map<string, string>();
      if (groupedConditions.length > 0) {
        const condPids = [...new Set(conditionRows!.map(r => r.product_id))];
        const { data: condProds } = await supabase.from("products").select("id, name").in("id", condPids);
        if (condProds) condProductNames = new Map(condProds.map(p => [p.id, p.name]));
      }

      const { data: legacyProductMappings } = await supabase
        .from("cancellation_product_mappings")
        .select("excel_product_name, product_id")
        .eq("client_id", selectedClientId);

      const productMappingLookup = new Map<string, string>();
      if (legacyProductMappings && legacyProductMappings.length > 0) {
        const mappedPids = [...new Set(legacyProductMappings.map(m => m.product_id))];
        const { data: mappedProds } = await supabase.from("products").select("id, name").in("id", mappedPids);
        const pidToName = new Map((mappedProds || []).map(p => [p.id, p.name]));
        for (const m of legacyProductMappings) {
          const prodName = pidToName.get(m.product_id);
          if (prodName) productMappingLookup.set(m.excel_product_name.toLowerCase().trim(), prodName);
        }
      }

      const phoneExcludedProducts: string[] = (activeConfig as any)?.phone_excluded_products || [];
      const PRODUCT_KEYS_1B = ["Subscription Name", "Product", "Produkt", "Abonnement", "Product Name", "Produktnavn"];
      const dateCol = activeConfig?.date_column;
      const fallbackMappings: FallbackProductMapping[] = (activeConfig as any)?.fallback_product_mappings || [];
      const hasAdvancedProductMatching =
        hasProductPhoneMappings ||
        groupedConditions.length > 0 ||
        productMappingLookup.size > 0 ||
        fallbackMappings.length > 0;

      // --- Product-aware matching (conditions / mappings / fallback) ---
      if (hasAdvancedProductMatching) {
        const matchedIndicesLocal = new Set<number>();
        const productMatched: MatchedSale[] = [];
        const matchedSaleProductKeys = new Set<string>(); // saleId|productName dedup

        if (hasProductPhoneMappings) {
          console.log("[handleMatch] PRODUCT-PHONE MATCHING (reversed)");
          console.log("[handleMatch] candidateSales:", candidateSales.length, "cleanedRows:", cleanedData.length);
          console.log("[handleMatch] mappings:", productPhoneMappings);

          cleanedData.forEach((row) => {
            const idx = row.originalIndex;
            const rawExcelPhone = phoneColumn !== "__none__" ? getCaseInsensitive(row.originalRow, phoneColumn) : null;
            if (!rawExcelPhone) return;
            const excelPhone = normalizePhone(String(rawExcelPhone));
            if (!excelPhone) return;

            if (idx < 3) console.log(`[handleMatch] row ${idx}: excelPhone="${excelPhone}"`);

            for (const sale of candidateSales) {
              if (existingIds.has(sale.id)) continue;
              const payloadData = (sale.raw_payload as any)?.data || {};

              for (const mapping of productPhoneMappings) {
                const payloadPhoneRaw = payloadData[mapping.payloadPhoneField];
                if (!payloadPhoneRaw) continue;
                const payloadPhone = normalizePhone(String(payloadPhoneRaw));
                if (!payloadPhone) continue;

                if (excelPhone === payloadPhone) {
                  const key = `${sale.id}|${mapping.productName}`;
                  if (matchedSaleProductKeys.has(key)) continue;
                  matchedSaleProductKeys.add(key);
                  matchedIndicesLocal.add(idx);
                  const posIndex = parseInt(mapping.payloadPhoneField?.replace(/\D/g, "") || "0", 10) - 1;
                  const allItems = saleItemsMap.get(sale.id) || [];
                  const matchingItem = posIndex >= 0 && posIndex < allItems.length ? allItems[posIndex] : allItems[0];
                  productMatched.push({
                    saleId: sale.id,
                    phone: String(payloadPhoneRaw),
                    company: sale.customer_company || "",
                    oppNumber: "",
                    saleDate: sale.sale_datetime || "",
                    employee: sale.agent_name || "Ukendt",
                    currentStatus: sale.validation_status || "pending",
                    uploadedRowData: row.originalRow,
                    targetProductName: mapping.productName,
                    realProductName: matchingItem?.adversus_product_title || allItems[0]?.adversus_product_title || "Ukendt produkt",
                    commission: matchingItem?.mapped_commission ?? undefined,
                    revenue: matchingItem?.mapped_revenue ?? undefined,
                  });
                }
              }
            }
          });
        }

        console.log("[handleMatch] productMatched (pass 1):", productMatched.length);

        // --- PASS 1b: FM phone matching via customer_phone directly ---
        cleanedData.forEach((row) => {
          const idx = row.originalIndex;
          if (matchedIndicesLocal.has(idx)) return;

          const rawExcelPhone = phoneColumn !== "__none__" ? getCaseInsensitive(row.originalRow, phoneColumn) : null;
          if (!rawExcelPhone) return;
          const excelPhone = normalizePhone(String(rawExcelPhone));
          if (!excelPhone) return;

          const prodCol = activeConfig?.product_columns?.[0];
          let rawRowProduct = "";
          if (prodCol) rawRowProduct = String(getCaseInsensitive(row.originalRow, prodCol) || "").trim();
          if (!rawRowProduct) {
            for (const key of PRODUCT_KEYS_1B) {
              const val = getCaseInsensitive(row.originalRow, key);
              if (val && String(val).trim()) { rawRowProduct = String(val).trim(); break; }
            }
          }

          // Check explicit mapping FIRST — if it resolves to a phone_excluded product, lock it
          let resolvedProduct: string | null = null;
          if (rawRowProduct) {
            const explicitMatch = productMappingLookup.get(rawRowProduct.toLowerCase().trim()) || null;
            if (explicitMatch) {
              const isExplicitExcluded = phoneExcludedProducts.some(
                p => explicitMatch.toLowerCase().includes(p.toLowerCase().trim()) || p.toLowerCase().trim().includes(explicitMatch.toLowerCase())
              );
              if (isExplicitExcluded) {
                resolvedProduct = explicitMatch; // Locked — don't let conditions override
              }
            }
          }

          // Only try condition-based matching if not already locked to a phone_excluded product
          if (!resolvedProduct && groupedConditions.length > 0) {
            const matchedPid = findMatchingProductId(groupedConditions, row.originalRow, idx < 3);
            if (matchedPid) resolvedProduct = condProductNames.get(matchedPid) || null;
          }

          if (!resolvedProduct && rawRowProduct) {
            resolvedProduct = productMappingLookup.get(rawRowProduct.toLowerCase().trim()) || null;
          }

          const exclusionBasis = (resolvedProduct || rawRowProduct).toLowerCase().trim();
          const isExcluded = exclusionBasis
            ? phoneExcludedProducts.some((p) => exclusionBasis.includes(p.toLowerCase().trim()) || p.toLowerCase().trim().includes(exclusionBasis))
            : false;
          if (isExcluded) return;

          for (const sale of candidateSales) {
            if (existingIds.has(sale.id)) continue;
            const salePhone = normalizePhone(sale.customer_phone || "");
            if (!salePhone || salePhone !== excelPhone) continue;

            const allItems = saleItemsMap.get(sale.id) || [];

            const key = `${sale.id}|${excelPhone}`;
            if (matchedSaleProductKeys.has(key)) continue;
            matchedSaleProductKeys.add(key);
            matchedIndicesLocal.add(idx);
            const firstItem = allItems[0];
            const realProduct = firstItem?.adversus_product_title || "Ukendt produkt";

            // Check if the sale's real product is phone_excluded (e.g. "5G Internet")
            const realProductLower = realProduct.toLowerCase().trim();
            const isRealProductExcluded = phoneExcludedProducts.some(
              (p) => realProductLower.includes(p.toLowerCase().trim()) || p.toLowerCase().trim().includes(realProductLower)
            );

            let finalTarget: string;
            if (isRealProductExcluded) {
              // Determine if this row is a cancellation
              let isRowCancellation = uploadType === "cancellation";
              if (!isRowCancellation && uploadType === "both") {
                const typeCol = activeConfig?.type_detection_column;
                const typeVals = ((activeConfig?.type_detection_values as string[]) || []);
                if (typeCol && typeVals.length > 0) {
                  const cellVal = String(getCaseInsensitive(row.originalRow, typeCol) || "").trim().toLowerCase();
                  isRowCancellation = typeVals.some(v => v.toLowerCase() === cellVal);
                }
                if (!isRowCancellation) {
                  const annulledVal = String(getCaseInsensitive(row.originalRow, "Annulled Sales") || "").trim();
                  isRowCancellation = annulledVal !== "" && annulledVal !== "0";
                }
              }

              if (isRowCancellation) {
                // Strict matching for cancellations: only match if upload product is also phone_excluded
                const uploadProduct = (resolvedProduct || rawRowProduct || "").toLowerCase().trim();
                const isUploadAlsoExcluded = !uploadProduct || phoneExcludedProducts.some(
                  p => uploadProduct.includes(p.toLowerCase().trim()) || p.toLowerCase().trim().includes(uploadProduct)
                );
                if (isUploadAlsoExcluded) {
                  finalTarget = realProduct;
                } else {
                  // Upload has a different product — skip this phone match,
                  // let Pass 2 handle with seller+product+date/customer logic
                  continue;
                }
              } else {
                // Non-cancellation: keep current behavior
                finalTarget = realProduct;
              }
            } else {
              // If condition matcher resolved a different product than the sale's,
              // check if the sale's product also satisfies the row's conditions.
              // This handles ambiguous conditions (e.g. "med" vs "uden" with identical rules).
              finalTarget = resolvedProduct || rawRowProduct || "Ukendt produkt";
              if (resolvedProduct && realProduct && resolvedProduct.toLowerCase() !== realProduct.toLowerCase()) {
                const realProdEntry = [...condProductNames.entries()].find(([_, name]) => name.toLowerCase() === realProduct.toLowerCase());
                if (realProdEntry) {
                  const realProdGroup = groupedConditions.find(g => g.product_id === realProdEntry[0]);
                  if (realProdGroup && evaluateConditions(realProdGroup.conditions, row.originalRow)) {
                    finalTarget = realProduct;
                  }
                }
              }

              // Reverse check: upload product is phone_excluded but sale is not
              const uploadProductLower = finalTarget.toLowerCase().trim();
              const isUploadProductExcluded = uploadProductLower && phoneExcludedProducts.some(
                p => uploadProductLower.includes(p.toLowerCase().trim()) || p.toLowerCase().trim().includes(uploadProductLower)
              );

              if (isUploadProductExcluded) {
                let isRowCancellation = uploadType === "cancellation";
                if (!isRowCancellation && uploadType === "both") {
                  const typeCol = activeConfig?.type_detection_column;
                  const typeVals = ((activeConfig?.type_detection_values as string[]) || []);
                  if (typeCol && typeVals.length > 0) {
                    const cellVal = String(getCaseInsensitive(row.originalRow, typeCol) || "").trim().toLowerCase();
                    isRowCancellation = typeVals.some(v => v.toLowerCase() === cellVal);
                  }
                  if (!isRowCancellation) {
                    const annulledVal = String(getCaseInsensitive(row.originalRow, "Annulled Sales") || "").trim();
                    isRowCancellation = annulledVal !== "" && annulledVal !== "0";
                  }
                }

                if (isRowCancellation) {
                  continue; // Upload is 5G but sale is not → skip, Pass 2 handles
                }
              }
            }

            productMatched.push({
              saleId: sale.id,
              phone: sale.customer_phone || "",
              company: sale.customer_company || "",
              oppNumber: "",
              saleDate: sale.sale_datetime || "",
              employee: sale.agent_name || "Ukendt",
              currentStatus: sale.validation_status || "pending",
              uploadedRowData: row.originalRow,
              targetProductName: finalTarget,
              realProductName: firstItem?.adversus_product_title || "Ukendt produkt",
              commission: firstItem?.mapped_commission ?? undefined,
              revenue: firstItem?.mapped_revenue ?? undefined,
            });
            break;
          }
        });

        console.log("[handleMatch] productMatched (after pass 1b FM):", productMatched.length);

        // --- PASS 2: Seller + Date + Product fallback for phone-less / phone-excluded rows ---
        const unmatchedSellers: UnmatchedSellerRow[] = [];
        const hasPass2Sources = Boolean(
          sellerCol &&
          dateCol &&
          (fallbackMappings.length > 0 || groupedConditions.length > 0 || productMappingLookup.size > 0)
        );

        if (hasPass2Sources) {
          console.log("[handleMatch] PASS 2: seller+date fallback", {
            sellerCol,
            dateCol,
            fallbackMappings,
            conditionProducts: groupedConditions.length,
            legacyMappings: productMappingLookup.size,
          });

          const sellerToEmployeeId = new Map<string, string>();
          for (const sm of sellerMappings) {
            sellerToEmployeeId.set(sm.excel_seller_name.toLowerCase(), sm.employee_id);
          }

          const employeeIdToEmail = new Map<string, string>();
          for (const emp of allEmployees) {
            if (emp.work_email) employeeIdToEmail.set(emp.id, emp.work_email.toLowerCase());
          }

          const firstNameToEmployeeId = new Map<string, string>();
          for (const emp of allEmployees) {
            if (emp.first_name) {
              const key = emp.first_name.toLowerCase();
              if (!firstNameToEmployeeId.has(key)) {
                firstNameToEmployeeId.set(key, emp.id);
              } else {
                firstNameToEmployeeId.set(key, "__ambiguous__");
              }
            }
          }

          cleanedData.forEach((row) => {
            const idx = row.originalIndex;
            if (matchedIndicesLocal.has(idx)) return;

            const rawExcelPhone = phoneColumn !== "__none__" ? getCaseInsensitive(row.originalRow, phoneColumn) : null;
            const excelPhone = rawExcelPhone ? normalizePhone(String(rawExcelPhone)) : "";
            if (excelPhone) {
              const prodCol2 = activeConfig?.product_columns?.[0];
              let rowProduct2 = "";
              if (prodCol2) rowProduct2 = String(getCaseInsensitive(row.originalRow, prodCol2) || "").trim();
              if (!rowProduct2) {
                for (const key of PRODUCT_KEYS_1B) {
                  const val = getCaseInsensitive(row.originalRow, key);
                  if (val && String(val).trim()) { rowProduct2 = String(val).trim(); break; }
                }
              }
              const isExcluded2 = phoneExcludedProducts.some(
                p => rowProduct2.toLowerCase().includes(p.toLowerCase()) || p.toLowerCase().includes(rowProduct2.toLowerCase())
              );
              if (!isExcluded2) return;
            }

            const excelSeller = String(getCaseInsensitive(row.originalRow, sellerCol) || "").trim();
            const excelDate = String(getCaseInsensitive(row.originalRow, dateCol) || "").trim();

            const productCol = activeConfig?.product_columns?.[0];
            const PRODUCT_KEYS = ["Subscription Name", "Product", "Produkt", "Abonnement", "Product Name", "Produktnavn"];
            let excelSubName = "";
            if (productCol) {
              excelSubName = String(getCaseInsensitive(row.originalRow, productCol) || "").trim();
            }
            if (!excelSubName) {
              for (const key of PRODUCT_KEYS) {
                const val = getCaseInsensitive(row.originalRow, key);
                if (val && String(val).trim()) { excelSubName = String(val).trim(); break; }
              }
            }

            // Check explicit mapping FIRST — if it resolves to a phone_excluded product, lock it
            let resolvedProductTitle: string | null = null;
            if (excelSubName) {
              const explicitMatch = productMappingLookup.get(excelSubName.toLowerCase().trim()) || null;
              if (explicitMatch) {
                const isExplicitExcluded = phoneExcludedProducts.some(
                  p => explicitMatch.toLowerCase().includes(p.toLowerCase().trim()) || p.toLowerCase().trim().includes(explicitMatch.toLowerCase())
                );
                if (isExplicitExcluded) {
                  resolvedProductTitle = explicitMatch; // Locked — don't let conditions override
                }
              }
            }

            // Only try condition-based matching if not already locked to a phone_excluded product
            if (!resolvedProductTitle && groupedConditions.length > 0) {
              const matchedPid = findMatchingProductId(groupedConditions, row.originalRow, idx < 3);
              if (matchedPid) {
                resolvedProductTitle = condProductNames.get(matchedPid) || null;
              }
            }

            if (!resolvedProductTitle && excelSubName) {
              const mappedName = productMappingLookup.get(excelSubName.toLowerCase().trim());
              if (mappedName) resolvedProductTitle = mappedName;
            }

            if (!resolvedProductTitle && excelSubName) {
              const matchingFallback = fallbackMappings.find(
                (fm) => excelSubName.toLowerCase().includes(fm.excelProductPattern.toLowerCase())
              );
              if (matchingFallback) {
                resolvedProductTitle = matchingFallback.saleItemTitle;
              }
            }

            if (!resolvedProductTitle || !excelSeller || !excelDate) return;

            let employeeId = sellerToEmployeeId.get(excelSeller.toLowerCase());
            if (!employeeId) {
              const autoMatch = firstNameToEmployeeId.get(excelSeller.toLowerCase());
              if (autoMatch && autoMatch !== "__ambiguous__") {
                employeeId = autoMatch;
              }
            }

            if (!employeeId) {
              unmatchedSellers.push({
                rowIndex: idx,
                excelSellerName: excelSeller,
                excelDate,
                excelProduct: excelSubName,
                originalRow: row.originalRow,
              });
              return;
            }

            const agentEmail = employeeIdToEmail.get(employeeId);
            if (!agentEmail) return;

            const excelDateObj = new Date(excelDate);
            const prodCol3 = activeConfig?.product_columns?.[0];
            let rowProduct3 = "";
            if (prodCol3) rowProduct3 = String(getCaseInsensitive(row.originalRow, prodCol3) || "").trim();
            if (!rowProduct3) {
              for (const key of PRODUCT_KEYS) {
                const val = getCaseInsensitive(row.originalRow, key);
                if (val && String(val).trim()) { rowProduct3 = String(val).trim(); break; }
              }
            }
            const exclusionBasis = (resolvedProductTitle || rowProduct3).toLowerCase().trim();
            const isPhoneExcludedRow = exclusionBasis
              ? phoneExcludedProducts.some((p) => exclusionBasis.includes(p.toLowerCase().trim()) || p.toLowerCase().trim().includes(exclusionBasis))
              : false;

            if (isPhoneExcludedRow) {
              const candidates: typeof candidateSales = [];
              for (const sale of candidateSales) {
                if (existingIds.has(sale.id)) continue;
                const saleAgentEmail = (sale.agent_email || "").toLowerCase();
                if (saleAgentEmail !== agentEmail) continue;
                const items = saleItemsMap.get(sale.id) || [];
                const hasProduct = items.some(item =>
                  item.adversus_product_title?.toLowerCase() === resolvedProductTitle!.toLowerCase()
                );
                if (!hasProduct) continue;
                candidates.push(sale);
              }

              let bestMatch: typeof candidateSales[0] | null = null;
              let bestScore = 0;

              for (const sale of candidates) {
                const saleDateObj = new Date(sale.sale_datetime);
                const dateMatch =
                  excelDateObj.getFullYear() === saleDateObj.getFullYear() &&
                  excelDateObj.getMonth() === saleDateObj.getMonth() &&
                  excelDateObj.getDate() === saleDateObj.getDate();

                const customerMatch = !!excelPhone && normalizePhone(sale.customer_phone || "") === excelPhone;
                const score = (dateMatch ? 1 : 0) + (customerMatch ? 1 : 0);
                if (score === 0) continue;
                if (score > bestScore) {
                  bestMatch = sale;
                  bestScore = score;
                }
                if (bestScore === 2) break;
              }

              if (bestMatch) {
                const key = `${bestMatch.id}|${resolvedProductTitle}`;
                if (!matchedSaleProductKeys.has(key)) {
                  matchedSaleProductKeys.add(key);
                  matchedIndicesLocal.add(idx);
                  const items = saleItemsMap.get(bestMatch.id) || [];
                  const matchedItem = items.find(item =>
                    item.adversus_product_title?.toLowerCase() === resolvedProductTitle!.toLowerCase()
                  );
                  productMatched.push({
                    saleId: bestMatch.id,
                    phone: bestMatch.customer_phone || "",
                    company: bestMatch.customer_company || "",
                    oppNumber: "",
                    saleDate: bestMatch.sale_datetime || "",
                    employee: bestMatch.agent_name || "Ukendt",
                    currentStatus: bestMatch.validation_status || "pending",
                    uploadedRowData: row.originalRow,
                    targetProductName: resolvedProductTitle!,
                    realProductName: matchedItem?.adversus_product_title || items[0]?.adversus_product_title || "Ukendt produkt",
                    commission: matchedItem?.mapped_commission ?? undefined,
                    revenue: matchedItem?.mapped_revenue ?? undefined,
                    matchConfidence: bestScore === 2 ? "high" : "medium",
                  });
                }
              } else {
                unmatchedSellers.push({
                  rowIndex: idx,
                  excelSellerName: excelSeller,
                  excelDate,
                  excelProduct: excelSubName,
                  originalRow: row.originalRow,
                });
              }
            } else {
              for (const sale of candidateSales) {
                const saleAgentEmail = (sale.agent_email || "").toLowerCase();
                if (saleAgentEmail !== agentEmail) continue;

                const saleDateObj = new Date(sale.sale_datetime);
                if (
                  excelDateObj.getFullYear() !== saleDateObj.getFullYear() ||
                  excelDateObj.getMonth() !== saleDateObj.getMonth() ||
                  excelDateObj.getDate() !== saleDateObj.getDate()
                ) continue;

                const items = saleItemsMap.get(sale.id) || [];

                const key = `${sale.id}|${resolvedProductTitle}`;
                if (matchedSaleProductKeys.has(key)) continue;
                matchedSaleProductKeys.add(key);
                matchedIndicesLocal.add(idx);
                const firstItem = items[0];
                const realProduct = firstItem?.adversus_product_title || "Ukendt produkt";

                let finalTarget = resolvedProductTitle!;
                if (resolvedProductTitle && realProduct && resolvedProductTitle.toLowerCase() !== realProduct.toLowerCase()) {
                  const realProdEntry = [...condProductNames.entries()].find(([_, name]) => name.toLowerCase() === realProduct.toLowerCase());
                  if (realProdEntry) {
                    const realProdGroup = groupedConditions.find(g => g.product_id === realProdEntry[0]);
                    if (realProdGroup && evaluateConditions(realProdGroup.conditions, row.originalRow)) {
                      finalTarget = realProduct;
                    }
                  }
                }

                productMatched.push({
                  saleId: sale.id,
                  phone: sale.customer_phone || "",
                  company: sale.customer_company || "",
                  oppNumber: "",
                  saleDate: sale.sale_datetime || "",
                  employee: sale.agent_name || "Ukendt",
                  currentStatus: sale.validation_status || "pending",
                  uploadedRowData: row.originalRow,
                  targetProductName: finalTarget,
                  realProductName: firstItem?.adversus_product_title || "Ukendt produkt",
                  commission: firstItem?.mapped_commission ?? undefined,
                  revenue: firstItem?.mapped_revenue ?? undefined,
                });
                break;
              }
            }
          });

          console.log("[handleMatch] pass 2 additional matches:", productMatched.length, "unmatched sellers:", unmatchedSellers.length);
        }

        setUnmatchedSellerRows(unmatchedSellers);
        setMatchedSales(productMatched);
        setMatchedRowIndices(matchedIndicesLocal);
        setStep("preview");

        toast({
          title: "Matching fuldført",
          description: `${productMatched.length} produkt-matches fundet.${unmatchedSellers.length > 0 ? ` ${unmatchedSellers.length} rækker mangler sælger-mapping.` : ""}`,
        });
        return;
      }

      // --- Standard matching (no product matching sources) ---
      for (const sale of candidateSales) {
        if (existingIds.has(sale.id)) continue;
        const salePhone = normalizePhone(sale.customer_phone || "");
        const saleCompany = (sale.customer_company || "").toLowerCase().trim();

        let matched = false;
        if (salePhone && phoneSet.has(salePhone)) matched = true;
        if (!matched && saleCompany && companySet.has(saleCompany)) matched = true;

        if (matched) {
          allMatched.push(sale);
          existingIds.add(sale.id);
        }
      }

      // extractOpp is now imported from shared utility

      if (oppNumbers.length > 0) {
        const oppSet = new Set(oppNumbers.map(o => o.toUpperCase().trim()));
        for (const sale of candidateSales) {
          if (existingIds.has(sale.id)) continue;
          const saleOpp = extractOpp(sale.raw_payload).toUpperCase().trim();
          if (saleOpp && oppSet.has(saleOpp)) {
            allMatched.push(sale);
            existingIds.add(sale.id);
          }
        }
      }

      if (memberNumbers.length > 0) {
        const memberSet = new Set(memberNumbers.map(m => m.trim()));
        for (const sale of candidateSales) {
          if (existingIds.has(sale.id)) continue;
          const nd = sale.normalized_data as Record<string, unknown> | null;
          const rp = sale.raw_payload as Record<string, unknown> | null;
          const saleMemberNr = String(
            nd?.member_number ?? 
            getCaseInsensitive(rp?.data as Record<string, unknown> | undefined, "medlemsnummer") ?? 
            ""
          ).trim();
          if (saleMemberNr && memberSet.has(saleMemberNr)) {
            allMatched.push(sale);
            existingIds.add(sale.id);
          }
        }
      }

      const uploadedRowsByOpp = new Map<string, Record<string, unknown>[]>();
      const uploadedRowByPhone = new Map<string, Record<string, unknown>>();
      const uploadedRowByCompany = new Map<string, Record<string, unknown>>();
      const uploadedRowByMemberNr = new Map<string, Record<string, unknown>>();
      
      cleanedData.forEach(row => {
        if (oppColumn !== "__none__") {
          const ov = getCaseInsensitive(row.originalRow, oppColumn);
          if (ov) {
            const key = String(ov).toUpperCase().trim();
            const arr = uploadedRowsByOpp.get(key) || [];
            arr.push(row.originalRow);
            uploadedRowsByOpp.set(key, arr);
          }
        }
        if (phoneColumn !== "__none__") {
          const pv = getCaseInsensitive(row.originalRow, phoneColumn);
          if (pv) uploadedRowByPhone.set(normalizePhone(String(pv)), row.originalRow);
        }
        if (companyColumn !== "__none__") {
          const cv = getCaseInsensitive(row.originalRow, companyColumn);
          if (cv) uploadedRowByCompany.set(String(cv).toLowerCase().trim(), row.originalRow);
        }
        if (memberNumberColumn !== "__none__") {
          const mv = getCaseInsensitive(row.originalRow, memberNumberColumn);
          if (mv) uploadedRowByMemberNr.set(String(mv).trim(), row.originalRow);
        }
      });

      const consolidateOppRows = (rows: Record<string, unknown>[]): Record<string, unknown> => {
        const totalRow = rows.find(r => {
          const produktVal = String(r["Produkt"] || r["produkt"] || "").trim();
          return produktVal.toLowerCase() === "total";
        }) || rows[rows.length - 1];

        const productRows = rows.filter(r => {
          const produktVal = String(r["Produkt"] || r["produkt"] || "").trim();
          return produktVal.toLowerCase() !== "total" && produktVal !== "";
        });

        return {
          ...totalRow,
          _product_rows: productRows.length > 0 ? productRows : undefined,
        };
      };

      const indexByOpp = new Map<string, number[]>();
      const indexByPhone = new Map<string, number>();
      const indexByCompany = new Map<string, number>();
      const indexByMemberNr = new Map<string, number>();
      cleanedData.forEach((row) => {
        const idx = row.originalIndex;
        if (oppColumn !== "__none__") {
          const ov = getCaseInsensitive(row.originalRow, oppColumn);
          if (ov) {
            const key = String(ov).toUpperCase().trim();
            const arr = indexByOpp.get(key) || [];
            arr.push(idx);
            indexByOpp.set(key, arr);
          }
        }
        if (phoneColumn !== "__none__") {
          const pv = getCaseInsensitive(row.originalRow, phoneColumn);
          if (pv) indexByPhone.set(normalizePhone(String(pv)), idx);
        }
        if (companyColumn !== "__none__") {
          const cv = getCaseInsensitive(row.originalRow, companyColumn);
          if (cv) indexByCompany.set(String(cv).toLowerCase().trim(), idx);
        }
        if (memberNumberColumn !== "__none__") {
          const mv = getCaseInsensitive(row.originalRow, memberNumberColumn);
          if (mv) indexByMemberNr.set(String(mv).trim(), idx);
        }
      });

      const matchedIndices = new Set<number>();

      const findUploadedRow = (sale: any): Record<string, unknown> => {
        const saleOpp = extractOpp(sale.raw_payload).toUpperCase().trim();
        if (saleOpp && uploadedRowsByOpp.has(saleOpp)) {
          (indexByOpp.get(saleOpp) || []).forEach(i => matchedIndices.add(i));
          return consolidateOppRows(uploadedRowsByOpp.get(saleOpp)!);
        }
        const salePhone = normalizePhone(sale.customer_phone || "");
        if (salePhone && uploadedRowByPhone.has(salePhone)) {
          const idx = indexByPhone.get(salePhone);
          if (idx !== undefined) matchedIndices.add(idx);
          return uploadedRowByPhone.get(salePhone)!;
        }
        const saleCompany = (sale.customer_company || "").toLowerCase().trim();
        if (saleCompany && uploadedRowByCompany.has(saleCompany)) {
          const idx = indexByCompany.get(saleCompany);
          if (idx !== undefined) matchedIndices.add(idx);
          return uploadedRowByCompany.get(saleCompany)!;
        }
        const nd = sale.normalized_data as Record<string, unknown> | null;
        const rp = sale.raw_payload as Record<string, unknown> | null;
        const saleMemberNr = String(nd?.member_number ?? getCaseInsensitive(rp?.data as Record<string, unknown> | undefined, "medlemsnummer") ?? "").trim();
        if (saleMemberNr && uploadedRowByMemberNr.has(saleMemberNr)) {
          const idx = indexByMemberNr.get(saleMemberNr);
          if (idx !== undefined) matchedIndices.add(idx);
          return uploadedRowByMemberNr.get(saleMemberNr)!;
        }
        return {};
      };

      const matched: MatchedSale[] = allMatched.map(sale => {
        const items = saleItemsMap.get(sale.id) || [];
        const firstItem = items[0];
        return {
          saleId: sale.id,
          phone: sale.customer_phone || "",
          company: sale.customer_company || "",
          oppNumber: extractOpp(sale.raw_payload),
          saleDate: sale.sale_datetime || "",
          employee: sale.agent_name || "Ukendt",
          currentStatus: sale.validation_status || "pending",
          uploadedRowData: findUploadedRow(sale),
          targetProductName: firstItem?.adversus_product_title || undefined,
          realProductName: firstItem?.adversus_product_title || undefined,
          commission: firstItem?.mapped_commission ?? undefined,
          revenue: firstItem?.mapped_revenue ?? undefined,
        };
      });

      setMatchedSales(matched);
      setMatchedRowIndices(matchedIndices);
      setStep("preview");

      toast({
        title: "Matching fuldført",
        description: `${matched.length} salg fundet der matcher.`,
      });
    } catch (error) {
      toast({
        title: "Fejl ved matching",
        description: error instanceof Error ? error.message : "Ukendt fejl",
        variant: "destructive",
      });
    } finally {
      setIsMatching(false);
    }
  };

  // Send to approval queue mutation
  const sendToQueueMutation = useMutation({
    mutationFn: async () => {
      const activeQueueConfig = clientConfigs.find(c => c.id === selectedConfigId) || clientConfigs.find(c => c.is_default) || clientConfigs[0];
      const qFilterColumn = activeQueueConfig?.filter_column || "__none__";
      const qFilterValue = activeQueueConfig?.filter_value || "";
      const filteredForQueue = (qFilterColumn !== "__none__" && qFilterValue.trim())
        ? parsedData.filter(row => String(getCaseInsensitive(row.originalRow, qFilterColumn) ?? "").trim() === qFilterValue.trim())
        : parsedData;

      const unmatchedRows = filteredForQueue
        .filter(row => !matchedRowIndices.has(row.originalIndex))
        .map(r => r.originalRow);

      let importId: string | null = null;
      if (currentEmployee?.id && file) {
        const configId = selectedConfigId !== "__none__" ? selectedConfigId : null;
        const { data: importData, error: importError } = await supabase
          .from("cancellation_imports")
          .insert({
            uploaded_by: currentEmployee.id,
            file_name: file.name,
            file_size_bytes: file.size,
            status: "pending_approval",
            rows_processed: parsedData.length,
            rows_matched: matchedSales.length,
            upload_type: uploadType === "both" ? "both" : uploadType,
            config_id: configId,
            client_id: selectedClientId || null,
            unmatched_rows: unmatchedRows.length > 0 ? unmatchedRows : null,
          } as any)
          .select("id")
          .single();
        if (importError) throw importError;
        importId = importData.id;
      }

      if (!importId) throw new Error("Kunne ikke oprette import-log");

      // === PRE-CLASSIFICATION DEDUP: Merge matchedSales by normalized phone ===
      const phoneGroups = new Map<string, typeof matchedSales>();
      const mergedAwayEntries: typeof matchedSales = [];
      matchedSales.forEach(sale => {
        const phone = sale.phone ? normalizePhone(sale.phone) : null;
        const key = phone || `__no_phone_${sale.saleId}`;
        const group = phoneGroups.get(key) || [];
        group.push(sale);
        phoneGroups.set(key, group);
      });

      const deduplicatedMatchedSales: typeof matchedSales = [];
      phoneGroups.forEach((group, key) => {
        const first = group[0];
        if (group.length === 1) {
          deduplicatedMatchedSales.push(first);
          return;
        }
        // Multiple rows for same phone — merge
        // Cancellation: only if ALL rows in group are cancellations
        const typeCol = activeQueueConfig?.type_detection_column;
        const typeVals = (activeQueueConfig?.type_detection_values as string[]) || [];

        const allAreCancellations = group.every(sale => {
          let isConfiguredCancellation = false;
          if (typeCol && typeVals.length > 0) {
            const cellVal = String(getCaseInsensitive(sale.uploadedRowData, typeCol) || "").trim().toLowerCase();
            isConfiguredCancellation = typeVals.some(v => v.toLowerCase() === cellVal);
          }
          const annulledVal = String(getCaseInsensitive(sale.uploadedRowData, "Annulled Sales") || "").trim();
          const isAnnulledSales = annulledVal !== "" && annulledVal !== "0";
          return isConfiguredCancellation || isAnnulledSales;
        });

        // Build merged uploadedRowData from first entry, but override cancellation markers
        const mergedRowData = { ...first.uploadedRowData };
        if (!allAreCancellations) {
          // Force non-cancellation
          mergedRowData["Annulled Sales"] = "0";
          if (typeCol) {
            mergedRowData[typeCol] = "";
          }
        }
        // else: keep first entry's cancellation markers as-is (they're already cancellation)

        deduplicatedMatchedSales.push({ ...first, uploadedRowData: mergedRowData });
        // Track merged-away entries for preview
        for (let i = 1; i < group.length; i++) {
          mergedAwayEntries.push(group[i]);
        }
        console.log(`[dedup] Merged ${group.length} rows for phone=${key}, allCancellations=${allAreCancellations}`);
      });

      console.log(`[dedup] matchedSales: ${matchedSales.length} → ${deduplicatedMatchedSales.length}, merged away: ${mergedAwayEntries.length}`);

      // Build queue items from deduplicated sales
      const queueItems = deduplicatedMatchedSales.map(sale => {
        let rowUploadType = uploadType as string;
        if (uploadType === "both") {
          const typeCol = activeQueueConfig?.type_detection_column;
          const typeVals = (activeQueueConfig?.type_detection_values as string[]) || [];
          
          // Check 1: Configured column/values
          let isConfiguredCancellation = false;
          if (typeCol && typeVals.length > 0) {
            const cellVal = String(getCaseInsensitive(sale.uploadedRowData, typeCol) || "").trim().toLowerCase();
            isConfiguredCancellation = typeVals.some(v => v.toLowerCase() === cellVal);
          }
          
          // Check 2: Always check "Annulled Sales" as fallback (OR-logik)
          const annulledVal = String(getCaseInsensitive(sale.uploadedRowData, "Annulled Sales") || "").trim();
          const isAnnulledSales = annulledVal !== "" && annulledVal !== "0";
          
          if (isConfiguredCancellation || isAnnulledSales) {
            rowUploadType = "cancellation";
          } else {
            // Classify as correct_match or basket_difference based on product comparison
            const phoneExcluded: string[] = (activeQueueConfig as any)?.phone_excluded_products || [];
            const targetName = (sale.targetProductName || "").trim().toLowerCase();
            const realName = (sale.realProductName || "").trim().toLowerCase();
            const isPhoneExcludedTarget = phoneExcluded.some(p => targetName.includes(p.trim().toLowerCase()) || p.trim().toLowerCase().includes(targetName));
            const isPhoneExcludedReal = phoneExcluded.some(p => realName.includes(p.trim().toLowerCase()) || p.trim().toLowerCase().includes(realName));
            
            if (isPhoneExcludedTarget || isPhoneExcludedReal || (targetName && realName && targetName === realName)) {
              rowUploadType = "correct_match";
            } else {
              rowUploadType = "basket_difference";
            }
          }
        }
        return {
          import_id: importId!,
          sale_id: sale.saleId,
          upload_type: rowUploadType,
          status: "pending",
          uploaded_data: sale.uploadedRowData || null,
          opp_group: sale.oppNumber || null,
          client_id: selectedClientId || null,
          target_product_name: sale.targetProductName || null,
        };
      });

      for (let i = 0; i < queueItems.length; i += 50) {
        const batch = queueItems.slice(i, i + 50);
        const { error } = await supabase
          .from("cancellation_queue")
          .insert(batch as any);
        if (error) throw error;
      }

      return { count: queueItems.length, dedupRemoved: mergedAwayEntries.length };
    },
    onSuccess: ({ count, dedupRemoved }) => {
      toast({
        title: "Sendt til godkendelse",
        description: `${count} salg er sendt til godkendelseskøen.${dedupRemoved > 0 ? ` ${dedupRemoved} dubletter (samme telefonnummer) blev fjernet.` : ''}`,
      });
      queryClient.invalidateQueries({ queryKey: ["cancellation-imports-history"] });
      queryClient.invalidateQueries({ queryKey: ["cancellation-queue"] });
      setStep("done");
    },
    onError: (error: Error) => {
      toast({
        title: "Fejl ved afsendelse til kø",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleReset = () => {
    setFile(null);
    setParsedData([]);
    setColumns([]);
    setPhoneColumn("__none__");
    setCompanyColumn("__none__");
    setOppColumn("__none__");
    setMemberNumberColumn("__none__");
    setProductColumn("__none__");
    setRevenueColumn("__none__");
    setCommissionColumn("__none__");
    setFilterColumn("__none__");
    setFilterValue("");
    setAppliedConfigName("");
    setUploadType("cancellation");
    setSelectedConfigId("__none__");
    setMatchedSales([]);
    setMatchedRowIndices(new Set());
    setUnmatchedSellerRows([]);
    setSellerDropdownSelections({});
    setStep("type");
  };

  // Compute unmatched rows for preview (excluding junk/total rows)
  const filteredDataForPreview = (() => {
    const activeConfig = clientConfigs.find(c => c.id === selectedConfigId) || clientConfigs.find(c => c.is_default) || clientConfigs[0];
    const sc = activeConfig?.seller_column;
    const previewFilterColumn = activeConfig?.filter_column || "__none__";
    const previewFilterValue = activeConfig?.filter_value || "";
    let data = (uploadType !== "both" && previewFilterColumn !== "__none__" && previewFilterValue.trim())
      ? parsedData.filter(row => String(getCaseInsensitive(row.originalRow, previewFilterColumn) ?? "").trim() === previewFilterValue.trim())
      : parsedData;
    // Apply same junk row filter
    data = data.filter(row => {
      const r = row.originalRow;
      const phoneVal = phoneColumn !== "__none__" ? String(getCaseInsensitive(r, phoneColumn) ?? "").trim().toLowerCase() : "";
      const sellerVal = sc ? String(getCaseInsensitive(r, sc) ?? "").trim().toLowerCase() : "";
      const companyVal = companyColumn !== "__none__" ? String(getCaseInsensitive(r, companyColumn) ?? "").trim().toLowerCase() : "";
      const oppVal = oppColumn !== "__none__" ? String(getCaseInsensitive(r, oppColumn) ?? "").trim().toLowerCase() : "";
      const memberVal = memberNumberColumn !== "__none__" ? String(getCaseInsensitive(r, memberNumberColumn) ?? "").trim().toLowerCase() : "";
      if (phoneVal === "total" || phoneVal === "subtotal" || phoneVal === "i alt" || phoneVal === "sum") return false;
      if (!phoneVal) {
        if (sellerVal === "total" || sellerVal === "subtotal") return false;
        if (companyVal === "total" || companyVal === "subtotal") return false;
        if (!activeConfig?.skip_empty_row_filter) {
          if (!sellerVal && !companyVal && !oppVal && !memberVal) return false;
        }
      }
      return true;
    });
    return data;
  })();
  const unmatchedRows = filteredDataForPreview.filter(row => !matchedRowIndices.has(row.originalIndex));
  const unmatchedCount = unmatchedRows.length;

  // Compute duplicates: group by normalized phone number to find rows that will be merged
  const duplicateSalesMap = useMemo(() => {
    const map = new Map<string, MatchedSale[]>();
    matchedSales.forEach(sale => {
      const phone = sale.phone ? normalizePhone(sale.phone) : sale.saleId;
      const arr = map.get(phone) || [];
      arr.push(sale);
      map.set(phone, arr);
    });
    return map;
  }, [matchedSales]);
  const duplicateEntries = useMemo(() => [...duplicateSalesMap.values()].filter(arr => arr.length > 1), [duplicateSalesMap]);
  const duplicateSales = useMemo(() => duplicateEntries.flat(), [duplicateEntries]);
  const duplicateCount = duplicateSales.length;

  const [previewTab, setPreviewTab] = useState<"matched" | "unmatched" | "seller_unmatched" | "duplicates">("matched");

  // Handle saving a seller mapping and re-running match
  const handleSellerMappingSave = async (excelSellerName: string, employeeId: string) => {
    try {
      const { error } = await supabase
        .from("cancellation_seller_mappings")
        .upsert({
          client_id: selectedClientId,
          excel_seller_name: excelSellerName,
          employee_id: employeeId,
        } as any, { onConflict: "client_id,excel_seller_name" });
      if (error) throw error;

      toast({ title: "Mapping gemt", description: `"${excelSellerName}" er nu koblet til en medarbejder.` });
      
      // Update local selections
      setSellerDropdownSelections(prev => ({ ...prev, [excelSellerName]: employeeId }));
      
      // Refetch seller mappings
      await refetchSellerMappings();
      
      // Remove from unmatched list
      setUnmatchedSellerRows(prev => prev.filter(r => r.excelSellerName.toLowerCase() !== excelSellerName.toLowerCase()));
    } catch (err: any) {
      toast({ title: "Fejl", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <StepIndicator currentStep={step} />

      {/* STEP 1: Choose type */}
      {step === "type" && (
        activeImport ? (
          <Card className="max-w-2xl mx-auto">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-warning mb-4" />
              <h3 className="text-lg font-semibold mb-2">Igangværende upload</h3>
              <p className="text-sm text-muted-foreground mb-1">
                Der er allerede en igangværende upload for denne kunde:
              </p>
              <p className="text-sm font-medium mb-4">"{activeImport.file_name}"</p>
              <p className="text-sm text-muted-foreground mb-6">
                Behandl den først i <strong>Godkendelseskøen</strong> før du uploader en ny fil.
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Slet upload og rul tilbage
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Slet upload og rul alt tilbage?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Dette vil slette uploaden "{activeImport.file_name}" og rulle alle ændringer tilbage – inkl. godkendte annulleringer og kurvrettelser. Salg vil blive gendannet til deres oprindelige status.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuller</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={async () => {
                        try {
                          const { data, error } = await supabase.rpc("rollback_cancellation_import", {
                            p_import_id: activeImport.id,
                          });
                          if (error) throw error;
                          const result = data as any;
                          toast({
                            title: "Upload slettet og rullet tilbage",
                            description: `${result?.reversed_approved || 0} godkendte blev rullet tilbage, ${result?.removed_pending || 0} afventende fjernet.`,
                          });
                          queryClient.invalidateQueries({ queryKey: ["active-import-block"] });
                          queryClient.invalidateQueries({ queryKey: ["cancellation-queue"] });
                          queryClient.invalidateQueries({ queryKey: ["match-errors"] });
                          queryClient.invalidateQueries({ queryKey: ["match-errors-count"] });
                        } catch (err: any) {
                          toast({ title: "Fejl", description: err.message, variant: "destructive" });
                        }
                      }}
                    >
                      Ja, slet og rul tilbage
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
          <button
            onClick={() => { setUploadType("cancellation"); setStep("upload"); }}
            className={`group relative rounded-lg border-2 p-6 text-left transition-all hover:border-primary hover:shadow-md
              ${uploadType === "cancellation" ? "border-primary bg-primary/5" : "border-border"}`}
          >
            <Ban className="h-8 w-8 mb-3 text-destructive" />
            <h3 className="font-semibold text-lg">Annullering</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Annuller salg helt fra kundens fil
            </p>
          </button>

          <button
            onClick={() => { setUploadType("basket_difference"); setStep("upload"); }}
            className={`group relative rounded-lg border-2 p-6 text-left transition-all hover:border-primary hover:shadow-md
              ${uploadType === "basket_difference" ? "border-primary bg-primary/5" : "border-border"}`}
          >
            <ShoppingCart className="h-8 w-8 mb-3 text-warning" />
            <h3 className="font-semibold text-lg">Kurv difference</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Opdater kurv-værdi baseret på kundens fil
            </p>
          </button>

          <button
            onClick={() => { setUploadType("both"); setStep("upload"); }}
            className={`group relative rounded-lg border-2 p-6 text-left transition-all hover:border-primary hover:shadow-md
              ${uploadType === "both" ? "border-primary bg-primary/5" : "border-border"}`}
          >
            <Layers className="h-8 w-8 mb-3 text-primary" />
            <h3 className="font-semibold text-lg">Begge</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Én fil med både annulleringer og kurvrettelser
            </p>
          </button>
        </div>
        )
      )}

      {/* STEP 2: Upload file */}
      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload {uploadType === "cancellation" ? "annulleringsfil" : uploadType === "basket_difference" ? "kurv-fil" : "kombineret fil"}
            </CardTitle>
            <CardDescription>
              Upload en Excel-fil (.xlsx). Systemet matcher automatisk baseret på gemt opsætning.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {clientConfigs.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                <p className="text-lg font-medium">Ingen opsætning fundet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Denne kunde har ingen gemt opsætning for annulleringsupload. Kontakt en administrator.
                </p>
              </div>
            ) : !file ? (
              <>
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
                    ${isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}`}
                >
                  <input {...getInputProps()} />
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  {isDragActive ? (
                    <p className="text-lg">Slip filen her...</p>
                  ) : (
                    <>
                      <p className="text-lg mb-2">Træk og slip en Excel-fil her</p>
                      <p className="text-sm text-muted-foreground">eller klik for at vælge</p>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                  <Settings className="h-4 w-4" />
                  <span>Opsætning: <strong>{(clientConfigs.find(c => c.is_default) || clientConfigs[0])?.name}</strong></span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-7 px-2"
                    onClick={() => setShowEditConfig(true)}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Rediger
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                <p className="text-sm text-muted-foreground">Matcher {file.name}...</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setFile(null); setParsedData([]); setColumns([]); setStep("type"); }}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Tilbage
              </Button>
            </div>
          </CardContent>
        </Card>
      )}


      {/* STEP 3: Preview */}
      {step === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              Forhåndsvisning – {matchedSales.length} match
            </CardTitle>
            <CardDescription>
              {uploadType === "cancellation" ? "Annullering" : "Kurv difference"} – gennemgå matchede salg før afsendelse til godkendelseskøen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {appliedConfigName && (
              <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-md px-3 py-2">
                <Settings className="h-4 w-4 text-muted-foreground" />
                <span>Opsætning: <strong>{appliedConfigName}</strong></span>
                {filterColumn !== "__none__" && filterValue.trim() && (
                  <Badge variant="secondary" className="ml-2">
                    Filter: {filterColumn} = {filterValue}
                  </Badge>
                )}
              </div>
            )}

            {/* Stats */}
            <div className="flex gap-4 flex-wrap">
              <Badge
                variant={previewTab === "matched" ? "default" : "outline"}
                className="text-sm px-3 py-1 cursor-pointer"
                onClick={() => setPreviewTab("matched")}
              >
                {matchedRowIndices.size} matchede rækker ({matchedSales.length} salg)
              </Badge>
              {unmatchedCount > 0 && (
                <Badge
                  variant={previewTab === "unmatched" ? "destructive" : "outline"}
                  className="text-sm px-3 py-1 cursor-pointer"
                  onClick={() => setPreviewTab("unmatched")}
                >
                  {unmatchedCount} umatchede rækker
                </Badge>
              )}
              {duplicateCount > 0 && (
                <Badge
                  variant={previewTab === "duplicates" ? "destructive" : "outline"}
                  className="text-sm px-3 py-1 cursor-pointer"
                  onClick={() => setPreviewTab("duplicates")}
                >
                  <Layers className="h-3 w-3 mr-1" />
                  {duplicateCount} dubletter
                </Badge>
              )}
              {unmatchedSellerRows.length > 0 && (
                <Badge
                  variant={previewTab === "seller_unmatched" as any ? "destructive" : "outline"}
                  className="text-sm px-3 py-1 cursor-pointer"
                  onClick={() => setPreviewTab("seller_unmatched" as any)}
                >
                  {unmatchedSellerRows.length} mangler sælger-mapping
                </Badge>
              )}
            </div>

            {previewTab === "matched" ? (
              matchedSales.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <X className="h-12 w-12 mx-auto mb-4" />
                  <p>Ingen matchende salg fundet</p>
                </div>
              ) : (
                <div className="rounded-md border max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Salgsdato</TableHead>
                        <TableHead>Sælger</TableHead>
                        <TableHead>Telefon</TableHead>
                        <TableHead>Produkt</TableHead>
                        <TableHead>Match</TableHead>
                        <TableHead>Provision</TableHead>
                        <TableHead>Omsætning</TableHead>
                        <TableHead>Virksomhed</TableHead>
                        <TableHead>OPP-nummer</TableHead>
                        <TableHead>Status</TableHead>
                        {uploadType === "both" && <TableHead>Type</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {matchedSales.map((sale, idx) => (
                        <TableRow key={`${sale.saleId}-${sale.targetProductName || idx}`}>
                          <TableCell>{sale.saleDate}</TableCell>
                          <TableCell>{resolve(sale.employee)}</TableCell>
                          <TableCell>{sale.phone || "-"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{sale.realProductName || sale.targetProductName || "-"}</Badge>
                          </TableCell>
                          <TableCell>
                            {sale.matchConfidence === "high" ? (
                              <Badge className="bg-green-100 text-green-800 border-green-300">Dato + Kunde</Badge>
                            ) : sale.matchConfidence === "medium" ? (
                              <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Delvist</Badge>
                            ) : (
                              <Badge variant="outline">✓</Badge>
                            )}
                          </TableCell>
                          <TableCell>{sale.commission != null ? formatCurrency(sale.commission) : "-"}</TableCell>
                          <TableCell>{sale.revenue != null ? formatCurrency(sale.revenue) : "-"}</TableCell>
                          <TableCell>{sale.company || "-"}</TableCell>
                          <TableCell>{sale.oppNumber || "-"}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{sale.currentStatus}</Badge>
                          </TableCell>
                          {uploadType === "both" && (
                            <TableCell>
                              {(() => {
                                const ac = clientConfigs.find(c => c.id === selectedConfigId) || clientConfigs.find(c => c.is_default) || clientConfigs[0];
                                const typeCol = ac?.type_detection_column;
                                const typeVals = (ac?.type_detection_values as string[]) || [];
                                
                                // Check 1: Configured column/values
                                let isConfiguredCancellation = false;
                                if (typeCol && typeVals.length > 0) {
                                  const cellVal = String(getCaseInsensitive(sale.uploadedRowData, typeCol) || "").trim().toLowerCase();
                                  isConfiguredCancellation = typeVals.some(v => v.toLowerCase() === cellVal);
                                }
                                
                                // Check 2: Always check "Annulled Sales" as fallback (OR-logik)
                                const annulledVal = String(getCaseInsensitive(sale.uploadedRowData, "Annulled Sales") || "").trim();
                                const isAnnulledSales = annulledVal !== "" && annulledVal !== "0";
                                
                                const isCancellation = isConfiguredCancellation || isAnnulledSales;
                                return isCancellation
                                  ? <Badge variant="destructive">Annullering</Badge>
                                  : <Badge className="bg-orange-500/15 text-orange-700 border-orange-300">Kurvrettelse</Badge>;
                              })()}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )
            ) : previewTab === "duplicates" ? (
              duplicateSales.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Check className="h-12 w-12 mx-auto mb-4" />
                  <p>Ingen dubletter fundet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Disse salg i databasen er matchet af flere rækker i upload-filen. Gennemgå for at undgå dobbelt-annulleringer.
                  </p>
                  <div className="rounded-md border max-h-96 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Salgs-ID</TableHead>
                          <TableHead>Salgsdato</TableHead>
                          <TableHead>Sælger</TableHead>
                          <TableHead>Telefon</TableHead>
                          <TableHead>Produkt</TableHead>
                          <TableHead>Provision</TableHead>
                          <TableHead>Omsætning</TableHead>
                          <TableHead>Virksomhed</TableHead>
                          <TableHead>OPP-nummer</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {duplicateEntries.map((group, gIdx) => (
                          <React.Fragment key={group[0].saleId}>
                            {gIdx > 0 && (
                              <TableRow>
                                <TableCell colSpan={9} className="py-1 px-0">
                                  <div className="border-t-2 border-dashed border-destructive/30" />
                                </TableCell>
                              </TableRow>
                            )}
                            {group.map((sale, idx) => (
                              <TableRow key={`${sale.saleId}-${idx}`} className="bg-destructive/5">
                                <TableCell className="font-mono text-xs">{sale.saleId.slice(0, 8)}…</TableCell>
                                <TableCell>{sale.saleDate}</TableCell>
                                <TableCell>{resolve(sale.employee)}</TableCell>
                                <TableCell>{sale.phone || "-"}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{sale.realProductName || sale.targetProductName || "-"}</Badge>
                                </TableCell>
                                <TableCell>{sale.commission != null ? formatCurrency(sale.commission) : "-"}</TableCell>
                                <TableCell>{sale.revenue != null ? formatCurrency(sale.revenue) : "-"}</TableCell>
                                <TableCell>{sale.company || "-"}</TableCell>
                                <TableCell>{sale.oppNumber || "-"}</TableCell>
                              </TableRow>
                            ))}
                          </React.Fragment>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )
            ) : previewTab === "seller_unmatched" ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Disse rækker har intet telefonnummer og sælgernavnet er ikke genkendt. Vælg den korrekte medarbejder for at gemme en permanent mapping.
                </p>
                <div className="rounded-md border max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sælgernavn (Excel)</TableHead>
                        <TableHead>Dato</TableHead>
                        <TableHead>Produkt</TableHead>
                        <TableHead className="min-w-[220px]">Vælg medarbejder</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unmatchedSellerRows.map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <Badge variant="outline">{row.excelSellerName}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">{row.excelDate}</TableCell>
                          <TableCell className="text-sm">{row.excelProduct}</TableCell>
                          <TableCell>
                            <Select
                              value={sellerDropdownSelections[row.excelSellerName] || "__none__"}
                              onValueChange={(val) => {
                                if (val !== "__none__") {
                                  setSellerDropdownSelections(prev => ({ ...prev, [row.excelSellerName]: val }));
                                }
                              }}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Vælg medarbejder..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">– Vælg –</SelectItem>
                                {allEmployees.map(emp => (
                                  <SelectItem key={emp.id} value={emp.id}>
                                    {`${emp.first_name || ""} ${emp.last_name || ""}`.trim()}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="default"
                              disabled={!sellerDropdownSelections[row.excelSellerName]}
                              onClick={() => handleSellerMappingSave(row.excelSellerName, sellerDropdownSelections[row.excelSellerName])}
                            >
                              <Save className="h-3.5 w-3.5 mr-1" />
                              Gem
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {unmatchedSellerRows.length === 0 && (
                  <div className="py-4 text-center text-muted-foreground text-sm">
                    Alle sælgere er nu mappet. Kør matching igen for at finde matches.
                  </div>
                )}
                <Button variant="outline" onClick={() => handleMatch()}>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Kør matching igen
                </Button>
              </div>
            ) : (
              <div className="rounded-md border max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {columns.map((col) => (
                        <TableHead key={col}>{col}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unmatchedRows.map((row, idx) => (
                      <TableRow key={idx}>
                        {columns.map((col) => (
                          <TableCell key={col}>{String(row.originalRow[col] ?? "-")}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex gap-2">
              {matchedSales.length > 0 && (
                <Button
                  onClick={() => sendToQueueMutation.mutate()}
                  disabled={sendToQueueMutation.isPending}
                >
                  {sendToQueueMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sender til kø...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Send {matchedSales.length} til godkendelse
                    </>
                  )}
                </Button>
              )}
              <Button variant="outline" onClick={() => setStep("upload")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Tilbage
              </Button>
              <Button variant="outline" onClick={handleReset}>
                Start forfra
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 4: Done */}
      {step === "done" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Check className="h-5 w-5" />
              Sendt til godkendelse
            </CardTitle>
            <CardDescription>
              {matchedSales.length} salg er sendt til godkendelseskøen og afventer godkendelse.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleReset}>
              Upload ny fil
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Edit config dialog */}
      {showEditConfig && clientConfigs.length > 0 && (
        <EditConfigDialog
          open={showEditConfig}
          onOpenChange={setShowEditConfig}
          config={clientConfigs.find(c => c.is_default) || clientConfigs[0]}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["cancellation-upload-configs", selectedClientId] });
          }}
        />
      )}
    </div>
  );
}
