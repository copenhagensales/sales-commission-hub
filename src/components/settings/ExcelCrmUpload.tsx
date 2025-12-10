import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Loader2, Check, RefreshCw, Trash2, HelpCircle, Search, AlertCircle, CheckCircle2 } from "lucide-react";
import * as XLSX from "xlsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ParsedRow {
  [key: string]: string | number | null;
}

interface ColumnMapping {
  ordre_id: string;
  opp_number: string;
  external_id: string;
  phone_number: string;
  date: string;
  status: string;
  customer_name: string;
  action_type: string;
  amount_deduct: string;
}

interface ExcelImport {
  id: string;
  filename: string;
  row_count: number;
  uploaded_at: string;
  validation_status: string | null;
  matched_count: number | null;
  cancelled_count: number | null;
}

interface MappingTarget {
  value: keyof ColumnMapping;
  label: string;
  description: string;
  examples: string[];
  category: "match" | "action" | "data";
  priority?: number;
}

const MAPPING_TARGETS: MappingTarget[] = [
  { 
    value: "opp_number", 
    label: "OPP Nummer", 
    description: "TDC's ordrenummer (starter med OPP-). Bruges til at finde salget i systemet.",
    examples: ["OPPNR", "OPP", "OPP Nummer", "Ordrenummer"],
    category: "match",
    priority: 1
  },
  { 
    value: "phone_number", 
    label: "Kundens telefonnummer", 
    description: "Bruges til at matche salg når der ikke er OPP nummer (f.eks. Codan).",
    examples: ["Phone Number", "Telefon", "Tlf", "Mobilnummer"],
    category: "match",
    priority: 2
  },
  { 
    value: "external_id", 
    label: "Externt ID / Ordre ID", 
    description: "ID fra dialeren (Adversus). Bruges som backup-søgning.",
    examples: ["Id", "External ID", "Ordre ID", "Sale ID"],
    category: "match",
    priority: 3
  },
  { 
    value: "date", 
    label: "Salgsdato", 
    description: "Datoen for det oprindelige salg. Hjælper med at matche korrekt salg.",
    examples: ["Dato", "Creation Date", "Salgsdato", "Date"],
    category: "match",
    priority: 4
  },
  { 
    value: "action_type", 
    label: "Handling / Årsag", 
    description: "Hvad skal der ske? F.eks. 'Annullering', 'Nedlagt', 'Retur'.",
    examples: ["Hvilken Type Annullering", "Current Status", "Årsag", "Action"],
    category: "action",
    priority: 1
  },
  { 
    value: "amount_deduct", 
    label: "Clawback beløb", 
    description: "Beløb der skal trækkes fra sælgers provision (valgfrit).",
    examples: ["Hvilket beløb skal trækkes", "Clawback", "Træk beløb"],
    category: "action",
    priority: 2
  },
  { 
    value: "customer_name", 
    label: "Kundenavn", 
    description: "Kundens navn (valgfrit, kun til reference).",
    examples: ["Firmanavn", "Kundenavn", "Company", "Navn"],
    category: "data"
  },
  { 
    value: "status", 
    label: "Status", 
    description: "Nuværende status (valgfrit).",
    examples: ["Status", "Current Status", "State"],
    category: "data"
  },
];

const defaultMapping: ColumnMapping = {
  ordre_id: "",
  opp_number: "",
  external_id: "",
  phone_number: "",
  date: "",
  status: "",
  customer_name: "",
  action_type: "",
  amount_deduct: "",
};

// Auto-suggest mapping based on column names
function suggestMapping(columns: string[]): Partial<ColumnMapping> {
  const suggestions: Partial<ColumnMapping> = {};
  const lowerColumns = columns.map(c => c.toLowerCase().trim());
  
  const mappingRules: { key: keyof ColumnMapping; patterns: string[] }[] = [
    { key: "opp_number", patterns: ["opp", "oppnr", "opp nummer", "opp-"] },
    { key: "phone_number", patterns: ["phone", "telefon", "tlf", "mobil", "phone number"] },
    { key: "external_id", patterns: ["external", "ordre", "order", "sale id"] },
    { key: "date", patterns: ["dato", "date", "creation", "salgsdato"] },
    { key: "action_type", patterns: ["annullering", "status", "handling", "årsag", "action", "type"] },
    { key: "amount_deduct", patterns: ["beløb", "træk", "clawback", "amount"] },
    { key: "customer_name", patterns: ["firma", "kunde", "company", "customer", "navn"] },
  ];
  
  for (const rule of mappingRules) {
    for (let i = 0; i < lowerColumns.length; i++) {
      const col = lowerColumns[i];
      if (rule.patterns.some(p => col.includes(p))) {
        suggestions[rule.key] = columns[i];
        break;
      }
    }
  }
  
  return suggestions;
}

