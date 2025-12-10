import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Loader2, Check, RefreshCw, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";

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

const MAPPING_TARGETS = [
  { value: "ordre_id", label: "Ordre ID (adversus_external_id)", category: "match" },
  { value: "external_id", label: "Dialer/External ID", category: "match" },
  { value: "opp_number", label: "OPP Nummer", category: "match" },
  { value: "phone_number", label: "Teléfono Cliente", category: "match" },
  { value: "date", label: "Fecha Venta", category: "match" },
  { value: "status", label: "Status (legacy)", category: "data" },
  { value: "customer_name", label: "Kundenavn", category: "data" },
  { value: "action_type", label: "Tipo Acción (Annullering/Retur)", category: "action" },
  { value: "amount_deduct", label: "Monto a descontar (Clawback)", category: "action" },
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

  // Handle file selection
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
          toast.success(`Parsed ${jsonData.length} rækker fra Excel`);
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

  const matchFields = MAPPING_TARGETS.filter(t => t.category === "match");
  const dataFields = MAPPING_TARGETS.filter(t => t.category === "data");
  const actionFields = MAPPING_TARGETS.filter(t => t.category === "action");

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

            {/* Column Mapping */}
            {columns.length > 0 && (
              <div className="space-y-4 p-4 border rounded-md bg-muted/30">
                <h4 className="font-medium">Kolonne Mapping</h4>
                
                {/* Match Fields */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                    Søgefelter (prioritet: External ID → OPP → Telefon+Dato)
                  </Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {matchFields.map((target) => (
                      <div key={target.value} className="space-y-1">
                        <Label className="text-xs">{target.label}</Label>
                        <Select
                          value={columnMapping[target.value as keyof ColumnMapping]}
                          onValueChange={(val) =>
                            setColumnMapping((prev) => ({ ...prev, [target.value]: val }))
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Vælg..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">-- Ingen --</SelectItem>
                            {columns.map((col) => (
                              <SelectItem key={col} value={col}>
                                {col}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Fields */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                    Aktion & Clawback
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    {actionFields.map((target) => (
                      <div key={target.value} className="space-y-1">
                        <Label className="text-xs">{target.label}</Label>
                        <Select
                          value={columnMapping[target.value as keyof ColumnMapping]}
                          onValueChange={(val) =>
                            setColumnMapping((prev) => ({ ...prev, [target.value]: val }))
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Vælg..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">-- Ingen --</SelectItem>
                            {columns.map((col) => (
                              <SelectItem key={col} value={col}>
                                {col}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Data Fields */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                    Ekstra data (valgfrit)
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    {dataFields.map((target) => (
                      <div key={target.value} className="space-y-1">
                        <Label className="text-xs">{target.label}</Label>
                        <Select
                          value={columnMapping[target.value as keyof ColumnMapping]}
                          onValueChange={(val) =>
                            setColumnMapping((prev) => ({ ...prev, [target.value]: val }))
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Vælg..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">-- Ingen --</SelectItem>
                            {columns.map((col) => (
                              <SelectItem key={col} value={col}>
                                {col}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>

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
                >
                  {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Gem Import
                </Button>
                {!hasMatchField && (
                  <p className="text-xs text-destructive">
                    Map mindst én søgefelt (External ID, OPP, eller Telefon)
                  </p>
                )}
              </div>
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
