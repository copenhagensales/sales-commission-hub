import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { FileText, Plus, Send, Eye, Check, X, Clock, Edit, Trash2, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RichTextEditor } from "@/components/contracts/RichTextEditor";

type ContractType = "employment" | "amendment" | "nda" | "company_car" | "termination" | "other";
type ContractStatus = "draft" | "pending_employee" | "pending_manager" | "signed" | "rejected" | "expired";

interface ContractTemplate {
  id: string;
  name: string;
  type: ContractType;
  description: string | null;
  content: string;
  is_active: boolean;
  version: number;
  created_at: string;
}

interface Contract {
  id: string;
  template_id: string | null;
  employee_id: string;
  type: ContractType;
  title: string;
  content: string;
  status: ContractStatus;
  sent_at: string | null;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
  employee?: {
    first_name: string;
    last_name: string;
    private_email: string | null;
  };
  signatures?: {
    signer_type: string;
    signer_name: string;
    signed_at: string | null;
  }[];
}

const contractTypeLabels: Record<ContractType, string> = {
  employment: "Ansættelse",
  amendment: "Tillæg",
  nda: "NDA",
  company_car: "Firmabil",
  termination: "Opsigelse",
  other: "Andet",
};

const statusLabels: Record<ContractStatus, string> = {
  draft: "Kladde",
  pending_employee: "Afventer medarbejder",
  pending_manager: "Afventer leder",
  signed: "Underskrevet",
  rejected: "Afvist",
  expired: "Udløbet",
};

const statusColors: Record<ContractStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_employee: "bg-amber-100 text-amber-800",
  pending_manager: "bg-blue-100 text-blue-800",
  signed: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  expired: "bg-gray-100 text-gray-800",
};

