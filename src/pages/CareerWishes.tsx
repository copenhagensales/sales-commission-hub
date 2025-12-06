import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle, Sparkles, Users, Crown, ArrowRight, ArrowLeft } from "lucide-react";

type LeadershipInterest = "yes" | "maybe" | "no";
type LeadershipRoleType = "junior_teamleder" | "teamleder" | "coach" | "other";
type FormPurpose = "team_change" | "leadership" | "both";

export default function CareerWishes() {
  const navigate = useNavigate();
  const { user } = useAuth();
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

  const showTeamChangeSection = formPurpose === "team_change" || formPurpose === "both";
  const showLeadershipSection = formPurpose === "leadership" || formPurpose === "both";

  // Fetch current employee data
  const { data: employee, isLoading: isLoadingEmployee } = useQuery({
    queryKey: ["current-employee-career"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, department, job_title")
        .eq("private_email", user?.email)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.email,
  });

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
      if (!employee?.id) throw new Error("Medarbejder ikke fundet");
      if (!formPurpose) throw new Error("Vælg venligst hvad din henvendelse handler om");

      // Determine values based on form purpose
      const wantsTeamChange = showTeamChangeSection ? "yes" : "no";
      const finalLeadershipInterest = showLeadershipSection ? leadershipInterest : "no";

      const { error } = await supabase.from("career_wishes").insert({
        employee_id: employee.id,
        wants_team_change: wantsTeamChange as "yes" | "no",
        desired_team: showTeamChangeSection ? desiredTeam : null,
        team_change_motivation: showTeamChangeSection ? teamChangeMotivation : null,
        leadership_interest: finalLeadershipInterest as LeadershipInterest,
        leadership_role_type: showLeadershipSection && (leadershipInterest === "yes" || leadershipInterest === "maybe") ? leadershipRoleType as LeadershipRoleType : null,
        leadership_motivation: showLeadershipSection && (leadershipInterest === "yes" || leadershipInterest === "maybe") ? leadershipMotivation : null,
        other_comments: otherComments || null,
      });

      if (error) throw error;

      // Send email notification to HR/owners
      try {
        await supabase.functions.invoke("send-career-wish-notification", {
          body: {
            employeeName: `${employee.first_name} ${employee.last_name}`,
            employeeDepartment: employee.department || employee.job_title,
            wantsTeamChange,
            desiredTeam: showTeamChangeSection ? desiredTeam : null,
            teamChangeMotivation: showTeamChangeSection ? teamChangeMotivation : null,
            leadershipInterest: finalLeadershipInterest,
            leadershipRoleType: showLeadershipSection && (leadershipInterest === "yes" || leadershipInterest === "maybe") ? leadershipRoleType : null,
            leadershipMotivation: showLeadershipSection && (leadershipInterest === "yes" || leadershipInterest === "maybe") ? leadershipMotivation : null,
            otherComments: otherComments || null,
          },
        });
      } catch (notificationError) {
        console.error("Failed to send notification:", notificationError);
      }
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formPurpose) {
      toast({ title: "Udfyld venligst", description: "Vælg hvad din henvendelse handler om.", variant: "destructive" });
      return;
    }

    if (showTeamChangeSection) {
      if (!desiredTeam) {
        toast({ title: "Udfyld venligst", description: "Vælg hvilket team du ønsker.", variant: "destructive" });
        return;
      }
      if (!teamChangeMotivation.trim()) {
        toast({ title: "Udfyld venligst", description: "Beskriv din motivation for teamskifte.", variant: "destructive" });
        return;
      }
    }

    if (showLeadershipSection) {
      if (!leadershipInterest) {
        toast({ title: "Udfyld venligst", description: "Angiv din interesse for ledelse.", variant: "destructive" });
        return;
      }
      if ((leadershipInterest === "yes" || leadershipInterest === "maybe") && !leadershipRoleType) {
        toast({ title: "Udfyld venligst", description: "Vælg hvilken type ledelsesrolle.", variant: "destructive" });
        return;
      }
      if ((leadershipInterest === "yes" || leadershipInterest === "maybe") && !leadershipMotivation.trim()) {
        toast({ title: "Udfyld venligst", description: "Beskriv din motivation for ledelse.", variant: "destructive" });
        return;
      }
    }

    submitMutation.mutate();
  };

  if (isLoadingEmployee) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="container max-w-2xl mx-auto py-8 px-4">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Tak for dit input!</h2>
            <p className="text-muted-foreground max-w-md">
              Vi har modtaget din henvendelse og vender tilbage, når vi har haft mulighed for at se på det.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(-1)}
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Tilbage
      </Button>
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
            {/* Employee Info (read-only) */}
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Medarbejderinfo</Label>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Navn:</span>
                  <span className="ml-2 font-medium">{employee?.first_name} {employee?.last_name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Nuværende team:</span>
                  <span className="ml-2 font-medium">{employee?.department || employee?.job_title || "Ikke angivet"}</span>
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

            {/* Team Change Section */}
            {showTeamChangeSection && (
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
                    placeholder="Beskriv kort, hvorfor du ønsker at skifte team/kunde. Fx: Hvad motiverer dig? Hvad håber du at udvikle?"
                    value={teamChangeMotivation}
                    onChange={(e) => setTeamChangeMotivation(e.target.value)}
                    rows={4}
                  />
                </div>
              </div>
            )}

            {/* Leadership Interest Section */}
            {showLeadershipSection && (
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
                          <SelectItem value="other">Andet (skriv i kommentarfeltet)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="leadership-motivation">Motivation for ledelse</Label>
                      <Textarea
                        id="leadership-motivation"
                        placeholder="Beskriv kort, hvorfor du er interesseret i ledelse. Fx: Hvad motiverer dig ved ledelsesansvar?"
                        value={leadershipMotivation}
                        onChange={(e) => setLeadershipMotivation(e.target.value)}
                        rows={4}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Other Comments - only show when purpose is selected */}
            {formPurpose && (
              <div className="space-y-2">
                <Label htmlFor="other-comments">Andet, vi bør vide? (valgfri)</Label>
                <Textarea
                  id="other-comments"
                  placeholder="Her kan du skrive alt andet, der kan være relevant."
                  value={otherComments}
                  onChange={(e) => setOtherComments(e.target.value)}
                  rows={3}
                />
              </div>
            )}

            {/* Submit Button */}
            {formPurpose && (
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
    </div>
  );
}
