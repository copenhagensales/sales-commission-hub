import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsPhone, StickyOnPhone, useDraftGuard } from "@/components/mobile";
import { Loader2, CheckCircle, Sparkles, Users, Crown, ArrowRight } from "lucide-react";

type LeadershipInterest = "yes" | "maybe" | "no";
type LeadershipRoleType = "junior_teamleder" | "teamleder" | "coach" | "other";
type FormPurpose = "team_change" | "leadership" | "both";

interface CareerWishesTabContentProps {
  employeeId: string;
  employeeName: string;
  department?: string | null;
}

export function CareerWishesTabContent({ employeeId, employeeName, department }: CareerWishesTabContentProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formPurpose, setFormPurpose] = useState<FormPurpose | "">("");
  const [desiredTeam, setDesiredTeam] = useState("");
  const [teamChangeMotivation, setTeamChangeMotivation] = useState("");
  const [leadershipInterest, setLeadershipInterest] = useState<LeadershipInterest | "">("");
  const [leadershipRoleType, setLeadershipRoleType] = useState<LeadershipRoleType | "">("");
  const [leadershipMotivation, setLeadershipMotivation] = useState("");
  const [otherComments, setOtherComments] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  // Én anmodnings-id pr. udfyldt formular; genbruges ved genforsøg.
  const [requestId] = useState(() => crypto.randomUUID());

  const isPhone = useIsPhone();
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);

  const showTeamChangeSection = formPurpose === "team_change" || formPurpose === "both";
  const showLeadershipSection = formPurpose === "leadership" || formPurpose === "both";

  // Fetch available clients/teams
  const { data: clients } = useQuery({
    queryKey: ["clients-for-career"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!formPurpose) throw new Error("Vælg venligst hvad din henvendelse handler om");

      const wantsTeamChange = showTeamChangeSection ? "yes" : "no";
      const finalLeadershipInterest = showLeadershipSection ? leadershipInterest : "no";
      const withLeader = showLeadershipSection && (leadershipInterest === "yes" || leadershipInterest === "maybe");

      const raw: Record<string, string | null> = {
        oensker_teamskifte: wantsTeamChange,
        oensket_team: showTeamChangeSection ? desiredTeam : null,
        teamskifte_motivation: showTeamChangeSection ? teamChangeMotivation : null,
        lederinteresse: finalLeadershipInterest,
        lederrolle: withLeader ? leadershipRoleType : null,
        leder_motivation: withLeader ? leadershipMotivation : null,
        andet: otherComments || null,
      };
      const p = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== null && v !== ""));

      const { error } = await supabase.rpc("stork_karriereoenske_indsend", {
        p_anmodning: requestId,
        p,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setIsSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ["career-wishes"] });
      toast({
        title: "Tak for dit input!",
        description: "Vi har modtaget din henvendelse og vender tilbage.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Fejl",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const validate = (scope: "purpose" | "details" | "all"): string | null => {
    if (!formPurpose) return "Vælg hvad din henvendelse handler om.";
    if (scope === "purpose") return null;
    if (showTeamChangeSection) {
      if (!desiredTeam) return "Vælg hvilket team du ønsker.";
      if (!teamChangeMotivation.trim()) return "Beskriv din motivation for teamskifte.";
    }
    if (showLeadershipSection) {
      if (!leadershipInterest) return "Angiv din interesse for ledelse.";
      const withLeader = leadershipInterest === "yes" || leadershipInterest === "maybe";
      if (withLeader && !leadershipRoleType) return "Vælg hvilken type ledelsesrolle.";
      if (withLeader && !leadershipMotivation.trim()) return "Beskriv din motivation for ledelse.";
    }
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate("all");
    if (err) {
      setStepError(err);
      toast({ title: "Udfyld venligst", description: err, variant: "destructive" });
      return;
    }
    setStepError(null);
    submitMutation.mutate();
  };

  const goNext = () => {
    const err = validate(step === 0 ? "purpose" : "details");
    setStepError(err);
    if (!err) setStep((v) => Math.min(2, v + 1));
  };
  const showPurpose = !isPhone || step === 0;
  const showDetails = !isPhone || step === 1;
  const STEPS = ["Ønske", "Begrundelse", "Send"];

  if (isSubmitted) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Tak for dit input!</h2>
          <p className="text-muted-foreground max-w-md">
            Vi har modtaget din henvendelse og vender tilbage, når vi har haft mulighed for at se på det.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <CardTitle>Teamønsker & karriereudvikling</CardTitle>
        </div>
        <CardDescription className="mt-4 space-y-3 text-sm">
          <p>Her kan du dele dine ønsker til fremtidige muligheder i Copenhagen Sales.</p>
          <p className="text-muted-foreground italic">
            Formålet er at understøtte din udvikling og sikre, at vi kender dine ønsker – ikke at 'straffe' nogen for at ville prøve noget nyt. Din henvendelse bliver behandlet fortroligt af HR/ledelsen.
          </p>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-8">
          {isPhone && (
            <div aria-label={`Trin ${step + 1} af 3`}>
              <div className="mb-2 flex justify-between text-[14px] text-muted-foreground">
                {STEPS.map((l, i) => (
                  <span key={l} className={i === step ? "font-semibold text-foreground" : undefined}>{i + 1}. {l}</span>
                ))}
              </div>
              <div className="flex gap-1" aria-hidden="true">
                {STEPS.map((l, i) => <div key={l} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />)}
              </div>
            </div>
          )}
          {stepError && isPhone && <p role="alert" className="text-[14px] text-destructive">{stepError}</p>}

          {showPurpose && (<>
          {/* Employee Info (read-only) */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Medarbejderinfo</Label>
            <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2 md:gap-4">
              <div>
                <span className="text-muted-foreground">Navn:</span>
                <span className="ml-2 font-medium">{employeeName}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Nuværende team:</span>
                <span className="ml-2 font-medium">{department || "Ikke angivet"}</span>
              </div>
            </div>
          </div>

          {/* Purpose Selection */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Hvad handler din henvendelse om?</Label>
            <div className="grid gap-3">
              <button
                type="button"
                onClick={() => setFormPurpose("team_change")}
                className={`flex items-center gap-4 p-4 rounded-lg border-2 text-left transition-all ${
                  formPurpose === "team_change" 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                }`}
              >
                <div className={`p-3 rounded-full ${formPurpose === "team_change" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <Users className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">Jeg ønsker at skifte team/kunde</div>
                  <div className="text-sm text-muted-foreground">Søg om at komme på et andet team eller kunde</div>
                </div>
                {formPurpose === "team_change" && <ArrowRight className="h-5 w-5 text-primary" />}
              </button>

              <button
                type="button"
                onClick={() => setFormPurpose("leadership")}
                className={`flex items-center gap-4 p-4 rounded-lg border-2 text-left transition-all ${
                  formPurpose === "leadership" 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                }`}
              >
                <div className={`p-3 rounded-full ${formPurpose === "leadership" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <Crown className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">Jeg er interesseret i ledelse</div>
                  <div className="text-sm text-muted-foreground">Markér interesse for en lederrolle</div>
                </div>
                {formPurpose === "leadership" && <ArrowRight className="h-5 w-5 text-primary" />}
              </button>

              <button
                type="button"
                onClick={() => setFormPurpose("both")}
                className={`flex items-center gap-4 p-4 rounded-lg border-2 text-left transition-all ${
                  formPurpose === "both" 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                }`}
              >
                <div className={`p-3 rounded-full ${formPurpose === "both" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">Begge dele</div>
                  <div className="text-sm text-muted-foreground">Både teamskifte og ledelsesinteresse</div>
                </div>
                {formPurpose === "both" && <ArrowRight className="h-5 w-5 text-primary" />}
              </button>
            </div>
          </div>

          </>)}

          {/* Team Change Section */}
          {showDetails && showTeamChangeSection && (
            <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-5 w-5 text-primary" />
                <Label className="text-base font-semibold">Teamskifte</Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="desired-team">Hvilken kunde/hvilket team ønsker du at skifte til?</Label>
                <Select value={desiredTeam} onValueChange={setDesiredTeam}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vælg team/kunde" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients?.map((client) => (
                      <SelectItem key={client.id} value={client.name}>
                        {client.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="open_for_suggestions">Åben for forslag fra ledelsen</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="team-motivation">Motivation for dit ønske</Label>
                <Textarea
                  id="team-motivation"
                  placeholder="Beskriv kort, hvorfor du ønsker at skifte team/kunde."
                  value={teamChangeMotivation}
                  onChange={(e) => setTeamChangeMotivation(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
          )}

          {/* Leadership Interest Section */}
          {showDetails && showLeadershipSection && (
            <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="h-5 w-5 text-primary" />
                <Label className="text-base font-semibold">Ledelsesinteresse</Label>
              </div>

              <div className="space-y-3">
                <Label>Hvor interesseret er du?</Label>
                <RadioGroup
                  value={leadershipInterest}
                  onValueChange={(v) => setLeadershipInterest(v as LeadershipInterest)}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="leadership-yes" />
                    <Label htmlFor="leadership-yes" className="font-normal">Ja, jeg er meget interesseret</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="maybe" id="leadership-maybe" />
                    <Label htmlFor="leadership-maybe" className="font-normal">Måske på sigt</Label>
                  </div>
                </RadioGroup>
              </div>

              {(leadershipInterest === "yes" || leadershipInterest === "maybe") && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="leadership-role">Hvilken type ledelsesrolle er du interesseret i?</Label>
                    <Select value={leadershipRoleType} onValueChange={(v) => setLeadershipRoleType(v as LeadershipRoleType)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Vælg ledelsesrolle" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="junior_teamleder">Junior teamleder</SelectItem>
                        <SelectItem value="teamleder">Teamleder</SelectItem>
                        <SelectItem value="coach">Coach/træner</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="leadership-motivation">Motivation for ledelse</Label>
                    <Textarea
                      id="leadership-motivation"
                      placeholder="Beskriv kort, hvorfor du er interesseret i ledelse."
                      value={leadershipMotivation}
                      onChange={(e) => setLeadershipMotivation(e.target.value)}
                      rows={4}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {isPhone && step === 2 && (
            <div className="space-y-2 rounded-lg bg-muted/40 p-4 text-[15px]">
              <p className="font-semibold">Klar til at sende</p>
              {showTeamChangeSection && <p>Teamskifte: {desiredTeam === "open_for_suggestions" ? "Åben for forslag" : desiredTeam}</p>}
              {showLeadershipSection && <p>Ledelse: {leadershipInterest === "yes" ? "Meget interesseret" : "Måske på sigt"}</p>}
              <p className="text-muted-foreground">Din henvendelse behandles fortroligt af HR/ledelsen.</p>
            </div>
          )}

          {isPhone && (
            <StickyOnPhone>
              {step > 0 && (
                <Button type="button" variant="outline" onClick={() => { setStepError(null); setStep(step - 1); }}>Tilbage</Button>
              )}
              {step < 2 ? (
                <Button type="button" onClick={goNext}>Næste</Button>
              ) : (
                <Button type="submit" disabled={submitMutation.isPending}>
                  {submitMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send
                </Button>
              )}
            </StickyOnPhone>
          )}

          {/* Submit Button */}
          {!isPhone && formPurpose && (
            <Button 
              type="submit" 
              className="w-full" 
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Indsend
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
