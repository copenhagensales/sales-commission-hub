import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Check, X, ArrowRight } from "lucide-react";
import * as XLSX from "xlsx";

// Excel fields based on uploaded file
const EMPLOYEE_MASTER_DATA_FIELDS = [
  { field: "first_name", label: "Fornavn", required: true },
  { field: "last_name", label: "Efternavn", required: true },
  { field: "private_email", label: "Email", required: false },
  { field: "private_phone", label: "Telefon", required: false },
  { field: "cpr_number", label: "CPR-nummer", required: false },
  { field: "bank_reg_number", label: "Reg. nr.", required: false },
  { field: "bank_account_number", label: "Kontonummer", required: false },
  { field: "job_title", label: "Stilling", required: false },
  { field: "department", label: "Afdeling", required: false },
  { field: "employment_start_date", label: "Startdato", required: false },
  { field: "salary_type", label: "Løntype", required: false },
  { field: "salary_amount", label: "Løn", required: false },
  { field: "weekly_hours", label: "Timer/uge", required: false },
  { field: "standard_start_time", label: "Arbejdstid", required: false },
  { field: "work_location", label: "Arbejdssted", required: false },
  { field: "address_street", label: "Adresse", required: false },
  { field: "address_postal_code", label: "Postnummer", required: false },
  { field: "address_city", label: "By", required: false },
];

// Auto-suggest mapping based on column name
const suggestMapping = (columnName: string): string | null => {
  const normalized = columnName.toLowerCase().trim();
  
  const mappings: Record<string, string> = {
    "fornavn": "first_name", "first_name": "first_name", "firstname": "first_name", "navn": "first_name",
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
    "adresse": "address_street", "gade": "address_street",
    "postnummer": "address_postal_code", "postnr": "address_postal_code",
    "by": "address_city", "city": "address_city",
  };
  
  return mappings[normalized] || null;
};

export default function ExcelFieldMatcher() {
  const [excelColumns, setExcelColumns] = useState<string[]>([]);
  const [sampleData, setSampleData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadExcelFile = async () => {
      try {
        const response = await fetch("/temp/employee-import.xlsx");
        const arrayBuffer = await response.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

        if (jsonData.length > 0) {
          setExcelColumns(Object.keys(jsonData[0]));
          setSampleData(jsonData.slice(0, 5)); // First 5 rows as sample
        }
        setLoading(false);
      } catch (err) {
        setError("Kunne ikke læse Excel-filen");
        setLoading(false);
      }
    };

    loadExcelFile();
  }, []);

  if (loading) {
    return <div className="p-8 text-center">Indlæser Excel-fil...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-destructive">{error}</div>;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Excel Feltmatcher</h1>
        <p className="text-muted-foreground mt-2">
          Analyse af din Excel-fil og matchning til stamdata-felter
        </p>
      </div>

      {/* Excel Columns Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Kolonner i din Excel-fil ({excelColumns.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {excelColumns.map((col) => {
              const match = suggestMapping(col);
              const matchInfo = match ? EMPLOYEE_MASTER_DATA_FIELDS.find(f => f.field === match) : null;
              return (
                <Badge
                  key={col}
                  variant={matchInfo ? "default" : "secondary"}
                  className="text-sm"
                >
                  {col}
                  {matchInfo && (
                    <span className="ml-1 opacity-75">→ {matchInfo.label}</span>
                  )}
                </Badge>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Mapping Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Feltmatchning</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Excel-kolonne</TableHead>
                <TableHead className="w-16"></TableHead>
                <TableHead>Stamdata-felt</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {excelColumns.map((col) => {
                const match = suggestMapping(col);
                const matchInfo = match ? EMPLOYEE_MASTER_DATA_FIELDS.find(f => f.field === match) : null;
                return (
                  <TableRow key={col}>
                    <TableCell className="font-medium">{col}</TableCell>
                    <TableCell>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                    <TableCell>
                      {matchInfo ? (
                        <span className="text-primary font-medium">
                          {matchInfo.label}
                          {matchInfo.required && <span className="text-destructive ml-1">*</span>}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Ingen automatisk matchning</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {matchInfo ? (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          <Check className="h-3 w-3 mr-1" />
                          Matchet
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-orange-500 border-orange-500">
                          <X className="h-3 w-3 mr-1" />
                          Manuel
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Available Master Data Fields */}
      <Card>
        <CardHeader>
          <CardTitle>Tilgængelige stamdata-felter</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Felt</TableHead>
                <TableHead>Database-navn</TableHead>
                <TableHead>Påkrævet</TableHead>
                <TableHead>Matchet fra Excel</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {EMPLOYEE_MASTER_DATA_FIELDS.map((field) => {
                const matchedColumn = excelColumns.find(col => suggestMapping(col) === field.field);
                return (
                  <TableRow key={field.field}>
                    <TableCell className="font-medium">{field.label}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">{field.field}</TableCell>
                    <TableCell>
                      {field.required ? (
                        <Badge variant="destructive">Ja</Badge>
                      ) : (
                        <Badge variant="secondary">Nej</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {matchedColumn ? (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          <Check className="h-3 w-3 mr-1" />
                          {matchedColumn}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Sample Data */}
      <Card>
        <CardHeader>
          <CardTitle>Eksempeldata (første 5 rækker)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                {excelColumns.map(col => (
                  <TableHead key={col}>{col}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sampleData.map((row, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  {excelColumns.map(col => (
                    <TableCell key={col} className="max-w-[200px] truncate">
                      {row[col] !== undefined && row[col] !== null ? String(row[col]) : "-"}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
