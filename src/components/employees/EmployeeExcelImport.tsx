import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet, Check, AlertCircle, Loader2 } from "lucide-react";
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
  isValid: boolean;
  errors: string[];
}

const COLUMN_MAPPING: Record<string, keyof Omit<ParsedEmployee, "isValid" | "errors">> = {
  // First name variations
  "fornavn": "first_name",
  "first_name": "first_name",
  "firstname": "first_name",
  "first name": "first_name",
  "navn": "first_name",
  // Last name variations
  "efternavn": "last_name",
  "last_name": "last_name",
  "lastname": "last_name",
  "last name": "last_name",
  // Email variations
  "email": "private_email",
  "e-mail": "private_email",
  "mail": "private_email",
  "privat email": "private_email",
  "private_email": "private_email",
  "privatmail": "private_email",
  // Phone variations
  "telefon": "private_phone",
  "tlf": "private_phone",
  "tlf.": "private_phone",
  "mobil": "private_phone",
  "mobilnummer": "private_phone",
  "phone": "private_phone",
  "private_phone": "private_phone",
  "telefonnummer": "private_phone",
  // Job title variations
  "stilling": "job_title",
  "titel": "job_title",
  "jobtitel": "job_title",
  "job_title": "job_title",
  "job title": "job_title",
  "rolle": "job_title",
  // Department variations
  "afdeling": "department",
  "department": "department",
  "team": "department",
  // Start date variations
  "startdato": "employment_start_date",
  "start dato": "employment_start_date",
  "ansættelsesdato": "employment_start_date",
  "employment_start_date": "employment_start_date",
  "start": "employment_start_date",
  // Salary type variations
  "løntype": "salary_type",
  "salary_type": "salary_type",
  "lønform": "salary_type",
  // Salary amount variations
  "løn": "salary_amount",
  "salary_amount": "salary_amount",
  "timeløn": "salary_amount",
  "månedsløn": "salary_amount",
  // Weekly hours variations
  "timer": "weekly_hours",
  "weekly_hours": "weekly_hours",
  "timer/uge": "weekly_hours",
  "ugentlige timer": "weekly_hours",
  // Work time variations
  "arbejdstid": "standard_start_time",
  "standard_start_time": "standard_start_time",
  "mødetid": "standard_start_time",
  // Work location variations
  "arbejdssted": "work_location",
  "work_location": "work_location",
  "lokation": "work_location",
  "kontor": "work_location",
};

export function EmployeeExcelImport() {
  const [open, setOpen] = useState(false);
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

        const employees: ParsedEmployee[] = jsonData.map((row) => {
          const employee: ParsedEmployee = {
            first_name: "",
            last_name: "",
            isValid: true,
            errors: [],
          };

          // Map columns
          Object.entries(row).forEach(([key, value]) => {
            const normalizedKey = key.toLowerCase().trim();
            const mappedField = COLUMN_MAPPING[normalizedKey];
            if (mappedField && value !== undefined && value !== null && value !== "") {
              const strValue = String(value);
              switch (mappedField) {
                case "salary_amount":
                case "weekly_hours":
                  employee[mappedField] = Number(value);
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
                case "first_name":
                  employee.first_name = strValue;
                  break;
                case "last_name":
                  employee.last_name = strValue;
                  break;
                case "private_email":
                  employee.private_email = strValue;
                  break;
                case "private_phone":
                  employee.private_phone = strValue;
                  break;
                case "job_title":
                  employee.job_title = strValue;
                  break;
                case "department":
                  employee.department = strValue;
                  break;
                case "employment_start_date":
                  employee.employment_start_date = strValue;
                  break;
                case "standard_start_time":
                  employee.standard_start_time = strValue;
                  break;
                case "work_location":
                  employee.work_location = strValue;
                  break;
              }
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
        setFileName(file.name);
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
      setOpen(false);
      setParsedData([]);
      setFileName(null);
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

  const validCount = parsedData.filter((e) => e.isValid).length;
  const invalidCount = parsedData.length - validCount;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" /> Importer fra Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importer medarbejdere fra Excel</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {!fileName ? (
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-2">
                Klik for at vælge Excel-fil (.xlsx, .xls)
              </p>
              <p className="text-xs text-muted-foreground">
                Kolonner: fornavn, efternavn, email, telefon, stilling, afdeling, startdato, løntype, løn, timer, arbejdstid
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-green-500" />
                  <span className="font-medium">{fileName}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setParsedData([]);
                    setFileName(null);
                  }}
                >
                  Vælg anden fil
                </Button>
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

              <div className="flex-1 overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Fornavn</TableHead>
                      <TableHead>Efternavn</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Stilling</TableHead>
                      <TableHead>Afdeling</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map((employee, index) => (
                      <TableRow key={index} className={!employee.isValid ? "bg-destructive/10" : ""}>
                        <TableCell>
                          {employee.isValid ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          )}
                        </TableCell>
                        <TableCell>{employee.first_name || "-"}</TableCell>
                        <TableCell>{employee.last_name || "-"}</TableCell>
                        <TableCell>{employee.private_email || "-"}</TableCell>
                        <TableCell>{employee.job_title || "-"}</TableCell>
                        <TableCell>{employee.department || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Annuller
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
