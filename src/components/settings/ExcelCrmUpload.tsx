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
import { Upload, FileSpreadsheet, Loader2, Check, X, RefreshCw, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";

interface ParsedRow {
  [key: string]: string | number | null;
}

interface ColumnMapping {
  ordre_id: string;
  opp_number: string;
  status: string;
  customer_name: string;
}

const MAPPING_TARGETS = [
  { value: "ordre_id", label: "Ordre ID (adversus_external_id)" },
  { value: "opp_number", label: "OPP Nummer" },
  { value: "status", label: "Status" },
  { value: "customer_name", label: "Kundenavn" },
];

export function ExcelCrmUpload() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    ordre_id: "",
    opp_number: "",
    status: "",
    customer_name: "",
  });
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
      const { data } = await supabase
        .from("crm_excel_imports")
        .select("*")
        .eq("client_id", selectedClient)
        .order("uploaded_at", { ascending: false })
        .limit(10);
      return data || [];
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
          setParsedData(jsonData.slice(0, 100)); // Preview first 100 rows
          toast.success(`Parsed ${jsonData.length} rows from Excel`);
        }
      } catch (err) {
        console.error("Error parsing Excel:", err);
        toast.error("Kunne ikke parse Excel fil");
      }
    };
    reader.readAsBinaryString(selectedFile);
  }, []);

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
        status: columnMapping.status ? String(row[columnMapping.status] || "") : null,
        customer_name: columnMapping.customer_name ? String(row[columnMapping.customer_name] || "") : null,
        raw_data: row,
      }));

      // Insert main import record
      const { data: importRecord, error: importError } = await supabase
        .from("crm_excel_imports")
        .insert({
          client_id: selectedClient,
          filename: file.name,
          row_count: transformedRows.length,
          column_mapping: columnMapping,
        })
        .select()
        .single();

      if (importError) throw importError;

      // Insert rows
      const rowsToInsert = transformedRows.map((row) => ({
        import_id: importRecord.id,
        ...row,
      }));

      const { error: rowsError } = await supabase.from("crm_excel_import_rows").insert(rowsToInsert);

      if (rowsError) throw rowsError;

      return { importId: importRecord.id, rowCount: transformedRows.length };
    },
    onSuccess: (data) => {
      toast.success(`Importeret ${data.rowCount} rækker`);
      queryClient.invalidateQueries({ queryKey: ["crm-excel-imports"] });
      // Reset form
      setFile(null);
      setParsedData([]);
      setColumns([]);
      setColumnMapping({ ordre_id: "", opp_number: "", status: "", customer_name: "" });
    },
    onError: (error) => toast.error(`Fejl: ${error.message}`),
  });

  // Validate mutation - match against sales
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
        `Validering færdig: ${data.matched} matchet, ${data.cancelled} annulleret`,
        { duration: 6000 }
      );
      queryClient.invalidateQueries({ queryKey: ["crm-excel-imports"] });
    },
    onError: (error) => toast.error(`Valideringsfejl: ${error.message}`),
  });

  // Delete import mutation
  const deleteMutation = useMutation({
    mutationFn: async (importId: string) => {
      // Delete rows first
      await supabase.from("crm_excel_import_rows").delete().eq("import_id", importId);
      // Then delete import
      const { error } = await supabase.from("crm_excel_imports").delete().eq("id", importId);
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
          Upload Excel/CSV med annulleringer og valider mod salgsdata.
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
              ))
              }
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
                <div className="grid grid-cols-2 gap-4">
                  {MAPPING_TARGETS.map((target) => (
                    <div key={target.value} className="space-y-1">
                      <Label className="text-xs">{target.label}</Label>
                      <Select
                        value={columnMapping[target.value as keyof ColumnMapping]}
                        onValueChange={(val) =>
                          setColumnMapping((prev) => ({ ...prev, [target.value]: val }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Vælg kolonne..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">-- Ingen --</SelectItem>
                          {columns.map((col) => (
                            <SelectItem key={col} value={col}>
                              {col}
                            </SelectItem>
                          ))
                          }
                        </SelectContent>
                      </Select>
                    </div>
                  ))
                  }
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
                          ))
                          }
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedData.slice(0, 5).map((row, idx) => (
                          <TableRow key={idx}>
                            {columns.slice(0, 6).map((col) => (
                              <TableCell key={col} className="text-xs">
                                {String(row[col] ?? "")}
                              </TableCell>
                            ))
                            }
                          </TableRow>
                        ))
                        }
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Save Button */}
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || !columnMapping.ordre_id}
                >
                  {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Gem Import
                </Button>
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
                    {existingImports.map((imp: {
                      id: string;
                      filename: string;
                      row_count: number;
                      uploaded_at: string;
                      validation_status: string | null;
                      matched_count: number | null;
                      cancelled_count: number | null;
                    }) => (
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
                    ))
                    }
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
