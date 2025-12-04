import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import logo from "@/assets/cph-sales-logo.png";

interface InvitationData {
  id: string;
  employee_id: string;
  email: string;
  status: string;
  expires_at: string;
}

interface EmployeeData {
  first_name: string;
  last_name: string;
}

export default function EmployeeOnboarding() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [employee, setEmployee] = useState<EmployeeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  // Form fields
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    private_email: "",
    private_phone: "",
    address_street: "",
    address_postal_code: "",
    address_city: "",
    cpr_number: "",
    bank_reg_number: "",
    bank_account_number: "",
  });

  useEffect(() => {
    if (!token) {
      setError("Intet token fundet. Brug linket fra din invitation.");
      setLoading(false);
      return;
    }

    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      // Fetch invitation by token
      const { data: invitationData, error: invError } = await supabase
        .from("employee_invitations")
        .select("*")
        .eq("token", token)
        .single();

      if (invError || !invitationData) {
        setError("Ugyldigt eller udløbet link.");
        setLoading(false);
        return;
      }

      // Check if expired
      if (new Date(invitationData.expires_at) < new Date()) {
        setError("Invitationen er udløbet. Kontakt venligst din leder.");
        setLoading(false);
        return;
      }

      // Check if already completed
      if (invitationData.status === "completed") {
        setError("Du har allerede udfyldt dine oplysninger.");
        setLoading(false);
        return;
      }

      setInvitation(invitationData);

      // Fetch employee data
      const { data: employeeData, error: empError } = await supabase
        .from("employee_master_data")
        .select("first_name, last_name")
        .eq("id", invitationData.employee_id)
        .single();

      if (empError || !employeeData) {
        setError("Medarbejder ikke fundet.");
        setLoading(false);
        return;
      }

      setEmployee(employeeData);
      setFormData((prev) => ({
        ...prev,
        first_name: employeeData.first_name || "",
        last_name: employeeData.last_name || "",
        private_email: invitationData.email || "",
      }));

      setLoading(false);
    } catch (err) {
      console.error("Error validating token:", err);
      setError("Der opstod en fejl. Prøv igen senere.");
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation) return;

    setSubmitting(true);

    try {
      // Update employee master data
      const { error: updateError } = await supabase
        .from("employee_master_data")
        .update({
          first_name: formData.first_name,
          last_name: formData.last_name,
          private_email: formData.private_email,
          private_phone: formData.private_phone,
          address_street: formData.address_street,
          address_postal_code: formData.address_postal_code,
          address_city: formData.address_city,
          cpr_number: formData.cpr_number,
          bank_reg_number: formData.bank_reg_number,
          bank_account_number: formData.bank_account_number,
        })
        .eq("id", invitation.employee_id);

      if (updateError) {
        throw updateError;
      }

      // Mark invitation as completed
      const { error: invUpdateError } = await supabase
        .from("employee_invitations")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", invitation.id);

      if (invUpdateError) {
        console.error("Error updating invitation:", invUpdateError);
      }

      setCompleted(true);
      toast({
        title: "Oplysninger gemt",
        description: "Dine oplysninger er nu registreret. Tak!",
      });
    } catch (err) {
      console.error("Submit error:", err);
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved gem af oplysninger.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <img src={logo} alt="CPH Sales" className="h-12 mx-auto mb-4" />
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle>Fejl</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <img src={logo} alt="CPH Sales" className="h-12 mx-auto mb-4" />
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
            <CardTitle>Tak!</CardTitle>
            <CardDescription>
              Dine oplysninger er nu registreret. Du kan lukke denne side.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <img src={logo} alt="CPH Sales" className="h-12 mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Velkommen til CPH Sales</h1>
          <p className="text-muted-foreground mt-2">
            Udfyld venligst dine personlige oplysninger nedenfor.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Identitet</CardTitle>
              <CardDescription>Dine grundlæggende oplysninger</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">Fornavn *</Label>
                  <Input
                    id="first_name"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Efternavn *</Label>
                  <Input
                    id="last_name"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpr_number">CPR-nummer</Label>
                <Input
                  id="cpr_number"
                  name="cpr_number"
                  value={formData.cpr_number}
                  onChange={handleChange}
                  placeholder="DDMMÅÅ-XXXX"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Kontaktoplysninger</CardTitle>
              <CardDescription>Hvordan vi kan kontakte dig</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="private_email">Privat email *</Label>
                <Input
                  id="private_email"
                  name="private_email"
                  type="email"
                  value={formData.private_email}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="private_phone">Telefonnummer</Label>
                <Input
                  id="private_phone"
                  name="private_phone"
                  type="tel"
                  value={formData.private_phone}
                  onChange={handleChange}
                  placeholder="+45 12 34 56 78"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address_street">Adresse</Label>
                <Input
                  id="address_street"
                  name="address_street"
                  value={formData.address_street}
                  onChange={handleChange}
                  placeholder="Vejnavn og nummer"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="address_postal_code">Postnummer</Label>
                  <Input
                    id="address_postal_code"
                    name="address_postal_code"
                    value={formData.address_postal_code}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address_city">By</Label>
                  <Input
                    id="address_city"
                    name="address_city"
                    value={formData.address_city}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Bankoplysninger</CardTitle>
              <CardDescription>Til lønudbetaling</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bank_reg_number">Reg. nr.</Label>
                  <Input
                    id="bank_reg_number"
                    name="bank_reg_number"
                    value={formData.bank_reg_number}
                    onChange={handleChange}
                    placeholder="4 cifre"
                    maxLength={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank_account_number">Kontonummer</Label>
                  <Input
                    id="bank_account_number"
                    name="bank_account_number"
                    value={formData.bank_account_number}
                    onChange={handleChange}
                    placeholder="Op til 10 cifre"
                    maxLength={10}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" className="w-full" size="lg" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gemmer...
              </>
            ) : (
              "Gem oplysninger"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
