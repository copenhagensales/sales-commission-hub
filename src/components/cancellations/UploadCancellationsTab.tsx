import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseExcelFile } from "@/utils/excel";
import { Button } from "@/components/ui/button";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, Check, X, Loader2, AlertCircle } from "lucide-react";
import { CancellationHistoryTable } from "./CancellationHistoryTable";
import { useAuth } from "@/hooks/useAuth";

interface ParsedRow {
  phone?: string;
  company?: string;
  originalRow: Record<string, unknown>;
}

interface MatchedSale {
  saleId: string;
  phone: string;
  company: string;
  saleDate: string;
  employee: string;
  currentStatus: string;
}

export function UploadCancellationsTab() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [phoneColumn, setPhoneColumn] = useState<string>("__none__");
  const [companyColumn, setCompanyColumn] = useState<string>("__none__");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [matchedSales, setMatchedSales] = useState<MatchedSale[]>([]);
  const [isMatching, setIsMatching] = useState(false);
  const [step, setStep] = useState<"upload" | "mapping" | "preview" | "done">("upload");

  // Fetch clients
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-cancellations-upload"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
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
        setParsedData(jsonData.map(row => ({ originalRow: row })));
        setStep("mapping");

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
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
  });

  const handleMatch = async () => {
    if (phoneColumn === "__none__" && companyColumn === "__none__") {
      toast({
        title: "Vælg kolonner",
        description: "Vælg mindst én kolonne at matche på (telefon eller virksomhed).",
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
      // Extract values from parsed data
      const phones: string[] = [];
      const companies: string[] = [];

      parsedData.forEach(row => {
        if (phoneColumn !== "__none__" && row.originalRow[phoneColumn]) {
          phones.push(String(row.originalRow[phoneColumn]).replace(/\D/g, ""));
        }
        if (companyColumn !== "__none__" && row.originalRow[companyColumn]) {
          companies.push(String(row.originalRow[companyColumn]).toLowerCase().trim());
        }
      });

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

      // Query sales based on phone numbers and/or company names
      let query = supabase
        .from("sales")
        .select(`
          id,
          sale_datetime,
          customer_phone,
          customer_company,
          validation_status,
          agent_name
        `)
        .in("client_campaign_id", campaignIds)
        .neq("validation_status", "cancelled");

      if (phones.length > 0 && companies.length > 0) {
        // Match on either phone or company
        const phoneConditions = phones.map(p => `customer_phone.ilike.%${p}%`).join(",");
        const companyConditions = companies.map(c => `customer_company.ilike.%${c}%`).join(",");
        query = query.or(`${phoneConditions},${companyConditions}`);
      } else if (phones.length > 0) {
        query = query.or(phones.map(p => `customer_phone.ilike.%${p}%`).join(","));
      } else if (companies.length > 0) {
        query = query.or(companies.map(c => `customer_company.ilike.%${c}%`).join(","));
      }

      const { data: matchedData, error } = await query.limit(500);

      if (error) throw error;

      const matched: MatchedSale[] = (matchedData || []).map(sale => ({
        saleId: sale.id,
        phone: sale.customer_phone || "",
        company: sale.customer_company || "",
        saleDate: sale.sale_datetime || "",
        employee: sale.agent_name || "Ukendt",
        currentStatus: sale.validation_status || "pending",
      }));

      setMatchedSales(matched);
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

  // Bulk cancel mutation
  const bulkCancelMutation = useMutation({
    mutationFn: async () => {
      const saleIds = matchedSales.map(s => s.saleId);
      
      // Update sales in batches of 50
      for (let i = 0; i < saleIds.length; i += 50) {
        const batch = saleIds.slice(i, i + 50);
        const { error } = await supabase
          .from("sales")
          .update({ validation_status: "cancelled" })
          .in("id", batch);
        if (error) throw error;
      }

      // Log the import
      if (currentEmployee?.id && file) {
        await supabase.from("cancellation_imports").insert({
          uploaded_by: currentEmployee.id,
          file_name: file.name,
          file_size_bytes: file.size,
          status: "completed",
          rows_processed: parsedData.length,
          rows_matched: matchedSales.length,
        });
      }

      return { count: saleIds.length };
    },
    onSuccess: ({ count }) => {
      toast({
        title: "Annullering fuldført",
        description: `${count} salg er blevet annulleret.`,
      });
      queryClient.invalidateQueries({ queryKey: ["cancellation-imports-history"] });
      setStep("done");
    },
    onError: (error: Error) => {
      toast({
        title: "Fejl ved annullering",
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
    setSelectedClientId("");
    setMatchedSales([]);
    setStep("upload");
  };

  return (
    <div className="space-y-6">
      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle>Upload annulleringsfil</CardTitle>
            <CardDescription>
              Upload en Excel-fil (.xlsx) med annulleringer. Filen skal indeholde telefonnumre eller virksomhedsnavne.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}

      {step === "mapping" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Kolonnemapping
            </CardTitle>
            <CardDescription>
              Vælg hvilke kolonner der indeholder telefonnumre og/eller virksomhedsnavne til matching.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Vælg kunde</Label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vælg kunde..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Telefonkolonne (valgfri)</Label>
                <Select value={phoneColumn} onValueChange={setPhoneColumn}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vælg kolonne..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Ingen</SelectItem>
                    {columns.map((col) => (
                      <SelectItem key={col} value={col}>
                        {col}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Virksomhedskolonne (valgfri)</Label>
                <Select value={companyColumn} onValueChange={setCompanyColumn}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vælg kolonne..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Ingen</SelectItem>
                    {columns.map((col) => (
                      <SelectItem key={col} value={col}>
                        {col}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleMatch} disabled={isMatching}>
                {isMatching ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Matcher...
                  </>
                ) : (
                  "Find matchende salg"
                )}
              </Button>
              <Button variant="outline" onClick={handleReset}>
                Start forfra
              </Button>
            </div>

            {parsedData.length > 0 && (
              <div className="text-sm text-muted-foreground">
                {parsedData.length} rækker i filen
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              Bekræft annullering
            </CardTitle>
            <CardDescription>
              Følgende {matchedSales.length} salg vil blive annulleret. Gennemse listen inden du fortsætter.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {matchedSales.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <X className="h-12 w-12 mx-auto mb-4" />
                <p>Ingen matchende salg fundet</p>
              </div>
            ) : (
              <>
                <div className="rounded-md border max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Salgsdato</TableHead>
                        <TableHead>Sælger</TableHead>
                        <TableHead>Telefon</TableHead>
                        <TableHead>Virksomhed</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {matchedSales.map((sale) => (
                        <TableRow key={sale.saleId}>
                          <TableCell>{sale.saleDate}</TableCell>
                          <TableCell>{sale.employee}</TableCell>
                          <TableCell>{sale.phone || "-"}</TableCell>
                          <TableCell>{sale.company || "-"}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{sale.currentStatus}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    onClick={() => bulkCancelMutation.mutate()}
                    disabled={bulkCancelMutation.isPending}
                  >
                    {bulkCancelMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Annullerer...
                      </>
                    ) : (
                      <>
                        <X className="h-4 w-4 mr-2" />
                        Annuller {matchedSales.length} salg
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => setStep("mapping")}>
                    Tilbage
                  </Button>
                  <Button variant="outline" onClick={handleReset}>
                    Start forfra
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {step === "done" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Check className="h-5 w-5" />
              Annullering fuldført
            </CardTitle>
            <CardDescription>
              {matchedSales.length} salg er blevet markeret som annulleret.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleReset}>
              Upload ny fil
            </Button>
          </CardContent>
        </Card>
      )}

      {/* History section */}
      <CancellationHistoryTable />
    </div>
  );
}
