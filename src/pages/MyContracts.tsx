import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { FileText, Check, Clock, X, Eye, AlertCircle, PenLine } from "lucide-react";

type ContractStatus = "draft" | "pending_employee" | "pending_manager" | "signed" | "rejected" | "expired";

const statusLabels: Record<ContractStatus, string> = {
  draft: "Kladde",
  pending_employee: "Afventer din underskrift",
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

const statusIcons: Record<ContractStatus, typeof Check> = {
  draft: FileText,
  pending_employee: Clock,
  pending_manager: Clock,
  signed: Check,
  rejected: X,
  expired: AlertCircle,
};

export default function MyContracts() {
  const navigate = useNavigate();

  // Fetch contracts for current employee
  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["my-contracts"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      console.log("MyContracts - Auth user:", userData.user?.email);
      if (!userData.user) {
        console.log("MyContracts - No auth user");
        return [];
      }

      // Get employee ID from email
      const { data: employee, error: empError } = await supabase
        .from("employee_master_data")
        .select("id")
        .eq("private_email", userData.user.email)
        .maybeSingle();

      console.log("MyContracts - Employee lookup:", { employee, empError, email: userData.user.email });

      if (!employee) {
        console.log("MyContracts - No employee found for email");
        return [];
      }

      const { data, error } = await supabase
        .from("contracts")
        .select(`
          *,
          signatures:contract_signatures(signer_type, signer_name, signed_at)
        `)
        .eq("employee_id", employee.id)
        .order("created_at", { ascending: false });

      console.log("MyContracts - Contracts query:", { data, error, employeeId: employee.id });

      if (error) throw error;
      return data;
    },
  });

  const pendingContracts = contracts.filter((c) => c.status === "pending_employee");
  const signedContracts = contracts.filter((c) => c.status === "signed");

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Mine kontrakter</h1>
          <p className="text-muted-foreground">Se og underskriv dine kontrakter</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-100 rounded-lg">
                  <Clock className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pendingContracts.length}</p>
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
                  <p className="text-2xl font-bold">{signedContracts.length}</p>
                  <p className="text-sm text-muted-foreground">Underskrevet</p>
                </div>
              </div>
            </CardContent>
          </Card>
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
        </div>

        {/* Pending contracts alert */}
        {pendingContracts.length > 0 && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-amber-200 rounded-full">
                  <AlertCircle className="h-5 w-5 text-amber-700" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-900">
                    Du har {pendingContracts.length} kontrakt{pendingContracts.length > 1 ? "er" : ""} der afventer din underskrift
                  </h3>
                  <p className="text-sm text-amber-700 mt-1">
                    Gennemgå og underskriv venligst dine ventende kontrakter.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contracts list */}
        <div className="space-y-4">
          {contracts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Ingen kontrakter</h3>
                <p className="text-muted-foreground">
                  Du har ingen kontrakter endnu.
                </p>
              </CardContent>
            </Card>
          ) : (
            contracts.map((contract) => {
              const StatusIcon = statusIcons[contract.status as ContractStatus];
              const isPending = contract.status === "pending_employee";
              return (
                <Card
                  key={contract.id}
                  className={`hover:shadow-md transition-shadow ${
                    isPending ? "border-amber-300" : ""
                  }`}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div 
                        className="flex items-start gap-4 flex-1 cursor-pointer"
                        onClick={() => navigate(`/contract/${contract.id}`)}
                      >
                        <div
                          className={`p-3 rounded-lg ${
                            contract.status === "signed"
                              ? "bg-green-100"
                              : isPending
                              ? "bg-amber-100"
                              : "bg-muted"
                          }`}
                        >
                          <StatusIcon
                            className={`h-6 w-6 ${
                              contract.status === "signed"
                                ? "text-green-600"
                                : isPending
                                ? "text-amber-600"
                                : "text-muted-foreground"
                            }`}
                          />
                        </div>
                        <div>
                          <h3 className="font-semibold">{contract.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {contract.sent_at
                              ? `Modtaget ${format(new Date(contract.sent_at), "d. MMMM yyyy", { locale: da })}`
                              : "Ikke sendt endnu"}
                          </p>
                          {contract.signatures && contract.signatures.length > 0 && (
                            <div className="flex items-center gap-2 mt-2">
                              {contract.signatures.map((sig: any, i: number) => (
                                <Badge
                                  key={i}
                                  variant={sig.signed_at ? "default" : "outline"}
                                  className="text-xs"
                                >
                                  {sig.signer_type === "employee" ? "Medarbejder" : "Leder"}
                                  {sig.signed_at && <Check className="h-3 w-3 ml-1" />}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={statusColors[contract.status as ContractStatus]}>
                          {statusLabels[contract.status as ContractStatus]}
                        </Badge>
                        {isPending ? (
                          <Button 
                            size="sm" 
                            className="gap-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/contract/${contract.id}`);
                            }}
                          >
                            <PenLine className="h-4 w-4" />
                            Underskriv
                          </Button>
                        ) : (
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/contract/${contract.id}`);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </MainLayout>
  );
}
