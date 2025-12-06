import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle, Sparkles } from "lucide-react";

type TeamChangeWish = "yes" | "no";
type LeadershipInterest = "yes" | "maybe" | "no";
type LeadershipRoleType = "junior_teamleder" | "teamleder" | "coach" | "other";

export default function CareerWishes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [wantsTeamChange, setWantsTeamChange] = useState<TeamChangeWish | "">("");
  const [desiredTeam, setDesiredTeam] = useState("");
  const [teamChangeMotivation, setTeamChangeMotivation] = useState("");
  const [leadershipInterest, setLeadershipInterest] = useState<LeadershipInterest | "">("");
  const [leadershipRoleType, setLeadershipRoleType] = useState<LeadershipRoleType | "">("");
  const [leadershipMotivation, setLeadershipMotivation] = useState("");
  const [otherComments, setOtherComments] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

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

      const { error } = await supabase.from("career_wishes").insert({
        employee_id: employee.id,
        wants_team_change: wantsTeamChange as TeamChangeWish,
        desired_team: wantsTeamChange === "yes" ? desiredTeam : null,
        team_change_motivation: wantsTeamChange === "yes" ? teamChangeMotivation : null,
        leadership_interest: leadershipInterest as LeadershipInterest,
        leadership_role_type: leadershipInterest === "yes" || leadershipInterest === "maybe" ? leadershipRoleType as LeadershipRoleType : null,
        leadership_motivation: leadershipInterest === "yes" || leadershipInterest === "maybe" ? leadershipMotivation : null,
        other_comments: otherComments || null,
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!wantsTeamChange) {
      toast({ title: "Udfyld venligst", description: "Angiv om du ønsker at skifte team.", variant: "destructive" });
      return;
    }
    if (wantsTeamChange === "yes" && !desiredTeam) {
      toast({ title: "Udfyld venligst", description: "Vælg hvilket team du ønsker.", variant: "destructive" });
      return;
    }
    if (wantsTeamChange === "yes" && !teamChangeMotivation.trim()) {
      toast({ title: "Udfyld venligst", description: "Beskriv din motivation for teamskifte.", variant: "destructive" });
      return;
    }
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
              Vi har modtaget din henvendelse om teamønsker/ledelse og vender tilbage, når vi har haft mulighed for at se på det.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <CardTitle>Teamønsker & karriereudvikling</CardTitle>
          </div>
          <CardDescription className="mt-4 space-y-3 text-sm">
            <p>Her kan du dele dine ønsker til fremtidige muligheder i Copenhagen Sales.</p>
            <p>Du kan:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Søge om at skifte til et andet team/en anden kunde</li>
              <li>Markere, hvis du er interesseret i en stilling inden for ledelse</li>
            </ul>
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

            {/* Team Change Section */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Ønsker du at skifte team/kunde?</Label>
              <RadioGroup
                value={wantsTeamChange}
                onValueChange={(v) => setWantsTeamChange(v as TeamChangeWish)}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="team-yes" />
                  <Label htmlFor="team-yes" className="font-normal">Ja, jeg ønsker at skifte</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="team-no" />
                  <Label htmlFor="team-no" className="font-normal">Nej, ikke lige nu</Label>
                </div>
              </RadioGroup>

              {wantsTeamChange === "yes" && (
                <div className="space-y-4 pl-4 border-l-2 border-primary/20">
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
                      placeholder="Beskriv kort, hvorfor du ønsker at skifte team/kunde. Fx: Hvad motiverer dig? Hvad håber du at udvikle? Er der noget særligt ved den kunde eller type opgave, der tiltaler dig?"
                      value={teamChangeMotivation}
                      onChange={(e) => setTeamChangeMotivation(e.target.value)}
                      rows={4}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Leadership Interest Section */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Er du interesseret i en stilling inden for ledelse?</Label>
              <RadioGroup
                value={leadershipInterest}
                onValueChange={(v) => setLeadershipInterest(v as LeadershipInterest)}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="leadership-yes" />
                  <Label htmlFor="leadership-yes" className="font-normal">Ja, jeg er interesseret i ledelse</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="maybe" id="leadership-maybe" />
                  <Label htmlFor="leadership-maybe" className="font-normal">Måske på sigt</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="leadership-no" />
                  <Label htmlFor="leadership-no" className="font-normal">Nej, ikke lige nu</Label>
                </div>
              </RadioGroup>

              {(leadershipInterest === "yes" || leadershipInterest === "maybe") && (
                <div className="space-y-4 pl-4 border-l-2 border-primary/20">
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
                      placeholder="Beskriv kort, hvorfor du er interesseret i ledelse. Fx: Hvad motiverer dig ved ledelsesansvar? Hvilke erfaringer eller styrker mener du, du kan bringe i spil som leder?"
                      value={leadershipMotivation}
                      onChange={(e) => setLeadershipMotivation(e.target.value)}
                      rows={4}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Other Comments */}
            <div className="space-y-2">
              <Label htmlFor="other-comments">Andet, vi bør vide? (valgfri)</Label>
              <Textarea
                id="other-comments"
                placeholder="Her kan du skrive alt andet, der kan være relevant i forhold til dine ønsker til team, kunde eller ledelse."
                value={otherComments}
                onChange={(e) => setOtherComments(e.target.value)}
                rows={3}
              />
            </div>

            {/* Submit Button */}
            <Button 
              type="submit" 
              className="w-full" 
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Indsend
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
