import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Send, Eye, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type ContractType = "employment" | "amendment" | "nda" | "company_car" | "termination" | "other";

// Required fields for contract merge - varies by contract type
interface RequiredField {
  key: keyof EmployeeData;
  label: string;
  check: (employee: EmployeeData) => boolean;
}

// Base fields required for all contracts
const baseRequiredFields: RequiredField[] = [
  { key: "private_email", label: "Privat email", check: (e) => !!e.private_email },
];

// Full employment contract requires all details (salary excluded - added later)
const employmentRequiredFields: RequiredField[] = [
  ...baseRequiredFields,
  { key: "cpr_number", label: "CPR-nummer", check: (e) => !!e.cpr_number },
  { key: "address_street", label: "Adresse (vej)", check: (e) => !!e.address_street },
  { key: "address_postal_code", label: "Postnummer", check: (e) => !!e.address_postal_code },
  { key: "address_city", label: "By", check: (e) => !!e.address_city },
  { key: "job_title", label: "Stilling", check: (e) => !!e.job_title },
  { key: "work_location", label: "Arbejdssted", check: (e) => !!e.work_location },
  { key: "weekly_hours", label: "Ugentlige timer", check: (e) => e.weekly_hours !== null && e.weekly_hours !== undefined },
  { key: "vacation_type", label: "Ferietype", check: (e) => !!e.vacation_type },
  { key: "employment_start_date", label: "Ansættelsesdato", check: (e) => !!e.employment_start_date },
  { key: "standard_start_time", label: "Arbejdstid", check: (e) => !!e.standard_start_time },
];

// Amendment requires identity + salary info
const amendmentRequiredFields: RequiredField[] = [
  ...baseRequiredFields,
  { key: "cpr_number", label: "CPR-nummer", check: (e) => !!e.cpr_number },
  { key: "job_title", label: "Stilling", check: (e) => !!e.job_title },
  { key: "salary_type", label: "Løntype", check: (e) => !!e.salary_type },
  { key: "salary_amount", label: "Lønbeløb", check: (e) => e.salary_amount !== null && e.salary_amount !== undefined },
];

// Company car requires identity + address
const companyCarRequiredFields: RequiredField[] = [
  ...baseRequiredFields,
  { key: "cpr_number", label: "CPR-nummer", check: (e) => !!e.cpr_number },
  { key: "address_street", label: "Adresse (vej)", check: (e) => !!e.address_street },
  { key: "address_postal_code", label: "Postnummer", check: (e) => !!e.address_postal_code },
  { key: "address_city", label: "By", check: (e) => !!e.address_city },
];

// NDA and termination only need basic identity
const minimalRequiredFields: RequiredField[] = [
  ...baseRequiredFields,
  { key: "cpr_number", label: "CPR-nummer", check: (e) => !!e.cpr_number },
];

const getRequiredFieldsForType = (contractType: ContractType | null): RequiredField[] => {
  switch (contractType) {
    case "employment":
      return employmentRequiredFields;
    case "amendment":
      return amendmentRequiredFields;
    case "company_car":
      return companyCarRequiredFields;
    case "nda":
    case "termination":
      return minimalRequiredFields;
    case "other":
    default:
      return baseRequiredFields;
  }
};

const getMissingFields = (employee: EmployeeData, contractType: ContractType | null): string[] => {
  const requiredFields = getRequiredFieldsForType(contractType);
  return requiredFields
    .filter((field) => !field.check(employee))
    .map((field) => field.label);
};

interface EmployeeData {
  id: string;
  first_name: string;
  last_name: string;
  cpr_number: string | null;
  address_street: string | null;
  address_postal_code: string | null;
  address_city: string | null;
  job_title: string | null;
  work_location: string | null;
  weekly_hours: number | null;
  salary_type: string | null;
  salary_amount: number | null;
  vacation_type: string | null;
  employment_start_date: string | null;
  standard_start_time: string | null;
  private_email: string | null;
}

interface ContractTemplate {
  id: string;
  name: string;
  type: ContractType;
  content: string;
}

interface SendContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: EmployeeData;
  managerId?: string;
  managerName?: string;
}

const salaryTypeLabels: Record<string, string> = {
  provision: "Provision",
  fixed: "Fast løn",
  hourly: "Timeløn",
};

const vacationTypeLabels: Record<string, string> = {
  vacation_pay: "Feriepenge",
  vacation_with_pay: "Ferie med løn",
};

