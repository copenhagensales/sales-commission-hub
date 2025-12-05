import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, AlertCircle, ArrowRight, Check } from "lucide-react";
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
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [employee, setEmployee] = useState<EmployeeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Form fields
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    cpr_number: "",
    address_street: "",
    address_postal_code: "",
    address_city: "",
    bank_reg_number: "",
    bank_account_number: "",
  });

  const steps = [
    { title: "Identitet", description: "Dine grundlæggende oplysninger" },
    { title: "Adresse & Bank", description: "Adresse og lønoplysninger" },
  ];

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
      // Use secure function to lookup invitation by token (prevents email enumeration)
      const { data, error: invError } = await supabase
        .rpc("get_invitation_by_token", { _token: token });

      if (invError || !data || data.length === 0) {
        setError("Ugyldigt eller udløbet link.");
        setLoading(false);
        return;
      }

      const invitationData = data[0];

      if (new Date(invitationData.expires_at) < new Date()) {
        setError("Invitationen er udløbet. Kontakt venligst din leder.");
        setLoading(false);
        return;
      }

      if (invitationData.status === "completed") {
        setError("Du har allerede udfyldt dine oplysninger.");
        setLoading(false);
        return;
      }

      setInvitation({
        id: invitationData.id,
        employee_id: invitationData.employee_id,
        email: invitationData.email,
        status: invitationData.status,
        expires_at: invitationData.expires_at,
      });

      setEmployee({
        first_name: invitationData.first_name || "",
        last_name: invitationData.last_name || "",
      });

      setFormData((prev) => ({
        ...prev,
        first_name: invitationData.first_name || "",
        last_name: invitationData.last_name || "",
      }));

      setLoading(false);
    } catch (err) {
      console.error("Error validating token:", err);
      setError("Der opstod en fejl. Prøv igen senere.");
      setLoading(false);
    }
  };

  // Auto-save function
  const autoSave = useCallback(async (data: typeof formData) => {
    if (!invitation) return;
    
    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from("employee_master_data")
        .update({
          first_name: data.first_name,
          last_name: data.last_name,
          cpr_number: data.cpr_number,
          address_street: data.address_street,
          address_postal_code: data.address_postal_code,
          address_city: data.address_city,
          address_country: "Danmark",
          bank_reg_number: data.bank_reg_number,
          bank_account_number: data.bank_account_number,
        })
        .eq("id", invitation.employee_id);

      if (!updateError) {
        setLastSaved(new Date());
      }
    } catch (err) {
      console.error("Auto-save error:", err);
    } finally {
      setSaving(false);
    }
  }, [invitation]);

  // Debounced auto-save on form change
  useEffect(() => {
    if (!invitation) return;
    
    const timeoutId = setTimeout(() => {
      autoSave(formData);
    }, 1000); // Save 1 second after user stops typing

    return () => clearTimeout(timeoutId);
  }, [formData, autoSave, invitation]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleNext = async () => {
    // Save before moving to next step
    await autoSave(formData);
    
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Final step - complete the invitation
      await completeInvitation();
    }
  };

  const completeInvitation = async () => {
    if (!invitation) return;

    setSaving(true);
    try {
      // Final save
      await autoSave(formData);

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
      console.error("Complete error:", err);
      toast({
        title: "Fejl",
        description: "Der opstod en fejl.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
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

        {/* Progress indicator */}
        <div className="flex items-center justify-center mb-8 gap-2">
          {steps.map((step, index) => (
            <div key={index} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  index < currentStep
                    ? "bg-green-500 text-white"
                    : index === currentStep
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {index < currentStep ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              {index < steps.length - 1 && (
                <div className={`w-12 h-1 mx-1 ${index < currentStep ? "bg-green-500" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Auto-save indicator */}
        <div className="text-center mb-4 h-5">
          {saving ? (
            <span className="text-sm text-muted-foreground flex items-center justify-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Gemmer...
            </span>
          ) : lastSaved ? (
            <span className="text-sm text-green-600 flex items-center justify-center gap-1">
              <Check className="h-3 w-3" /> Gemt automatisk
            </span>
          ) : null}
        </div>

        {/* Step 1: Identity */}
        {currentStep === 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">{steps[0].title}</CardTitle>
              <CardDescription>{steps[0].description}</CardDescription>
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
                <Label htmlFor="cpr_number">CPR-nummer *</Label>
                <Input
                  id="cpr_number"
                  name="cpr_number"
                  value={formData.cpr_number}
                  onChange={handleChange}
                  placeholder="DDMMÅÅ-XXXX"
                  required
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Address & Bank */}
        {currentStep === 1 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">{steps[1].title}</CardTitle>
              <CardDescription>{steps[1].description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address_street">Adresse *</Label>
                <Input
                  id="address_street"
                  name="address_street"
                  value={formData.address_street}
                  onChange={handleChange}
                  placeholder="Vejnavn og nummer"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="address_postal_code">Postnummer *</Label>
                  <Input
                    id="address_postal_code"
                    name="address_postal_code"
                    value={formData.address_postal_code}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address_city">By *</Label>
                  <Input
                    id="address_city"
                    name="address_city"
                    value={formData.address_city}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label htmlFor="bank_reg_number">Reg. nr. *</Label>
                  <Input
                    id="bank_reg_number"
                    name="bank_reg_number"
                    value={formData.bank_reg_number}
                    onChange={handleChange}
                    placeholder="4 cifre"
                    maxLength={4}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank_account_number">Kontonummer *</Label>
                  <Input
                    id="bank_account_number"
                    name="bank_account_number"
                    value={formData.bank_account_number}
                    onChange={handleChange}
                    placeholder="Op til 10 cifre"
                    maxLength={10}
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-4">
          {currentStep > 0 && (
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setCurrentStep(currentStep - 1)}
            >
              Tilbage
            </Button>
          )}
          <Button
            type="button"
            className="flex-1"
            size="lg"
            onClick={handleNext}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gemmer...
              </>
            ) : currentStep === steps.length - 1 ? (
              <>
                Afslut <CheckCircle2 className="ml-2 h-4 w-4" />
              </>
            ) : (
              <>
                Næste <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
