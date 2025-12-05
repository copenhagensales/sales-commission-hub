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
import { Send, Eye } from "lucide-react";

type ContractType = "employment" | "amendment" | "nda" | "company_car" | "termination" | "other";

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

  // Merge placeholders with employee data
  const mergeContent = (content: string): string => {
    const address = [
      employee.address_street,
      employee.address_postal_code,
      employee.address_city,
    ]
      .filter(Boolean)
      .join(", ");

    const replacements: Record<string, string> = {
      employee_name: `${employee.first_name} ${employee.last_name}`,
      cpr_number: employee.cpr_number || "[CPR ikke angivet]",
      address: address || "[Adresse ikke angivet]",
      job_title: employee.job_title || "[Stilling ikke angivet]",
      work_location: employee.work_location || "[Arbejdssted ikke angivet]",
      weekly_hours: employee.weekly_hours?.toString() || "[Timer ikke angivet]",
      salary_type: employee.salary_type ? salaryTypeLabels[employee.salary_type] || employee.salary_type : "[Løntype ikke angivet]",
      salary_amount: employee.salary_amount?.toLocaleString("da-DK") || "[Beløb ikke angivet]",
      vacation_type: employee.vacation_type ? vacationTypeLabels[employee.vacation_type] || employee.vacation_type : "[Ferietype ikke angivet]",
      employment_start_date: employee.employment_start_date
        ? format(new Date(employee.employment_start_date), "d. MMMM yyyy", { locale: da })
        : "[Startdato ikke angivet]",
      standard_start_time: employee.standard_start_time || "[Mødetid ikke angivet]",
      current_date: format(new Date(), "d. MMMM yyyy", { locale: da }),
      effective_date: "[Angiv dato]",
      new_salary_details: "[Angiv nye lønoplysninger]",
      vehicle_details: "[Angiv køretøjsoplysninger]",
    };

    let merged = content;
    Object.entries(replacements).forEach(([key, value]) => {
      merged = merged.replace(new RegExp(`{{${key}}}`, "g"), value);
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
      
      // Create contract
      const { data: contract, error: contractError } = await supabase
        .from("contracts")
        .insert({
          template_id: template.id,
          employee_id: employee.id,
          type: template.type,
          title: customTitle || template.name,
          content: previewContent,
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

                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Medarbejderdata der flettes ind:</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Navn:</span>{" "}
                      {employee.first_name} {employee.last_name}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Stilling:</span>{" "}
                      {employee.job_title || "-"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Arbejdssted:</span>{" "}
                      {employee.work_location || "-"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Løn:</span>{" "}
                      {employee.salary_amount?.toLocaleString("da-DK")} DKK ({employee.salary_type || "-"})
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div
              className="prose prose-sm max-w-none border rounded-lg p-6 bg-background text-foreground dark:prose-invert"
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
                disabled={!selectedTemplateId}
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