export function SendContractDialog({
  open,
  onOpenChange,
  employee,
  managerId,
  managerName,
}: SendContractDialogProps) {
  const queryClient = useQueryClient();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [customTitle, setCustomTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [previewContent, setPreviewContent] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  // Fetch templates
  const { data: templates = [] } = useQuery({
    queryKey: ["contract-templates-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_templates")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as ContractTemplate[];
    },
  });

  // Get selected template's contract type for validation
  const selectedTemplate = templates?.find((t: ContractTemplate) => t.id === selectedTemplateId);
  const selectedContractType: ContractType | null = selectedTemplate?.type || null;

  // Check for missing required fields based on contract type
  const missingFields = getMissingFields(employee, selectedContractType);
  const hasMissingFields = missingFields.length > 0;

  // Merge placeholders with employee data - supports both {{key}} and ${key} syntax
  const mergeContent = (content: string): string => {
    const fullAddress = [
      employee.address_street,
      `${employee.address_postal_code || ""} ${employee.address_city || ""}`.trim(),
    ]
      .filter(Boolean)
      .join(", ");

    const fullName = `${employee.first_name} ${employee.last_name}`;
    const startDateFormatted = employee.employment_start_date
      ? format(new Date(employee.employment_start_date), "d. MMMM yyyy", { locale: da })
      : "[Startdato ikke angivet]";

    // Define all replacement mappings
    const replacements: Record<string, string> = {
      // === ${} STYLE PLACEHOLDERS (from template) ===
      // These are the exact keys from the user's template
      UserFullname: fullName,
      Address: employee.address_street || "[Adresse ikke angivet]",
      Zipcode: employee.address_postal_code || "[Postnummer]",
      City: employee.address_city || "[By]",
      SocialSecurityNumber: employee.cpr_number || "[CPR ikke angivet]",
      UserUserEmail: employee.private_email || "[Email ikke angivet]",
      
      // === {{}} STYLE PLACEHOLDERS ===
      // Medarbejder info
      medarbejder_navn: fullName,
      medarbejder_fornavn: employee.first_name,
      medarbejder_efternavn: employee.last_name,
      fornavn: employee.first_name,
      efternavn: employee.last_name,
      employee_name: fullName,
      navn: fullName,
      
      // CPR
      medarbejder_cpr: employee.cpr_number || "[CPR ikke angivet]",
      cpr: employee.cpr_number || "[CPR ikke angivet]",
      cpr_number: employee.cpr_number || "[CPR ikke angivet]",
      
      // Adresse
      medarbejder_adresse: fullAddress || "[Adresse ikke angivet]",
      medarbejder_vej: employee.address_street || "[Vej ikke angivet]",
      medarbejder_postnummer: employee.address_postal_code || "[Postnummer]",
      medarbejder_by: employee.address_city || "[By]",
      adresse: employee.address_street || "[Adresse ikke angivet]",
      postnummer: employee.address_postal_code || "[Postnummer]",
      by: employee.address_city || "[By]",
      address: fullAddress || "[Adresse ikke angivet]",
      
      // Kontakt
      medarbejder_email: employee.private_email || "[Email ikke angivet]",
      privat_email: employee.private_email || "[Email ikke angivet]",
      email: employee.private_email || "[Email ikke angivet]",
      
      // Ansættelse
      medarbejder_stilling: employee.job_title || "[Stilling ikke angivet]",
      stilling: employee.job_title || "[Stilling ikke angivet]",
      job_title: employee.job_title || "[Stilling ikke angivet]",
      
      medarbejder_arbejdssted: employee.work_location || "[Arbejdssted ikke angivet]",
      arbejdssted: employee.work_location || "[Arbejdssted ikke angivet]",
      work_location: employee.work_location || "[Arbejdssted ikke angivet]",
      
      medarbejder_timer: employee.weekly_hours?.toString() || "[Timer ikke angivet]",
      timer_pr_uge: employee.weekly_hours?.toString() || "[Timer ikke angivet]",
      weekly_hours: employee.weekly_hours?.toString() || "[Timer ikke angivet]",
      timer: employee.weekly_hours?.toString() || "[Timer ikke angivet]",
      
      medarbejder_mødetid: employee.standard_start_time || "[Mødetid ikke angivet]",
      mødetid: employee.standard_start_time || "[Mødetid ikke angivet]",
      arbejdstid: employee.standard_start_time || "[Mødetid ikke angivet]",
      standard_start_time: employee.standard_start_time || "[Mødetid ikke angivet]",
      
      // Startdato - multiple variants
      medarbejder_startdato: startDateFormatted,
      startdato: startDateFormatted,
      ansættelsesdato: startDateFormatted,
      employment_start_date: startDateFormatted,
      tiltrædelsesdato: startDateFormatted,
      
      // Løn
      medarbejder_løntype: employee.salary_type ? salaryTypeLabels[employee.salary_type] || employee.salary_type : "[Løntype ikke angivet]",
      løntype: employee.salary_type ? salaryTypeLabels[employee.salary_type] || employee.salary_type : "[Løntype ikke angivet]",
      salary_type: employee.salary_type ? salaryTypeLabels[employee.salary_type] || employee.salary_type : "[Løntype ikke angivet]",
      
      medarbejder_løn: employee.salary_amount?.toLocaleString("da-DK") || "[Beløb ikke angivet]",
      løn: employee.salary_amount?.toLocaleString("da-DK") || "[Beløb ikke angivet]",
      salary_amount: employee.salary_amount?.toLocaleString("da-DK") || "[Beløb ikke angivet]",
      
      // Ferie
      medarbejder_ferietype: employee.vacation_type ? vacationTypeLabels[employee.vacation_type] || employee.vacation_type : "[Ferietype ikke angivet]",
      ferietype: employee.vacation_type ? vacationTypeLabels[employee.vacation_type] || employee.vacation_type : "[Ferietype ikke angivet]",
      vacation_type: employee.vacation_type ? vacationTypeLabels[employee.vacation_type] || employee.vacation_type : "[Ferietype ikke angivet]",
      
      // Datoer
      dags_dato: format(new Date(), "d. MMMM yyyy", { locale: da }),
      current_date: format(new Date(), "d. MMMM yyyy", { locale: da }),
      dato: format(new Date(), "d. MMMM yyyy", { locale: da }),
      
      // Diverse
      effective_date: "[Angiv dato]",
      new_salary_details: "[Angiv nye lønoplysninger]",
      vehicle_details: "[Angiv køretøjsoplysninger]",
    };

    let merged = content;
    
    // Replace {{key}} style placeholders (case-insensitive)
    Object.entries(replacements).forEach(([key, value]) => {
      merged = merged.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "gi"), value);
    });
    
    // Replace ${key} style placeholders (case-insensitive)
    Object.entries(replacements).forEach(([key, value]) => {
      merged = merged.replace(new RegExp(`\\$\\{\\s*${key}\\s*\\}`, "gi"), value);
    });
    
    return merged;
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setCustomTitle(template.name);
      const merged = mergeContent(template.content);
      setPreviewContent(merged);
    }
  };

  // Send contract mutation
  const sendContractMutation = useMutation({
    mutationFn: async () => {
      const template = templates.find((t) => t.id === selectedTemplateId);
      if (!template) throw new Error("Ingen skabelon valgt");

      const { data: user } = await supabase.auth.getUser();
      
      // Always merge content fresh to ensure employee data is included
      const mergedContent = mergeContent(template.content);
      
      // Create contract
      const { data: contract, error: contractError } = await supabase
        .from("contracts")
        .insert({
          template_id: template.id,
          employee_id: employee.id,
          type: template.type,
          title: customTitle || template.name,
          content: mergedContent,
          status: "pending_employee",
          sent_at: new Date().toISOString(),
          sent_by: user.user?.id,
          notes,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        })
        .select()
        .single();

      if (contractError) throw contractError;

      // Create signature placeholders
      const signatures = [
        {
          contract_id: contract.id,
          signer_type: "employee",
          signer_name: `${employee.first_name} ${employee.last_name}`,
          signer_email: employee.private_email,
          signer_employee_id: employee.id,
        },
      ];

      // Add manager signature if provided
      if (managerId && managerName) {
        signatures.push({
          contract_id: contract.id,
          signer_type: "manager",
          signer_name: managerName,
          signer_email: null,
          signer_employee_id: managerId,
        });
      }

      const { error: sigError } = await supabase
        .from("contract_signatures")
        .insert(signatures);

      if (sigError) throw sigError;

      // Send email notification to employee
      if (employee.private_email) {
        try {
          const { error: emailError } = await supabase.functions.invoke("send-contract-email", {
            body: {
              employeeName: `${employee.first_name} ${employee.last_name}`,
              employeeEmail: employee.private_email,
              contractTitle: customTitle || template.name,
              contractId: contract.id,
              appUrl: window.location.origin,
            },
          });
          
          if (emailError) {
            console.error("Email notification failed:", emailError);
            // Don't throw - contract is created, email is secondary
          }
        } catch (emailErr) {
          console.error("Email notification error:", emailErr);
        }
      }

      return contract;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["employee-contracts"] });
      toast.success("Kontrakt sendt til medarbejder");
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => {
      console.error("Error sending contract:", error);
      toast.error("Kunne ikke sende kontrakt");
    },
  });

  const resetForm = () => {
    setSelectedTemplateId("");
    setCustomTitle("");
    setNotes("");
    setPreviewContent("");
    setShowPreview(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Send kontrakt til {employee.first_name} {employee.last_name}
          </DialogTitle>
        </DialogHeader>

        {!showPreview ? (
          <div className="space-y-4">
            {hasMissingFields && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Manglende stamdata</AlertTitle>
                <AlertDescription>
                  <p className="mb-2">
                    Følgende oplysninger skal udfyldes på medarbejderen før kontrakten kan sendes:
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    {missingFields.map((field) => (
                      <li key={field}>{field}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label>Vælg skabelon</Label>
              <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Vælg en kontraktskabelon..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedTemplateId && (
              <>
                <div className="space-y-2">
                  <Label>Titel (kan tilpasses)</Label>
                  <Input
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Noter (kun intern)</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Tilføj evt. interne noter..."
                  />
                </div>

                <div className="bg-muted/50 rounded-lg p-4 space-y-4">
                  <h4 className="font-medium text-sm">Medarbejderdata der flettes ind:</h4>
                  
                  {/* Personal Info */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Personlig info</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Navn:</span>
                        <span className="font-medium">{employee.first_name} {employee.last_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">CPR:</span>
                        <span className="font-medium">{employee.cpr_number || <span className="text-destructive">Mangler</span>}</span>
                      </div>
                      <div className="flex justify-between col-span-2">
                        <span className="text-muted-foreground">Adresse:</span>
                        <span className="font-medium text-right">
                          {employee.address_street ? (
                            `${employee.address_street}, ${employee.address_postal_code || ""} ${employee.address_city || ""}`.trim()
                          ) : (
                            <span className="text-destructive">Mangler</span>
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Email:</span>
                        <span className="font-medium">{employee.private_email || <span className="text-destructive">Mangler</span>}</span>
                      </div>
                    </div>
                  </div>

                  {/* Employment Info */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ansættelse</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Stilling:</span>
                        <span className="font-medium">{employee.job_title || <span className="text-destructive">Mangler</span>}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Arbejdssted:</span>
                        <span className="font-medium">{employee.work_location || <span className="text-destructive">Mangler</span>}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Mødetid:</span>
                        <span className="font-medium">{employee.standard_start_time || <span className="text-destructive">Mangler</span>}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Timer/uge:</span>
                        <span className="font-medium">{employee.weekly_hours || <span className="text-destructive">Mangler</span>}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Startdato:</span>
                        <span className="font-medium">
                          {employee.employment_start_date 
                            ? format(new Date(employee.employment_start_date), "d. MMM yyyy", { locale: da })
                            : <span className="text-destructive">Mangler</span>
                          }
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Salary Info */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Løn & Ferie</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Løntype:</span>
                        <span className="font-medium">
                          {employee.salary_type ? salaryTypeLabels[employee.salary_type] || employee.salary_type : <span className="text-destructive">Mangler</span>}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Løn:</span>
                        <span className="font-medium">
                          {employee.salary_amount ? `${employee.salary_amount.toLocaleString("da-DK")} DKK` : <span className="text-destructive">Mangler</span>}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Ferietype:</span>
                        <span className="font-medium">
                          {employee.vacation_type ? vacationTypeLabels[employee.vacation_type] || employee.vacation_type : <span className="text-destructive">Mangler</span>}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div
              className="prose prose-sm max-w-none border rounded-lg p-6 bg-white text-black max-h-[60vh] overflow-y-auto"
              dangerouslySetInnerHTML={{ __html: previewContent }}
            />
          </div>
        )}

        <DialogFooter className="gap-2">
          {showPreview ? (
            <>
              <Button variant="outline" onClick={() => setShowPreview(false)}>
                Tilbage
              </Button>
              <Button
                onClick={() => sendContractMutation.mutate()}
                disabled={sendContractMutation.isPending}
              >
                <Send className="h-4 w-4 mr-2" />
                Send kontrakt
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Annuller
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowPreview(true)}
                disabled={!selectedTemplateId || hasMissingFields}
              >
                <Eye className="h-4 w-4 mr-2" />
                Forhåndsvis
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
