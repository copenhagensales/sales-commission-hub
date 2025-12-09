import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileSpreadsheet, Check, AlertCircle, Loader2, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";

interface ParsedEmployee {
  first_name: string;
  last_name: string;
  private_email?: string;
  private_phone?: string;
  job_title?: string;
  department?: string;
  employment_start_date?: string;
  salary_type?: "provision" | "fixed" | "hourly";
  salary_amount?: number;
  weekly_hours?: number;
  standard_start_time?: string;
  work_location?: string;
  cpr_number?: string;
  bank_reg_number?: string;
  bank_account_number?: string;
  isValid: boolean;
  errors: string[];
}

type FieldKey = keyof Omit<ParsedEmployee, "isValid" | "errors">;

const FIELD_OPTIONS: { value: FieldKey | "skip"; label: string }[] = [
  { value: "skip", label: "Spring over" },
  { value: "first_name", label: "Fornavn *" },
  { value: "last_name", label: "Efternavn *" },
  { value: "private_email", label: "Email" },
  { value: "private_phone", label: "Telefon" },
  { value: "cpr_number", label: "CPR-nummer" },
  { value: "bank_reg_number", label: "Reg. nr." },
  { value: "bank_account_number", label: "Kontonummer" },
  { value: "job_title", label: "Stilling" },
  { value: "department", label: "Afdeling" },
  { value: "employment_start_date", label: "Startdato" },
  { value: "salary_type", label: "Løntype" },
  { value: "salary_amount", label: "Løn" },
  { value: "weekly_hours", label: "Timer/uge" },
  { value: "standard_start_time", label: "Arbejdstid" },
  { value: "work_location", label: "Arbejdssted" },
];

// Auto-suggest mapping based on column name
const suggestMapping = (columnName: string): FieldKey | "skip" => {
  const normalized = columnName.toLowerCase().trim();
  
  const mappings: Record<string, FieldKey> = {
    "fornavn": "first_name", "first_name": "first_name", "firstname": "first_name",
    "efternavn": "last_name", "last_name": "last_name", "lastname": "last_name",
    "email": "private_email", "e-mail": "private_email", "mail": "private_email",
    "telefon": "private_phone", "tlf": "private_phone", "mobil": "private_phone", "phone": "private_phone",
    "cpr": "cpr_number", "cpr-nummer": "cpr_number", "cpr nummer": "cpr_number", "personnummer": "cpr_number",
    "reg": "bank_reg_number", "reg.": "bank_reg_number", "reg. nr.": "bank_reg_number", "regnr": "bank_reg_number", "reg nr": "bank_reg_number",
    "konto": "bank_account_number", "kontonummer": "bank_account_number", "konto nr": "bank_account_number", "kontonr": "bank_account_number",
    "stilling": "job_title", "titel": "job_title", "jobtitel": "job_title", "rolle": "job_title",
    "afdeling": "department", "department": "department", "team": "department",
    "startdato": "employment_start_date", "ansættelsesdato": "employment_start_date",
    "løntype": "salary_type", "lønform": "salary_type",
    "løn": "salary_amount", "timeløn": "salary_amount", "månedsløn": "salary_amount",
    "timer": "weekly_hours", "timer/uge": "weekly_hours",
    "arbejdstid": "standard_start_time", "mødetid": "standard_start_time",
    "arbejdssted": "work_location", "lokation": "work_location", "kontor": "work_location",
  };
  
  return mappings[normalized] || "skip";
};

