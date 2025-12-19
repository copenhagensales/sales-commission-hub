import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, AlertCircle, ArrowRight, Check, Eye, EyeOff } from "lucide-react";
import logo from "@/assets/cph-sales-logo.png";

interface InvitationData {
  id: string;
  employee_id: string;
  email: string;
  status: string;
  expires_at: string;
  first_name: string;
  last_name: string;
  cpr_number: string | null;
  address_street: string | null;
  address_postal_code: string | null;
  address_city: string | null;
  bank_reg_number: string | null;
  bank_account_number: string | null;
  onboarding_completed_at: string | null;
  password_set_at: string | null;
}

export default function EmployeeOnboarding() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);

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

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const steps = [
    { title: "Identitet", description: "Dine grundlæggende oplysninger" },
    { title: "Adresse & Bank", description: "Adresse og lønoplysninger" },
    { title: "Adgangskode", description: "Opret din adgangskode" },
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
      // Use secure function to lookup invitation by token
      const { data, error: invError } = await supabase
        .rpc("get_invitation_by_token_v2", { _token: token });

      if (invError || !data || data.length === 0) {
        setError("Ugyldigt eller udløbet link.");
        setLoading(false);
        return;
      }

      const invitationData = data[0] as InvitationData;

      if (new Date(invitationData.expires_at) < new Date()) {
        setError("Invitationen er udløbet. Kontakt venligst din leder for at få et nyt link.");
        setLoading(false);
        return;
      }

      if (invitationData.password_set_at) {
        setError("Du har allerede oprettet din konto. Log ind med din email og adgangskode.");
        setLoading(false);
        return;
      }

      setInvitation(invitationData);

      // Pre-fill form with existing data
      setFormData({
        first_name: invitationData.first_name || "",
        last_name: invitationData.last_name || "",
        cpr_number: invitationData.cpr_number || "",
        address_street: invitationData.address_street || "",
        address_postal_code: invitationData.address_postal_code || "",
        address_city: invitationData.address_city || "",
        bank_reg_number: invitationData.bank_reg_number || "",
        bank_account_number: invitationData.bank_account_number || "",
      });

      // If onboarding already completed, skip to password step
      if (invitationData.onboarding_completed_at) {
        setCurrentStep(2);
      }

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

  const saveOnboardingData = async () => {
    if (!invitation || !token) return false;
    
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("complete_onboarding", {
        _token: token,
        _first_name: formData.first_name,
        _last_name: formData.last_name,
        _cpr_number: formData.cpr_number,
        _address_street: formData.address_street,
        _address_postal_code: formData.address_postal_code,
        _address_city: formData.address_city,
        _bank_reg_number: formData.bank_reg_number,
        _bank_account_number: formData.bank_account_number,
      });

      if (error) {
        console.error("Save error:", error);
        toast({
          title: "Fejl",
          description: "Kunne ikke gemme dine oplysninger.",
          variant: "destructive",
        });
        return false;
      }

      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        toast({
          title: "Fejl",
          description: result.error || "Kunne ikke gemme dine oplysninger.",
          variant: "destructive",
        });
        return false;
      }

      setLastSaved(new Date());
      return true;
    } catch (err) {
      console.error("Save error:", err);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    // Validate current step
    if (currentStep === 0) {
      if (!formData.first_name || !formData.last_name || !formData.cpr_number) {
        toast({
          title: "Udfyld alle felter",
          description: "Fornavn, efternavn og CPR-nummer er påkrævet.",
          variant: "destructive",
        });
        return;
      }
    }

    if (currentStep === 1) {
      if (!formData.address_street || !formData.address_postal_code || !formData.address_city) {
        toast({
          title: "Udfyld alle felter",
          description: "Adresse er påkrævet.",
          variant: "destructive",
        });
        return;
      }
      if (!formData.bank_reg_number || !formData.bank_account_number) {
        toast({
          title: "Udfyld alle felter",
          description: "Bankoplysninger er påkrævet.",
          variant: "destructive",
        });
        return;
      }

      // Save data before moving to password step
      const saved = await saveOnboardingData();
      if (!saved) return;
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleCreateAccount = async () => {
    if (!password || password.length < 6) {
      toast({
        title: "Ugyldig adgangskode",
        description: "Adgangskoden skal være mindst 6 tegn.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Adgangskoder matcher ikke",
        description: "De to adgangskoder skal være ens.",
        variant: "destructive",
      });
      return;
    }

    setCreatingAccount(true);
    try {
      const response = await supabase.functions.invoke("complete-employee-registration", {
        body: {
          token,
          password,
        },
      });

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      if (response.error) {
        throw new Error(response.error.message || "Kunne ikke oprette konto");
      }

      setCompleted(true);
      toast({
        title: "Konto oprettet!",
        description: "Du kan nu logge ind med din email og adgangskode.",
      });
    } catch (err) {
      console.error("Account creation error:", err);
      toast({
        title: "Fejl",
        description: err instanceof Error ? err.message : "Kunne ikke oprette konto",
        variant: "destructive",
      });
    } finally {
      setCreatingAccount(false);
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
          <CardContent>
            <Button className="w-full" onClick={() => navigate("/auth")}>
              Gå til login
            </Button>
          </CardContent>
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
            <CardTitle>Velkommen!</CardTitle>
            <CardDescription>
              Din konto er nu oprettet. Du kan nu logge ind med din email ({invitation?.email}) og den adgangskode du lige har oprettet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate("/auth")}>
              Gå til login
            </Button>
          </CardContent>
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
            Udfyld venligst dine oplysninger nedenfor for at oprette din konto.
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

        {/* Save indicator */}
        <div className="text-center mb-4 h-5">
          {saving ? (
            <span className="text-sm text-muted-foreground flex items-center justify-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Gemmer...
            </span>
          ) : lastSaved ? (
            <span className="text-sm text-green-600 flex items-center justify-center gap-1">
              <Check className="h-3 w-3" /> Gemt
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

        {/* Step 3: Password */}
        {currentStep === 2 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">{steps[2].title}</CardTitle>
              <CardDescription>
                Opret en adgangskode til din konto. Du vil bruge denne sammen med din email ({invitation?.email}) til at logge ind.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Adgangskode *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mindst 6 tegn"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Bekræft adgangskode *</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Gentag din adgangskode"
                  required
                />
              </div>
              {password && confirmPassword && password !== confirmPassword && (
                <p className="text-sm text-destructive">Adgangskoderne matcher ikke</p>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex gap-4">
          {currentStep > 0 && currentStep < 2 && (
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setCurrentStep(currentStep - 1)}
            >
              Tilbage
            </Button>
          )}
          
          {currentStep < 2 ? (
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
              ) : (
                <>
                  Næste <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          ) : (
            <Button
              type="button"
              className="flex-1"
              size="lg"
              onClick={handleCreateAccount}
              disabled={creatingAccount || !password || password !== confirmPassword}
            >
              {creatingAccount ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Opretter konto...
                </>
              ) : (
                <>
                  Opret konto <CheckCircle2 className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