export function ExcelCrmUpload() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>(defaultMapping);
  const [selectedClient, setSelectedClient] = useState<string>("");

  // Fetch clients
  const { data: clients } = useQuery({
    queryKey: ["clients-for-excel"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name").order("name");
      return data || [];
    },
  });

  // Fetch existing imports
  const { data: existingImports, isLoading: loadingImports } = useQuery({
    queryKey: ["crm-excel-imports", selectedClient],
    queryFn: async () => {
      if (!selectedClient) return [];
      const { data, error } = await supabase
        .from("crm_excel_imports" as never)
        .select("*")
        .eq("client_id", selectedClient)
        .order("uploaded_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []) as ExcelImport[];
    },
    enabled: !!selectedClient,
  });

  // Handle file selection with auto-suggest
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<ParsedRow>(sheet, { defval: null });

        if (jsonData.length > 0) {
          const cols = Object.keys(jsonData[0]);
          setColumns(cols);
          setParsedData(jsonData.slice(0, 100));
          
          // Auto-suggest mappings based on column names
          const suggestions = suggestMapping(cols);
          setColumnMapping(prev => ({ ...prev, ...suggestions }));
          
          const suggestedCount = Object.values(suggestions).filter(Boolean).length;
          toast.success(`Indlæst ${jsonData.length} rækker. ${suggestedCount} kolonner auto-mappet.`);
        }
      } catch (err) {
        console.error("Error parsing Excel:", err);
        toast.error("Kunne ikke parse Excel fil");
      }
    };
    reader.readAsBinaryString(selectedFile);
  }, []);

  // Check if at least one match field is mapped
  const hasMatchField = columnMapping.ordre_id || columnMapping.external_id || 
                        columnMapping.opp_number || columnMapping.phone_number;
  
  // Group targets by category
  const matchFields = useMemo(() => 
    MAPPING_TARGETS.filter(t => t.category === "match").sort((a, b) => (a.priority || 99) - (b.priority || 99)), 
  []);
  const actionFields = useMemo(() => 
    MAPPING_TARGETS.filter(t => t.category === "action").sort((a, b) => (a.priority || 99) - (b.priority || 99)), 
  []);
  const dataFields = useMemo(() => 
    MAPPING_TARGETS.filter(t => t.category === "data"), 
  []);
  
  // Get sample value for a column
  const getSampleValue = useCallback((columnName: string) => {
    if (!parsedData.length || !columnName) return null;
    const value = parsedData[0][columnName];
    return value !== null && value !== undefined ? String(value).substring(0, 30) : null;
  }, [parsedData]);

  // Save import mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedClient || !file || parsedData.length === 0) {
        throw new Error("Manglende data");
      }

      // Transform data based on column mapping
      const transformedRows = parsedData.map((row) => ({
        ordre_id: columnMapping.ordre_id ? String(row[columnMapping.ordre_id] || "") : null,
        opp_number: columnMapping.opp_number ? String(row[columnMapping.opp_number] || "") : null,
        external_id: columnMapping.external_id ? String(row[columnMapping.external_id] || "") : null,
        phone_number: columnMapping.phone_number ? String(row[columnMapping.phone_number] || "") : null,
        date: columnMapping.date ? String(row[columnMapping.date] || "") : null,
        status: columnMapping.status ? String(row[columnMapping.status] || "") : null,
        customer_name: columnMapping.customer_name ? String(row[columnMapping.customer_name] || "") : null,
        action_type: columnMapping.action_type ? String(row[columnMapping.action_type] || "") : null,
        amount_deduct: columnMapping.amount_deduct ? String(row[columnMapping.amount_deduct] || "") : null,
        raw_data: row,
      }));

      // Insert main import record
      const { data: importRecord, error: importError } = await supabase
        .from("crm_excel_imports" as never)
        .insert({
          client_id: selectedClient,
          filename: file.name,
          row_count: transformedRows.length,
          column_mapping: columnMapping,
        } as never)
        .select()
        .single();

      if (importError) throw importError;

      const importData = importRecord as { id: string };

      // Insert rows
      const rowsToInsert = transformedRows.map((row) => ({
        import_id: importData.id,
        ...row,
      }));

      const { error: rowsError } = await supabase
        .from("crm_excel_import_rows" as never)
        .insert(rowsToInsert as never);

      if (rowsError) throw rowsError;

      return { importId: importData.id, rowCount: transformedRows.length };
    },
    onSuccess: (data) => {
      toast.success(`Importeret ${data.rowCount} rækker`);
      queryClient.invalidateQueries({ queryKey: ["crm-excel-imports"] });
      setFile(null);
      setParsedData([]);
      setColumns([]);
      setColumnMapping(defaultMapping);
    },
    onError: (error) => toast.error(`Fejl: ${error.message}`),
  });

  // Validate mutation
  const validateMutation = useMutation({
    mutationFn: async (importId: string) => {
      const { data, error } = await supabase.functions.invoke("validate-excel-import", {
        body: { import_id: importId, client_id: selectedClient },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(
        `Validering færdig: ${data.matched} matchet, ${data.cancelled} annulleret, ${data.clawbacks_created || 0} clawbacks`,
        { duration: 6000 }
      );
      queryClient.invalidateQueries({ queryKey: ["crm-excel-imports"] });
    },
    onError: (error) => toast.error(`Valideringsfejl: ${error.message}`),
  });

  // Delete import mutation
  const deleteMutation = useMutation({
    mutationFn: async (importId: string) => {
      await supabase.from("crm_excel_import_rows" as never).delete().eq("import_id", importId);
      const { error } = await supabase.from("crm_excel_imports" as never).delete().eq("id", importId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Import slettet");
      queryClient.invalidateQueries({ queryKey: ["crm-excel-imports"] });
    },
    onError: (error) => toast.error(`Fejl: ${error.message}`),
  });


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Excel CRM Validering
        </CardTitle>
        <CardDescription>
          Upload Excel/CSV med annulleringer. Søger via External ID → OPP → Telefon+Dato.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Client Selection */}
        <div className="space-y-2">
          <Label>Vælg Kunde</Label>
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Vælg kunde..." />
            </SelectTrigger>
            <SelectContent>
              {clients?.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedClient && (
          <>
            {/* File Upload */}
            <div className="space-y-2">
              <Label>Upload Excel/CSV</Label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 px-4 py-2 border border-dashed rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                  <Upload className="h-4 w-4" />
                  <span className="text-sm">{file ? file.name : "Vælg fil..."}</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                {file && (
                  <Badge variant="secondary">
                    {parsedData.length} rækker
                  </Badge>
                )}
              </div>
            </div>

            {/* Column Mapping - Redesigned */}
            {columns.length > 0 && (
              <TooltipProvider>
                <div className="space-y-6 p-4 border rounded-lg bg-muted/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-lg flex items-center gap-2">
                        <Search className="h-5 w-5 text-primary" />
                        Kolonne Mapping
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Forbind dine Excel kolonner med systemet. Grønne felter er auto-foreslået.
                      </p>
                    </div>
                    {hasMatchField ? (
                      <Badge variant="default" className="bg-green-600 hover:bg-green-700 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Klar til import
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Vælg mindst ét søgefelt
                      </Badge>
                    )}
                  </div>
                  
                  {/* STEP 1: Match Fields - CRITICAL */}
                  <div className="space-y-3 p-4 border-2 border-primary/30 rounded-lg bg-primary/5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">1</div>
                      <div>
                        <h5 className="font-medium">Søgefelter - Sådan finder vi salget</h5>
                        <p className="text-xs text-muted-foreground">Vælg mindst én kolonne så vi kan finde det rigtige salg i systemet</p>
                      </div>
                    </div>
                    
                    <div className="grid gap-4 mt-3">
                      {matchFields.map((target) => {
                        const currentValue = columnMapping[target.value];
                        const sampleValue = currentValue ? getSampleValue(currentValue) : null;
                        const isMapped = !!currentValue;
                        
                        return (
                          <div 
                            key={target.value} 
                            className={`p-3 rounded-lg border-2 transition-all ${
                              isMapped 
                                ? 'border-green-500 bg-green-50 dark:bg-green-950/30' 
                                : 'border-border bg-background hover:border-muted-foreground/50'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Label className="font-medium">{target.label}</Label>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="max-w-xs">
                                      <p className="font-medium mb-1">{target.label}</p>
                                      <p className="text-xs text-muted-foreground mb-2">{target.description}</p>
                                      <p className="text-xs"><strong>Eksempler:</strong> {target.examples.join(", ")}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                  {isMapped && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                                </div>
                                <p className="text-xs text-muted-foreground">{target.description}</p>
                                {sampleValue && (
                                  <p className="text-xs mt-1 font-mono bg-muted px-2 py-0.5 rounded inline-block">
                                    Eks: "{sampleValue}"
                                  </p>
                                )}
                              </div>
                              <Select
                                value={currentValue || "__none__"}
                                onValueChange={(val) =>
                                  setColumnMapping((prev) => ({ ...prev, [target.value]: val === "__none__" ? "" : val }))
                                }
                              >
                                <SelectTrigger className={`w-48 ${isMapped ? 'border-green-500' : ''}`}>
                                  <SelectValue placeholder="Vælg kolonne..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">-- Ingen --</SelectItem>
                                  {columns.map((col) => (
                                    <SelectItem key={col} value={col}>
                                      {col}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* STEP 2: Action Fields */}
                  <div className="space-y-3 p-4 border rounded-lg bg-background">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-bold text-sm">2</div>
                      <div>
                        <h5 className="font-medium">Handling - Hvad skal der ske?</h5>
                        <p className="text-xs text-muted-foreground">Angiv hvad der skal ske med de matchede salg</p>
                      </div>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-3 mt-3">
                      {actionFields.map((target) => {
                        const currentValue = columnMapping[target.value];
                        const sampleValue = currentValue ? getSampleValue(currentValue) : null;
                        const isMapped = !!currentValue;
                        
                        return (
                          <div 
                            key={target.value} 
                            className={`p-3 rounded-lg border transition-all ${
                              isMapped ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-border'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <Label className="text-sm font-medium">{target.label}</Label>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <p className="text-xs">{target.description}</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            <Select
                              value={currentValue || "__none__"}
                              onValueChange={(val) =>
                                setColumnMapping((prev) => ({ ...prev, [target.value]: val === "__none__" ? "" : val }))
                              }
                            >
                              <SelectTrigger className={`w-full ${isMapped ? 'border-blue-500' : ''}`}>
                                <SelectValue placeholder="Vælg kolonne..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">-- Ingen --</SelectItem>
                                {columns.map((col) => (
                                  <SelectItem key={col} value={col}>
                                    {col}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {sampleValue && (
                              <p className="text-xs mt-1 font-mono text-muted-foreground">→ "{sampleValue}"</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* STEP 3: Optional Data Fields - Collapsed by default */}
                  <details className="group">
                    <summary className="cursor-pointer p-3 rounded-lg border hover:bg-muted/50 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-bold">3</div>
                      <span className="text-sm font-medium">Ekstra data (valgfrit)</span>
                      <span className="text-xs text-muted-foreground ml-2">Klik for at udvide</span>
                    </summary>
                    <div className="mt-3 grid md:grid-cols-2 gap-3 p-3">
                      {dataFields.map((target) => {
                        const currentValue = columnMapping[target.value];
                        
                        return (
                          <div key={target.value} className="space-y-1">
                            <Label className="text-xs">{target.label}</Label>
                            <Select
                              value={currentValue || "__none__"}
                              onValueChange={(val) =>
                                setColumnMapping((prev) => ({ ...prev, [target.value]: val === "__none__" ? "" : val }))
                              }
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Vælg..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">-- Ingen --</SelectItem>
                                {columns.map((col) => (
                                  <SelectItem key={col} value={col}>
                                    {col}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })}
                    </div>
                  </details>

                  {/* Preview Table */}
                  <div className="mt-4">
                    <h5 className="text-sm font-medium mb-2">Preview (første 5 rækker)</h5>
                    <div className="overflow-x-auto border rounded">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {columns.slice(0, 6).map((col) => (
                              <TableHead key={col} className="text-xs whitespace-nowrap">
                                {col}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {parsedData.slice(0, 5).map((row, idx) => (
                            <TableRow key={idx}>
                              {columns.slice(0, 6).map((col) => (
                                <TableCell key={col} className="text-xs">
                                  {String(row[col] ?? "")}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Save Button */}
                  <Button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending || !hasMatchField}
                    className="w-full"
                    size="lg"
                  >
                    {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Check className="mr-2 h-4 w-4" />
                    Gem Import
                  </Button>
                </div>
              </TooltipProvider>
            )}

            {/* Existing Imports */}
            <div className="space-y-2">
              <h4 className="font-medium">Tidligere Imports</h4>
              {loadingImports ? (
                <div className="text-sm text-muted-foreground">Indlæser...</div>
              ) : existingImports && existingImports.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fil</TableHead>
                      <TableHead>Rækker</TableHead>
                      <TableHead>Uploadet</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Handlinger</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {existingImports.map((imp) => (
                      <TableRow key={imp.id}>
                        <TableCell className="font-mono text-xs">{imp.filename}</TableCell>
                        <TableCell>{imp.row_count}</TableCell>
                        <TableCell className="text-xs">
                          {new Date(imp.uploaded_at).toLocaleString("da-DK")}
                        </TableCell>
                        <TableCell>
                          {imp.validation_status === "completed" ? (
                            <Badge variant="default" className="bg-green-600">
                              <Check className="h-3 w-3 mr-1" />
                              {imp.matched_count} matchet, {imp.cancelled_count} ann.
                            </Badge>
                          ) : imp.validation_status === "processing" ? (
                            <Badge variant="secondary">
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Behandler...
                            </Badge>
                          ) : (
                            <Badge variant="outline">Afventer</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => validateMutation.mutate(imp.id)}
                            disabled={validateMutation.isPending || imp.validation_status === "completed"}
                          >
                            {validateMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                            <span className="ml-1">Valider</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMutation.mutate(imp.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">Ingen imports endnu.</p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