export default function Contracts() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ContractTemplate | null>(null);
  const [previewContract, setPreviewContract] = useState<Contract | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: "",
    type: "employment" as ContractType,
    description: "",
    content: "",
  });

  // Fetch templates
  const { data: templates = [] } = useQuery({
    queryKey: ["contract-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_templates")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as ContractTemplate[];
    },
  });

  // Fetch all contracts with employee info
  const { data: contracts = [] } = useQuery({
    queryKey: ["contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select(`
          *,
          employee:employee_master_data(first_name, last_name, private_email),
          signatures:contract_signatures(signer_type, signer_name, signed_at)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Contract[];
    },
  });

  // Save template mutation
  const saveTemplateMutation = useMutation({
    mutationFn: async (template: typeof templateForm & { id?: string }) => {
      if (template.id) {
        const { error } = await supabase
          .from("contract_templates")
          .update({
            name: template.name,
            type: template.type,
            description: template.description,
            content: template.content,
          })
          .eq("id", template.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("contract_templates")
          .insert({
            name: template.name,
            type: template.type,
            description: template.description,
            content: template.content,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-templates"] });
      setTemplateDialogOpen(false);
      setEditingTemplate(null);
      setTemplateForm({ name: "", type: "employment", description: "", content: "" });
      toast.success("Skabelon gemt");
    },
    onError: () => toast.error("Kunne ikke gemme skabelon"),
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("contract_templates")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-templates"] });
      toast.success("Skabelon deaktiveret");
    },
  });

  const handleEditTemplate = (template: ContractTemplate) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      type: template.type,
      description: template.description || "",
      content: template.content,
    });
    setTemplateDialogOpen(true);
  };

  const handleNewTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({ name: "", type: "employment", description: "", content: "" });
    setTemplateDialogOpen(true);
  };

  const filteredContracts = contracts.filter((c) => {
    const employeeName = `${c.employee?.first_name || ""} ${c.employee?.last_name || ""}`.toLowerCase();
    return (
      employeeName.includes(searchTerm.toLowerCase()) ||
      c.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const pendingCount = contracts.filter((c) => c.status === "pending_employee" || c.status === "pending_manager").length;
  const signedCount = contracts.filter((c) => c.status === "signed").length;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Kontrakter</h1>
            <p className="text-muted-foreground">Administrer skabeloner og send kontrakter til medarbejdere</p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{contracts.length}</p>
                  <p className="text-sm text-muted-foreground">Kontrakter i alt</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-100 rounded-lg">
                  <Clock className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pendingCount}</p>
                  <p className="text-sm text-muted-foreground">Afventer underskrift</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <Check className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{signedCount}</p>
                  <p className="text-sm text-muted-foreground">Underskrevet</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{templates.filter((t) => t.is_active).length}</p>
                  <p className="text-sm text-muted-foreground">Aktive skabeloner</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="contracts">
          <TabsList>
            <TabsTrigger value="contracts">Kontrakter</TabsTrigger>
            <TabsTrigger value="templates">Skabeloner</TabsTrigger>
          </TabsList>

          <TabsContent value="contracts" className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Søg efter medarbejder eller titel..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medarbejder</TableHead>
                    <TableHead>Titel</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sendt</TableHead>
                    <TableHead>Underskrifter</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContracts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Ingen kontrakter fundet
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredContracts.map((contract) => (
                      <TableRow key={contract.id}>
                        <TableCell className="font-medium">
                          {contract.employee?.first_name} {contract.employee?.last_name}
                        </TableCell>
                        <TableCell>{contract.title}</TableCell>
                        <TableCell>{contractTypeLabels[contract.type]}</TableCell>
                        <TableCell>
                          <Badge className={statusColors[contract.status]}>
                            {statusLabels[contract.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {contract.sent_at
                            ? format(new Date(contract.sent_at), "d. MMM yyyy", { locale: da })
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {contract.signatures?.map((sig, i) => (
                              <Badge
                                key={i}
                                variant={sig.signed_at ? "default" : "outline"}
                                className="text-xs"
                              >
                                {sig.signer_type === "employee" ? "MA" : "LE"}
                                {sig.signed_at && <Check className="h-3 w-3 ml-1" />}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setPreviewContract(contract)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="templates" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={handleNewTemplate}>
                <Plus className="h-4 w-4 mr-2" />
                Ny skabelon
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates
                .filter((t) => t.is_active)
                .map((template) => (
                  <Card key={template.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{template.name}</CardTitle>
                          <Badge variant="outline" className="mt-1">
                            {contractTypeLabels[template.type]}
                          </Badge>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditTemplate(template)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteTemplateMutation.mutate(template.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {template.description || "Ingen beskrivelse"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Version {template.version}
                      </p>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Template Dialog */}
        <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? "Rediger skabelon" : "Ny skabelon"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Navn</Label>
                  <Input
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                    placeholder="F.eks. Standard ansættelseskontrakt"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={templateForm.type}
                    onValueChange={(v) => setTemplateForm({ ...templateForm, type: v as ContractType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(contractTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Beskrivelse</Label>
                <Input
                  value={templateForm.description}
                  onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                  placeholder="Kort beskrivelse af skabelonen"
                />
              </div>
              <div className="space-y-2">
                <Label>Indhold</Label>
                <p className="text-xs text-muted-foreground">
                  Brug placeholders som {`{{employee_name}}`}, {`{{job_title}}`}, {`{{salary_amount}}`} osv.
                </p>
                <RichTextEditor
                  value={templateForm.content}
                  onChange={(content) => setTemplateForm({ ...templateForm, content })}
                  placeholder="Skriv kontraktindhold her..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
                Annuller
              </Button>
              <Button
                onClick={() =>
                  saveTemplateMutation.mutate({
                    ...templateForm,
                    id: editingTemplate?.id,
                  })
                }
                disabled={!templateForm.name || !templateForm.content}
              >
                Gem skabelon
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Preview Contract Dialog */}
        <Dialog open={!!previewContract} onOpenChange={() => setPreviewContract(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{previewContract?.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Badge className={previewContract ? statusColors[previewContract.status] : ""}>
                  {previewContract ? statusLabels[previewContract.status] : ""}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {previewContract?.employee?.first_name} {previewContract?.employee?.last_name}
                </span>
              </div>
              <div
                className="prose prose-sm max-w-none border rounded-lg p-6 bg-white"
                dangerouslySetInnerHTML={{ __html: previewContract?.content || "" }}
              />
              {previewContract?.signatures && previewContract.signatures.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Underskrifter</h4>
                  <div className="space-y-2">
                    {previewContract.signatures.map((sig, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span>
                          {sig.signer_type === "employee" ? "Medarbejder" : "Leder"}: {sig.signer_name}
                        </span>
                        <span className="text-muted-foreground">
                          {sig.signed_at
                            ? format(new Date(sig.signed_at), "d. MMM yyyy HH:mm", { locale: da })
                            : "Afventer"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