export function EmployeeExcelImport() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"upload" | "mapping" | "preview">("upload");
  const [rawData, setRawData] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, FieldKey | "skip">>({});
  const [parsedData, setParsedData] = useState<ParsedEmployee[]>([]);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const parseExcelFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

        if (jsonData.length === 0) {
          toast({ title: "Tom fil", description: "Excel-filen indeholder ingen data", variant: "destructive" });
          return;
        }

        // Extract column names from first row
        const cols = Object.keys(jsonData[0]);
        setColumns(cols);
        setRawData(jsonData);
        setFileName(file.name);

        // Auto-suggest mappings
        const initialMapping: Record<string, FieldKey | "skip"> = {};
        cols.forEach((col) => {
          initialMapping[col] = suggestMapping(col);
        });
        setColumnMapping(initialMapping);
        setStep("mapping");
      } catch (error) {
        toast({
          title: "Fejl ved læsning af fil",
          description: "Kunne ikke læse Excel-filen. Tjek formatet.",
          variant: "destructive",
        });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      parseExcelFile(file);
    }
  };

  // Helper to parse various date formats to YYYY-MM-DD
  const parseDate = (value: unknown): string | undefined => {
    if (!value) return undefined;
    const strValue = String(value).trim();
    
    // Already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(strValue)) {
      return strValue;
    }
    
    // DD-MM-YYYY or DD/MM/YYYY format
    const dmyMatch = strValue.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      const year = dmyMatch[3];
      return `${year}-${month}-${day}`;
    }
    
    // DD.MM.YYYY format
    const dotMatch = strValue.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (dotMatch) {
      const day = dotMatch[1].padStart(2, '0');
      const month = dotMatch[2].padStart(2, '0');
      const year = dotMatch[3];
      return `${year}-${month}-${day}`;
    }
    
    return undefined;
  };

  const applyMapping = () => {
    const employees: ParsedEmployee[] = rawData.map((row) => {
      const employee: ParsedEmployee = {
        first_name: "",
        last_name: "",
        isValid: true,
        errors: [],
      };

      // Apply user-defined mapping
      Object.entries(columnMapping).forEach(([column, field]) => {
        if (field === "skip") return;
        
        const value = row[column];
        if (value === undefined || value === null || value === "") return;

        const strValue = String(value).trim();
        switch (field) {
          case "salary_amount":
          case "weekly_hours":
            employee[field] = Number(value);
            break;
          case "salary_type":
            const val = strValue.toLowerCase();
            if (val === "provision" || val === "fixed" || val === "hourly") {
              employee.salary_type = val;
            } else if (val === "fast") {
              employee.salary_type = "fixed";
            } else if (val === "time" || val === "timeløn") {
              employee.salary_type = "hourly";
            }
            break;
          case "employment_start_date":
            employee.employment_start_date = parseDate(value);
            break;
          default:
            employee[field] = strValue;
        }
      });

      // Validate
      if (!employee.first_name) {
        employee.isValid = false;
        employee.errors.push("Mangler fornavn");
      }
      if (!employee.last_name) {
        employee.isValid = false;
        employee.errors.push("Mangler efternavn");
      }

      return employee;
    });

    setParsedData(employees);
    setStep("preview");
  };

  const handleImport = async () => {
    const validEmployees = parsedData.filter((e) => e.isValid);
    if (validEmployees.length === 0) {
      toast({ title: "Ingen gyldige medarbejdere at importere", variant: "destructive" });
      return;
    }

    setImporting(true);
    try {
      const employeesToInsert = validEmployees.map((e) => ({
        first_name: e.first_name,
        last_name: e.last_name,
        private_email: e.private_email || null,
        private_phone: e.private_phone || null,
        cpr_number: e.cpr_number || null,
        bank_reg_number: e.bank_reg_number || null,
        bank_account_number: e.bank_account_number || null,
        job_title: e.job_title || null,
        department: e.department || null,
        employment_start_date: e.employment_start_date || new Date().toISOString().split("T")[0],
        salary_type: e.salary_type || null,
        salary_amount: e.salary_amount || null,
        weekly_hours: e.weekly_hours || 37.5,
        standard_start_time: e.standard_start_time || null,
        work_location: e.work_location || "København V",
        is_active: true,
        address_country: "Danmark",
      }));

      const { error } = await supabase.from("employee_master_data").insert(employeesToInsert);

      if (error) throw error;

      toast({
        title: "Import gennemført",
        description: `${validEmployees.length} medarbejdere importeret`,
      });
      queryClient.invalidateQueries({ queryKey: ["employee-master-data"] });
      resetState();
    } catch (error) {
      toast({
        title: "Fejl ved import",
        description: error instanceof Error ? error.message : "Kunne ikke importere medarbejdere",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const resetState = () => {
    setOpen(false);
    setStep("upload");
    setRawData([]);
    setColumns([]);
    setColumnMapping({});
    setParsedData([]);
    setFileName(null);
  };

  const validCount = parsedData.filter((e) => e.isValid).length;
  const invalidCount = parsedData.length - validCount;

  // Check if required fields are mapped
  const hasFirstName = Object.values(columnMapping).includes("first_name");
  const hasLastName = Object.values(columnMapping).includes("last_name");
  const canProceed = hasFirstName && hasLastName;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetState();
      else setOpen(true);
    }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" /> Importer fra Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === "upload" && "Vælg Excel-fil"}
            {step === "mapping" && "Vælg kolonnemapping"}
            {step === "preview" && "Forhåndsvisning"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {step === "upload" && (
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-2">
                Klik for at vælge Excel-fil (.xlsx, .xls)
              </p>
              <p className="text-xs text-muted-foreground">
                Du kan selv vælge hvilke kolonner der skal bruges
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          )}

          {step === "mapping" && (
            <>
              <p className="text-sm text-muted-foreground">
                Vælg hvilke felter hver kolonne skal mappes til. Felter markeret med * er påkrævede.
              </p>
              
              <div className="flex-1 overflow-auto space-y-3 pr-2">
                {columns.map((column) => (
                  <div key={column} className="flex items-center gap-4 py-2 border-b border-border/50">
                    <div className="w-1/3 font-medium truncate" title={column}>
                      {column}
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="w-1/2">
                      <Select
                        value={columnMapping[column] || "skip"}
                        onValueChange={(value) => setColumnMapping({ ...columnMapping, [column]: value as FieldKey | "skip" })}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover z-50">
                          {FIELD_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>

              {!canProceed && (
                <p className="text-sm text-destructive">
                  Du skal mappe mindst én kolonne til Fornavn og én til Efternavn
                </p>
              )}

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep("upload")}>
                  Tilbage
                </Button>
                <Button onClick={applyMapping} disabled={!canProceed}>
                  Fortsæt til forhåndsvisning
                </Button>
              </div>
            </>
          )}

          {step === "preview" && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-green-500" />
                  <span className="font-medium">{fileName}</span>
                </div>
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-1 text-green-600">
                    <Check className="h-4 w-4" />
                    {validCount} gyldige
                  </div>
                  {invalidCount > 0 && (
                    <div className="flex items-center gap-1 text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      {invalidCount} med fejl
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8 sticky left-0 bg-background"></TableHead>
                      <TableHead className="sticky left-8 bg-background">Fornavn</TableHead>
                      <TableHead>Efternavn</TableHead>
                      <TableHead>CPR</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Telefon</TableHead>
                      <TableHead>Reg. nr.</TableHead>
                      <TableHead>Kontonr.</TableHead>
                      <TableHead>Stilling</TableHead>
                      <TableHead>Afdeling</TableHead>
                      <TableHead>Startdato</TableHead>
                      <TableHead>Arbejdssted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map((employee, index) => (
                      <TableRow key={index} className={!employee.isValid ? "bg-destructive/10" : ""}>
                        <TableCell className="sticky left-0 bg-background">
                          {employee.isValid ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          )}
                        </TableCell>
                        <TableCell className="sticky left-8 bg-background">{employee.first_name || "-"}</TableCell>
                        <TableCell>{employee.last_name || "-"}</TableCell>
                        <TableCell>{employee.cpr_number || "-"}</TableCell>
                        <TableCell>{employee.private_email || "-"}</TableCell>
                        <TableCell>{employee.private_phone || "-"}</TableCell>
                        <TableCell>{employee.bank_reg_number || "-"}</TableCell>
                        <TableCell>{employee.bank_account_number || "-"}</TableCell>
                        <TableCell>{employee.job_title || "-"}</TableCell>
                        <TableCell>{employee.department || "-"}</TableCell>
                        <TableCell>{employee.employment_start_date || "-"}</TableCell>
                        <TableCell>{employee.work_location || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep("mapping")}>
                  Tilbage til mapping
                </Button>
                <Button onClick={handleImport} disabled={importing || validCount === 0}>
                  {importing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importerer...
                    </>
                  ) : (
                    `Importer ${validCount} medarbejdere`
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
