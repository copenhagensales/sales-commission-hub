import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Gift, Loader2, CheckCircle2, AlertCircle, Building2 } from "lucide-react";
import { useReferrerByCode, useSubmitReferral } from "@/hooks/useReferrals";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  referrerName: string;
  message: string;
}

export default function PublicReferralForm() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  
  const { data: referrer, isLoading: isLoadingReferrer, error: referrerError } = useReferrerByCode(code);
  const submitReferral = useSubmitReferral();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      referrerName: '',
      message: '',
    }
  });

  const onSubmit = async (data: FormData) => {
    if (!referrer || !code) {
      toast.error("Ugyldigt henvisningslink");
      return;
    }

    try {
      await submitReferral.mutateAsync({
        referral_code: code,
        referrer_employee_id: referrer.id,
        candidate_first_name: data.firstName,
        candidate_last_name: data.lastName,
        candidate_email: data.email,
        candidate_phone: data.phone || undefined,
        referrer_name_provided: data.referrerName,
        message: data.message || undefined,
      });
      
      setSubmitted(true);
    } catch (error) {
      console.error('Error submitting referral:', error);
      toast.error("Der opstod en fejl. Prøv igen.");
    }
  };

  // Invalid code
  if (!isLoadingReferrer && !referrer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
              <h2 className="text-xl font-semibold">Ugyldigt link</h2>
              <p className="text-muted-foreground">
                Dette henvisningslink er ikke gyldigt. Kontakt venligst den person, der delte linket med dig.
              </p>
              <Button onClick={() => navigate('/')} variant="outline">
                Gå til forsiden
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <h2 className="text-xl font-semibold">Tak for din ansøgning!</h2>
              <p className="text-muted-foreground">
                Vi har modtaget dine oplysninger og vil kontakte dig hurtigst muligt.
              </p>
              <p className="text-sm text-muted-foreground">
                Du er blevet henvist af <strong>{referrer?.first_name} {referrer?.last_name}</strong>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-xl w-fit">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Bliv en del af Copenhagen Sales</CardTitle>
          <CardDescription>
            {isLoadingReferrer ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Indlæser...
              </span>
            ) : referrer ? (
              <>
                Du er blevet anbefalet af <strong>{referrer.first_name} {referrer.last_name}</strong>
              </>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Fornavn *</Label>
                <Input
                  id="firstName"
                  {...register("firstName", { required: "Fornavn er påkrævet" })}
                  placeholder="Dit fornavn"
                />
                {errors.firstName && (
                  <p className="text-sm text-destructive">{errors.firstName.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Efternavn *</Label>
                <Input
                  id="lastName"
                  {...register("lastName", { required: "Efternavn er påkrævet" })}
                  placeholder="Dit efternavn"
                />
                {errors.lastName && (
                  <p className="text-sm text-destructive">{errors.lastName.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                {...register("email", { 
                  required: "Email er påkrævet",
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: "Ugyldig email adresse"
                  }
                })}
                placeholder="din@email.dk"
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                type="tel"
                {...register("phone")}
                placeholder="+45 12 34 56 78"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="referrerName">Hvem anbefalede dig? *</Label>
              <Input
                id="referrerName"
                {...register("referrerName", { required: "Skriv navnet på den der anbefalede dig" })}
                placeholder="For- og efternavn på den der anbefalede dig"
              />
              {errors.referrerName && (
                <p className="text-sm text-destructive">{errors.referrerName.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Vigtigt: Skriv det fulde navn på personen, der anbefalede dig
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Kort om dig selv (valgfrit)</Label>
              <Textarea
                id="message"
                {...register("message")}
                placeholder="Fortæl os lidt om dig selv og hvorfor du er interesseret..."
                rows={3}
              />
            </div>

            <div className="pt-4">
              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={isSubmitting || submitReferral.isPending}
              >
                {(isSubmitting || submitReferral.isPending) ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sender...
                  </>
                ) : (
                  <>
                    <Gift className="h-4 w-4 mr-2" />
                    Send ansøgning
                  </>
                )}
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground pt-2">
              Ved at indsende accepterer du, at vi behandler dine oplysninger i forbindelse med rekrutteringsprocessen.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
