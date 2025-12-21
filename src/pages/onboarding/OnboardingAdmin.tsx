import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOnboardingDays, useOnboardingDrills } from "@/hooks/useOnboarding";
import { supabase } from "@/integrations/supabase/client";
import { Settings, Database, RefreshCcw, CheckCircle2, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";

// Seed data - the 15 onboarding days
const SEED_DAYS = [
  { day: 1, week: 1, focus_id: "START", focus_title: "Kom i gang (træningsopkald)", focus_description: "Kom i gang + ro", videos: [{ title: "Introduktion som sælger", duration_min: 7 }, { title: "De første kald – fokus", duration_min: 6 }], drill_id: "OPENING_TO_QUESTION", drill_title: "Åbning → første behovsspørgsmål", drill_duration_min: 10, call_mission: "Kom i gang på telefonen. Nå åbning + 1 behovsspørgsmål i så mange samtaler som muligt.", checkout_blockers: ["Åbning", "Indvendinger", "Stilhed", "Luk"], leader_course_title: "Velkomst + forventninger uge 1", leader_course_duration_min: 40, leader_course_ppt_id: "W1_D1_WELCOME" },
  { day: 2, week: 1, focus_id: "OBJECTIONS", focus_title: "Indvendinger (overlevelse)", focus_description: "Indvendinger uden panik", videos: [{ title: "Indvendinger i samtalen", duration_min: 8 }, { title: "Nedbryd indvendinger", duration_min: 7 }], drill_id: "OBJECTION_PING_PONG", drill_title: "Indvendinger hurtig-respons", drill_duration_min: 10, call_mission: "Anerkend → spørg → tilbage til behov", checkout_blockers: ["Åbning", "Indvendinger", "Stilhed", "Luk"], leader_course_title: "Håndtering af indvendinger", leader_course_duration_min: 30, leader_course_ppt_id: "W1_D2_OBJECTIONS" },
  { day: 3, week: 1, focus_id: "B", focus_title: "Behovsaktivering (B)", focus_description: "Stille bedre spørgsmål", videos: [{ title: "Spørgsmål i behovsfasen", duration_min: 8 }, { title: "Hvilke typer spørgsmål kan man bruge?", duration_min: 6 }], drill_id: "QUESTION_LADDER", drill_title: "Spørgsmåls-ladder", drill_duration_min: 10, call_mission: "Mindst 2 behovsspørgsmål + 1 opfølgning", checkout_blockers: ["Åbning", "Indvendinger", "Stilhed", "Luk"], leader_course_title: "Behovsaktivering", leader_course_duration_min: 30, leader_course_ppt_id: "W1_D3_NEEDS" },
  { day: 4, week: 1, focus_id: "CLOSE_INTRO", focus_title: "Lukning intro", focus_description: "Spørg om køb", videos: [{ title: "Hvordan lukker man – part 1", duration_min: 8 }, { title: "Købssignaler", duration_min: 6 }], drill_id: "ASK_FOR_THE_ORDER", drill_title: "Spørg om købet", drill_duration_min: 10, call_mission: "Spørge tydeligt + stilhed", checkout_blockers: ["Åbning", "Indvendinger", "Stilhed", "Luk"], leader_course_title: "Introduktion til lukning", leader_course_duration_min: 30, leader_course_ppt_id: "W1_D4_CLOSE" },
  { day: 5, week: 1, focus_id: "ACCEPT", focus_title: "Accept på behov", focus_description: "Accept før pitch", videos: [{ title: "Opsummering af behov", duration_min: 7 }, { title: "De vigtige punkter i behovsfasen", duration_min: 6 }], drill_id: "NEEDS_SUMMARY_7SEC", drill_title: "7-sekund opsummering", drill_duration_min: 10, call_mission: "Opsummering + 'er det fair?'", checkout_blockers: ["Åbning", "Indvendinger", "Stilhed", "Luk"], leader_course_title: "Accept og opsummering", leader_course_duration_min: 30, leader_course_ppt_id: "W1_D5_ACCEPT" },
  { day: 6, week: 2, focus_id: "STRUCTURE", focus_title: "Indledning & struktur", focus_description: "Stabilitet & konvertering", videos: [{ title: "Den gode indledning", duration_min: 8 }, { title: "Struktur i samtalen", duration_min: 7 }], drill_id: "STRUCTURED_OPENING", drill_title: "Struktureret åbning", drill_duration_min: 10, call_mission: "Følg strukturen konsekvent", checkout_blockers: ["Struktur", "Flow", "Timing"], leader_course_title: "Samtalestruktur", leader_course_duration_min: 30, leader_course_ppt_id: "W2_D6_STRUCTURE" },
  { day: 7, week: 2, focus_id: "EFU", focus_title: "EFU + forberedelse", focus_description: "Egenskaber, Fordele, Udbytte", videos: [{ title: "EFU", duration_min: 8 }, { title: "Hvordan gør du dig klar til en samtale", duration_min: 6 }], drill_id: "EFU_LADDER", drill_title: "EFU-stigen", drill_duration_min: 10, call_mission: "Brug EFU i hver præsentation", checkout_blockers: ["Forberedelse", "EFU", "Præsentation"], leader_course_title: "EFU-metoden", leader_course_duration_min: 30, leader_course_ppt_id: "W2_D7_EFU" },
  { day: 8, week: 2, focus_id: "PRICE", focus_title: "Pris", focus_description: "Prishåndtering", videos: [{ title: "Behovsafdækning af prisen", duration_min: 8 }, { title: "Indvendinger", duration_min: 7 }], drill_id: "PRICE_DEFUSE", drill_title: "Pris-defusering", drill_duration_min: 10, call_mission: "Afvæbn prisindvendinger med værdi", checkout_blockers: ["Pris", "Værdi", "Indvendinger"], leader_course_title: "Prisdiskussion", leader_course_duration_min: 30, leader_course_ppt_id: "W2_D8_PRICE" },
  { day: 9, week: 2, focus_id: "PRESENTATION", focus_title: "Præsentation af løsning", focus_description: "Løsningspræsentation", videos: [{ title: "Præsentation af løsningen", duration_min: 8 }, { title: "Delaccepter", duration_min: 6 }], drill_id: "VALUE_BRIDGE_20SEC", drill_title: "20-sekund værdibro", drill_duration_min: 10, call_mission: "Bind behov til løsning", checkout_blockers: ["Præsentation", "Delaccepter", "Værdi"], leader_course_title: "Løsningspræsentation", leader_course_duration_min: 30, leader_course_ppt_id: "W2_D9_SOLUTION" },
  { day: 10, week: 2, focus_id: "ASSUME", focus_title: "Antagelse & lukning", focus_description: "Antagelseslukning", videos: [{ title: "Hvordan lukker man – part 2", duration_min: 8 }, { title: "Antagelse", duration_min: 6 }], drill_id: "ASSUMPTIVE_CLOSE", drill_title: "Antagelseslukning", drill_duration_min: 10, call_mission: "Brug antagelseslukning naturligt", checkout_blockers: ["Antagelse", "Lukning", "Timing"], leader_course_title: "Antagelses-teknik", leader_course_duration_min: 30, leader_course_ppt_id: "W2_D10_ASSUME" },
  { day: 11, week: 3, focus_id: "URGENCY", focus_title: "Urgency", focus_description: "Selvstændighed & finish", videos: [{ title: "Hvordan lukker man – part 3", duration_min: 8 }, { title: "Urgency", duration_min: 6 }], drill_id: "LEGIT_URGENCY", drill_title: "Legitim urgency", drill_duration_min: 10, call_mission: "Skab naturlig urgency", checkout_blockers: ["Urgency", "Troværdighed", "Timing"], leader_course_title: "Urgency-teknikker", leader_course_duration_min: 30, leader_course_ppt_id: "W3_D11_URGENCY" },
  { day: 12, week: 3, focus_id: "CALLBACKS", focus_title: "Callbacks (1)", focus_description: "Callback-håndtering", videos: [{ title: "Håndtering af callbacks", duration_min: 8 }, { title: "Undgå og kvalificer dine callbacks", duration_min: 7 }], drill_id: "QUALIFIED_CALLBACK", drill_title: "Kvalificeret callback", drill_duration_min: 10, call_mission: "Kvalificer alle callbacks", checkout_blockers: ["Callbacks", "Kvalificering", "Opfølgning"], leader_course_title: "Callback-strategi", leader_course_duration_min: 30, leader_course_ppt_id: "W3_D12_CALLBACKS" },
  { day: 13, week: 3, focus_id: "ADV_CLOSE", focus_title: "Avanceret lukning", focus_description: "Avancerede lukketeknikker", videos: [{ title: "Hvordan lukker man – part 4", duration_min: 8 }, { title: "Købssignaler / delaccepter", duration_min: 7 }], drill_id: "CLOSE_ON_SIGNAL", drill_title: "Luk på signal", drill_duration_min: 10, call_mission: "Genkend og reager på købssignaler", checkout_blockers: ["Signaler", "Timing", "Mod"], leader_course_title: "Avanceret lukning", leader_course_duration_min: 30, leader_course_ppt_id: "W3_D13_ADV_CLOSE" },
  { day: 14, week: 3, focus_id: "MISTAKES", focus_title: "Typiske fejl", focus_description: "Undgå almindelige fejl", videos: [{ title: "Callbacks", duration_min: 6 }, { title: "Typiske fejl", duration_min: 8 }], drill_id: "CLEAN_PIPELINE", drill_title: "Ren pipeline", drill_duration_min: 10, call_mission: "Identificer og ret egne fejl", checkout_blockers: ["Fejl", "Selvkritik", "Forbedring"], leader_course_title: "Fejlanalyse", leader_course_duration_min: 30, leader_course_ppt_id: "W3_D14_MISTAKES" },
  { day: 15, week: 3, focus_id: "MINDSET", focus_title: "Mentalitet & graduation", focus_description: "Afslutning og næste skridt", videos: [{ title: "En sælgers mentalitet", duration_min: 10 }], drill_id: "RESET_AFTER_NO", drill_title: "Reset efter nej", drill_duration_min: 10, call_mission: "Fokuser på mentalitet og resiliens", checkout_blockers: ["Mentalitet", "Resiliens", "Motivation"], leader_course_title: "Graduation & fremtid", leader_course_duration_min: 40, leader_course_ppt_id: "W3_D15_GRADUATION" },
];

// Seed data - the 15 drills
const SEED_DRILLS = [
  { id: "OPENING_TO_QUESTION", title: "Åbning → behovsspørgsmål", focus: "B", duration_min: 10 },
  { id: "OBJECTION_PING_PONG", title: "Indvendinger hurtig-respons", focus: "B/A", duration_min: 10 },
  { id: "QUESTION_LADDER", title: "Spørgsmåls-ladder", focus: "B", duration_min: 10 },
  { id: "NEEDS_SUMMARY_7SEC", title: "7-sekund opsummering", focus: "A", duration_min: 10 },
  { id: "VALUE_BRIDGE_20SEC", title: "20-sekund værdibro", focus: "L", duration_min: 10 },
  { id: "ASK_FOR_THE_ORDER", title: "Spørg om købet", focus: "A", duration_min: 10 },
  { id: "ASSUMPTIVE_CLOSE", title: "Antagelseslukning", focus: "A", duration_min: 10 },
  { id: "PRICE_DEFUSE", title: "Pris-defusering", focus: "B/A", duration_min: 10 },
  { id: "EFU_LADDER", title: "EFU-stigen", focus: "B", duration_min: 10 },
  { id: "LEGIT_URGENCY", title: "Legitim urgency", focus: "A", duration_min: 10 },
  { id: "QUALIFIED_CALLBACK", title: "Kvalificeret callback", focus: "A", duration_min: 10 },
  { id: "CLOSE_ON_SIGNAL", title: "Luk på signal", focus: "A", duration_min: 10 },
  { id: "CLEAN_PIPELINE", title: "Ren pipeline", focus: "Struktur", duration_min: 10 },
  { id: "RESET_AFTER_NO", title: "Reset efter nej", focus: "Mindset", duration_min: 10 },
  { id: "STRUCTURED_OPENING", title: "Struktureret åbning", focus: "Flow", duration_min: 10 },
];

export default function OnboardingAdmin() {
  const navigate = useNavigate();
  const { data: days = [], refetch: refetchDays } = useOnboardingDays();
  const { data: drills = [], refetch: refetchDrills } = useOnboardingDrills();
  const [seeding, setSeeding] = useState(false);

  const handleSeedData = async () => {
    setSeeding(true);
    try {
      // First seed drills
      for (const drill of SEED_DRILLS) {
        const { error } = await supabase
          .from("onboarding_drills")
          .upsert(drill, { onConflict: "id" });
        if (error) throw error;
      }

      // Then seed days
      for (const day of SEED_DAYS) {
        const { error } = await supabase
          .from("onboarding_days")
          .upsert({
            day: day.day,
            week: day.week,
            focus_id: day.focus_id,
            focus_title: day.focus_title,
            focus_description: day.focus_description,
            videos: day.videos,
            drill_id: day.drill_id,
            drill_title: day.drill_title,
            drill_duration_min: day.drill_duration_min,
            call_mission: day.call_mission,
            checkout_blockers: day.checkout_blockers,
            leader_course_title: day.leader_course_title,
            leader_course_duration_min: day.leader_course_duration_min,
            leader_course_ppt_id: day.leader_course_ppt_id,
            quiz_questions: 5,
            quiz_pass_score: 80,
            checkout_confidence_scale: true,
            coaching_required: true,
            coaching_focus_only: true,
            coaching_reviews_per_rep: 1,
          }, { onConflict: "day,week" });
        if (error) throw error;
      }

      toast.success("Data seeded successfully!");
      refetchDays();
      refetchDrills();
    } catch (error: any) {
      console.error("Seed error:", error);
      toast.error("Kunne ikke seede data: " + error.message);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate("/")} className="mb-2">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Tilbage til menu
        </Button>

        <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Onboarding Administration
          </CardTitle>
          <CardDescription>
            Administrer onboarding-dage, drills og indhold
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Onboarding Dage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{days.length}</span>
                  {days.length === 15 && (
                    <Badge className="bg-green-500">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Komplet
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Drills</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{drills.length}</span>
                  {drills.length === 15 && (
                    <Badge className="bg-green-500">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Komplet
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Seed Standard Data
          </CardTitle>
          <CardDescription>
            Indsæt de 15 standard onboarding-dage og 15 drills
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Dette vil indsætte eller opdatere alle standard onboarding-dage (Uge 1-3) og drill-biblioteket.
              Eksisterende data vil blive overskrevet.
            </p>
            <Button onClick={handleSeedData} disabled={seeding}>
              <RefreshCcw className={`h-4 w-4 mr-2 ${seeding ? "animate-spin" : ""}`} />
              {seeding ? "Seeder..." : "Seed Data"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current Days Overview */}
      {days.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Nuværende Onboarding-dage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {days.map(day => (
                <div key={day.id} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <span className="font-medium">Uge {day.week}, Dag {day.day}:</span>
                    <span className="ml-2">{day.focus_title}</span>
                  </div>
                  <Badge variant="outline">{day.focus_id}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      </div>
    </MainLayout>
  );
}
