import { useState, useCallback, useEffect } from "react";
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
import { Upload, FileSpreadsheet, Check, X, Loader2, AlertCircle, Save, Settings } from "lucide-react";
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
  oppNumber: string;
  saleDate: string;
  employee: string;
  currentStatus: string;
  uploadedRowData: Record<string, unknown>;
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
}

interface UploadCancellationsTabProps {
  clientId: string;
}

function getCaseInsensitive(obj: Record<string, unknown> | undefined, key: string): unknown {
  if (!obj) return undefined;
  const lowerKey = key.toLowerCase();
  for (const k of Object.keys(obj)) {
    if (k.toLowerCase() === lowerKey) return obj[k];
  }
  return undefined;
}

export function UploadCancellationsTab({ clientId: selectedClientId }: UploadCancellationsTabProps) {
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
  const [uploadType, setUploadType] = useState<"cancellation" | "basket_difference">("cancellation");
  const [step, setStep] = useState<"upload" | "mapping" | "preview" | "done">("upload");
  const [configName, setConfigName] = useState("");
  const [showSaveConfig, setShowSaveConfig] = useState(false);

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
      return (data || []) as UploadConfig[];
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
    if (phoneColumn === "__none__" && companyColumn === "__none__" && oppColumn === "__none__" && memberNumberColumn === "__none__") {
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
      // Extract values from parsed data
      const phones: string[] = [];
      const companies: string[] = [];
      const oppNumbers: string[] = [];
      const memberNumbers: string[] = [];

      parsedData.forEach(row => {
        if (phoneColumn !== "__none__" && row.originalRow[phoneColumn]) {
          phones.push(String(row.originalRow[phoneColumn]).replace(/\D/g, ""));
        }
        if (companyColumn !== "__none__" && row.originalRow[companyColumn]) {
          companies.push(String(row.originalRow[companyColumn]).toLowerCase().trim());
        }
        if (oppColumn !== "__none__" && row.originalRow[oppColumn]) {
          const oppVal = String(row.originalRow[oppColumn]).trim();
          oppNumbers.push(oppVal);
        }
        if (memberNumberColumn !== "__none__" && row.originalRow[memberNumberColumn]) {
          memberNumbers.push(String(row.originalRow[memberNumberColumn]).trim());
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

      // Fetch all non-cancelled sales for this client and match client-side
      // (avoids PostgREST URL length limits with large OR condition lists)
      let allMatched: any[] = [];
      const existingIds = new Set<string>();

      // Fetch candidate sales in pages (Supabase default limit = 1000)
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

      const candidateSales = (phones.length > 0 || companies.length > 0 || oppNumbers.length > 0 || memberNumbers.length > 0)
        ? await fetchCandidateSales()
        : [];

      // Build lookup sets for client-side matching
      const phoneSet = new Set(phones.map(p => p.replace(/\D/g, "")));
      const companySet = new Set(companies);

      // Match by phone or company client-side
      for (const sale of candidateSales) {
        if (existingIds.has(sale.id)) continue;
        const salePhone = (sale.customer_phone || "").replace(/\D/g, "");
        const saleCompany = (sale.customer_company || "").toLowerCase().trim();

        let matched = false;
        if (salePhone && phoneSet.has(salePhone)) matched = true;
        if (!matched && saleCompany && companySet.has(saleCompany)) matched = true;

        if (matched) {
          allMatched.push(sale);
          existingIds.add(sale.id);
        }
      }

      // Helper to extract OPP number from raw_payload
      const extractOpp = (rawPayload: unknown): string => {
        if (!rawPayload || typeof rawPayload !== 'object') return "";
        const rp = rawPayload as Record<string, unknown>;
        if (rp['legacy_opp_number']) return String(rp['legacy_opp_number']);
        const fields = rp['leadResultFields'] as Record<string, unknown> | undefined;
        if (fields?.['OPP nr']) return String(fields['OPP nr']);
        if (fields?.['OPP-nr']) return String(fields['OPP-nr']);
        const data = rp['leadResultData'] as Array<{label?: string; value?: string}> | undefined;
        if (Array.isArray(data)) {
          const found = data.find(d => d.label === 'OPP nr' || d.label === 'OPP-nr');
          if (found?.value) return String(found.value);
        }
        return "";
      };

      // If OPP numbers specified, fetch recent sales and match OPP client-side from raw_payload
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

      // Match by member number from normalized_data
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

      // Build a lookup from OPP/phone/company → uploaded row for associating uploaded data
      // Collect ALL rows per OPP (not just last one) to preserve product details
      const uploadedRowsByOpp = new Map<string, Record<string, unknown>[]>();
      const uploadedRowByPhone = new Map<string, Record<string, unknown>>();
      const uploadedRowByCompany = new Map<string, Record<string, unknown>>();
      const uploadedRowByMemberNr = new Map<string, Record<string, unknown>>();
      
      parsedData.forEach(row => {
        if (oppColumn !== "__none__" && row.originalRow[oppColumn]) {
          const key = String(row.originalRow[oppColumn]).toUpperCase().trim();
          const arr = uploadedRowsByOpp.get(key) || [];
          arr.push(row.originalRow);
          uploadedRowsByOpp.set(key, arr);
        }
        if (phoneColumn !== "__none__" && row.originalRow[phoneColumn]) {
          uploadedRowByPhone.set(String(row.originalRow[phoneColumn]).replace(/\D/g, ""), row.originalRow);
        }
        if (companyColumn !== "__none__" && row.originalRow[companyColumn]) {
          uploadedRowByCompany.set(String(row.originalRow[companyColumn]).toLowerCase().trim(), row.originalRow);
        }
        if (memberNumberColumn !== "__none__" && row.originalRow[memberNumberColumn]) {
          uploadedRowByMemberNr.set(String(row.originalRow[memberNumberColumn]).trim(), row.originalRow);
        }
      });

      // Consolidate all rows for an OPP into one object with _product_rows
      const consolidateOppRows = (rows: Record<string, unknown>[]): Record<string, unknown> => {
        // Find the "Total" row (if any) for financial totals, otherwise use the last row
        const totalRow = rows.find(r => {
          const produktVal = String(r["Produkt"] || r["produkt"] || "").trim();
          return produktVal.toLowerCase() === "total";
        }) || rows[rows.length - 1];

        // Product rows = all rows except the Total row
        const productRows = rows.filter(r => {
          const produktVal = String(r["Produkt"] || r["produkt"] || "").trim();
          return produktVal.toLowerCase() !== "total" && produktVal !== "";
        });

        return {
          ...totalRow,
          _product_rows: productRows.length > 0 ? productRows : undefined,
        };
      };

      // Build reverse lookup: value → parsedData index for tracking which rows got consumed
      const indexByOpp = new Map<string, number[]>();
      const indexByPhone = new Map<string, number>();
      const indexByCompany = new Map<string, number>();
      const indexByMemberNr = new Map<string, number>();
      parsedData.forEach((row, idx) => {
        if (oppColumn !== "__none__" && row.originalRow[oppColumn]) {
          const key = String(row.originalRow[oppColumn]).toUpperCase().trim();
          const arr = indexByOpp.get(key) || [];
          arr.push(idx);
          indexByOpp.set(key, arr);
        }
        if (phoneColumn !== "__none__" && row.originalRow[phoneColumn]) {
          indexByPhone.set(String(row.originalRow[phoneColumn]).replace(/\D/g, ""), idx);
        }
        if (companyColumn !== "__none__" && row.originalRow[companyColumn]) {
          indexByCompany.set(String(row.originalRow[companyColumn]).toLowerCase().trim(), idx);
        }
        if (memberNumberColumn !== "__none__" && row.originalRow[memberNumberColumn]) {
          indexByMemberNr.set(String(row.originalRow[memberNumberColumn]).trim(), idx);
        }
      });

      const matchedIndices = new Set<number>();

      const findUploadedRow = (sale: any): Record<string, unknown> => {
        const saleOpp = extractOpp(sale.raw_payload).toUpperCase().trim();
        if (saleOpp && uploadedRowsByOpp.has(saleOpp)) {
          // Mark all indices for this OPP as matched
          (indexByOpp.get(saleOpp) || []).forEach(i => matchedIndices.add(i));
          return consolidateOppRows(uploadedRowsByOpp.get(saleOpp)!);
        }
        const salePhone = (sale.customer_phone || "").replace(/\D/g, "");
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
        // Match by member number
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

      const matched: MatchedSale[] = allMatched.map(sale => ({
        saleId: sale.id,
        phone: sale.customer_phone || "",
        company: sale.customer_company || "",
        oppNumber: extractOpp(sale.raw_payload),
        saleDate: sale.sale_datetime || "",
        employee: sale.agent_name || "Ukendt",
        currentStatus: sale.validation_status || "pending",
        uploadedRowData: findUploadedRow(sale),
      }));

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
      const saleIds = matchedSales.map(s => s.saleId);

      // Identify unmatched uploaded rows using index-based tracking from handleMatch
      const unmatchedRows = parsedData
        .filter((_, idx) => !matchedRowIndices.has(idx))
        .map(r => r.originalRow);

      // Log the import first
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
            upload_type: uploadType,
            config_id: configId,
            unmatched_rows: unmatchedRows.length > 0 ? unmatchedRows : null,
          } as any)
          .select("id")
          .single();
        if (importError) throw importError;
        importId = importData.id;
      }

      if (!importId) throw new Error("Kunne ikke oprette import-log");

      // Build a map of saleId → uploadedRowData
      const uploadedDataMap = new Map(matchedSales.map(s => [s.saleId, s.uploadedRowData]));

      // Build OPP group lookup for each sale
      const oppGroupMap = new Map<string, string>();
      for (const sale of matchedSales) {
        if (sale.oppNumber) {
          oppGroupMap.set(sale.saleId, sale.oppNumber);
        }
      }

      // Insert queue items in batches of 50
      for (let i = 0; i < saleIds.length; i += 50) {
        const batch = saleIds.slice(i, i + 50).map(saleId => ({
          import_id: importId!,
          sale_id: saleId,
          upload_type: uploadType,
          status: "pending",
          uploaded_data: uploadedDataMap.get(saleId) || null,
          opp_group: oppGroupMap.get(saleId) || null,
          client_id: selectedClientId || null,
        }));
        const { error } = await supabase
          .from("cancellation_queue")
          .insert(batch as any);
        if (error) throw error;
      }

      return { count: saleIds.length };
    },
    onSuccess: ({ count }) => {
      toast({
        title: "Sendt til godkendelse",
        description: `${count} salg er sendt til godkendelseskøen.`,
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
    setUploadType("cancellation");
    setSelectedConfigId("__none__");
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Upload-type</Label>
                <Select value={uploadType} onValueChange={(v) => setUploadType(v as "cancellation" | "basket_difference")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cancellation">Annullering</SelectItem>
                    <SelectItem value="basket_difference">Kurv difference</SelectItem>
                  </SelectContent>
                </Select>
              </div>



              {clientConfigs.length > 0 && (
                <div className="space-y-2">
                  <Label>Opsætning</Label>
                  <Select value={selectedConfigId} onValueChange={handleConfigChange}>
                    <SelectTrigger><SelectValue placeholder="Vælg opsætning..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Manuel</SelectItem>
                      {clientConfigs.map((cfg) => (
                        <SelectItem key={cfg.id} value={cfg.id}>
                          {cfg.name} {cfg.is_default ? "(standard)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Telefonkolonne (valgfri)</Label>
                <Select value={phoneColumn} onValueChange={setPhoneColumn}>
                  <SelectTrigger><SelectValue placeholder="Vælg kolonne..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Ingen</SelectItem>
                    {columns.map((col) => (<SelectItem key={col} value={col}>{col}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Virksomhedskolonne (valgfri)</Label>
                <Select value={companyColumn} onValueChange={setCompanyColumn}>
                  <SelectTrigger><SelectValue placeholder="Vælg kolonne..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Ingen</SelectItem>
                    {columns.map((col) => (<SelectItem key={col} value={col}>{col}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>OPP-kolonne (valgfri)</Label>
                <Select value={oppColumn} onValueChange={setOppColumn}>
                  <SelectTrigger><SelectValue placeholder="Vælg kolonne..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Ingen</SelectItem>
                    {columns.map((col) => (<SelectItem key={col} value={col}>{col}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Medlemsnr.-kolonne (valgfri)</Label>
                <Select value={memberNumberColumn} onValueChange={setMemberNumberColumn}>
                  <SelectTrigger><SelectValue placeholder="Vælg kolonne..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Ingen</SelectItem>
                    {columns.map((col) => (<SelectItem key={col} value={col}>{col}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Produktkolonne (valgfri)</Label>
                <Select value={productColumn} onValueChange={setProductColumn}>
                  <SelectTrigger><SelectValue placeholder="Vælg kolonne..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Ingen</SelectItem>
                    {columns.map((col) => (<SelectItem key={col} value={col}>{col}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Omsætningskolonne (valgfri)</Label>
                <Select value={revenueColumn} onValueChange={setRevenueColumn}>
                  <SelectTrigger><SelectValue placeholder="Vælg kolonne..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Ingen</SelectItem>
                    {columns.map((col) => (<SelectItem key={col} value={col}>{col}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Provisionskolonne (valgfri)</Label>
                <Select value={commissionColumn} onValueChange={setCommissionColumn}>
                  <SelectTrigger><SelectValue placeholder="Vælg kolonne..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Ingen</SelectItem>
                    {columns.map((col) => (<SelectItem key={col} value={col}>{col}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Save config section */}
            <div className="flex items-center gap-2 pt-2 border-t">
              {!showSaveConfig ? (
                <Button variant="outline" size="sm" onClick={() => setShowSaveConfig(true)} disabled={!selectedClientId}>
                  <Save className="h-4 w-4 mr-2" />
                  Gem som opsætning
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Navn på opsætning..."
                    value={configName}
                    onChange={(e) => setConfigName(e.target.value)}
                    className="border rounded px-3 py-1.5 text-sm bg-background"
                  />
                  <Button size="sm" onClick={() => saveConfigMutation.mutate()} disabled={saveConfigMutation.isPending || !configName.trim()}>
                    {saveConfigMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gem"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setShowSaveConfig(false); setConfigName(""); }}>
                    Annuller
                  </Button>
                </div>
              )}
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
              Bekræft og send til godkendelse
            </CardTitle>
            <CardDescription>
              Følgende {matchedSales.length} salg vil blive sendt til godkendelseskøen som "{uploadType === 'cancellation' ? 'Annullering' : 'Kurv difference'}".
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
                         <TableHead>OPP-nummer</TableHead>
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
                          <TableCell>{sale.oppNumber || "-"}</TableCell>
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
                        Send {matchedSales.length} salg til godkendelse
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

      {/* History section */}
      <CancellationHistoryTable />
    </div>
  );
}
