import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award, Target, Quote, Dumbbell, Mail, Eye } from "lucide-react";

// CPH Sales brand colors
const CPH_COLORS = {
  lightBlue: "#e6f0f1",
  onyx: "#2e3136",
  emerald: "#3BE086",
};

export default function FeedbackTemplatePreview() {
  // Example data for the preview
  const exampleData = {
    employeeName: "Anders",
    dayNumber: 3,
    focusTitle: "Indvendingshåndtering",
    score: 1,
    strength: "Du lyttede aktivt til kundens bekymringer og gentog dem korrekt før du besvarede.",
    improvement: "Prøv at undgå at afbryde kunden midt i deres sætning - lad dem tale færdigt før du svarer.",
    suggestedPhrase: "Jeg forstår din bekymring om prisen. Lad mig vise dig, hvordan værdien overstiger investeringen...",
    drillTitle: "Indvendings-pingpong",
    drillDuration: 15,
  };

  const getScoreLabel = (score: number) => {
    if (score === 0) return { text: "Ikke godkendt", color: "#ef4444", emoji: "❌" };
    if (score === 1) return { text: "Godkendt", color: "#eab308", emoji: "✓" };
    return { text: "Stærk præstation", color: "#22c55e", emoji: "⭐" };
  };

  const scoreInfo = getScoreLabel(exampleData.score);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Coaching Feedback Email-skabelon
          </CardTitle>
          <CardDescription>
            Sådan ser den email ud, som medarbejderen modtager efter coaching-feedback
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Eye className="h-4 w-4" />
              <span>Preview med eksempeldata</span>
            </div>
            
            {/* Email Preview Container */}
            <div className="border rounded-lg overflow-hidden shadow-lg">
              {/* Email Header */}
              <div 
                style={{ backgroundColor: CPH_COLORS.onyx }} 
                className="p-6 text-center"
              >
                <h1 
                  style={{ color: CPH_COLORS.emerald }} 
                  className="text-2xl font-bold tracking-wide mb-2"
                >
                  COPENHAGEN SALES
                </h1>
                <p style={{ color: CPH_COLORS.lightBlue }} className="text-sm opacity-90">
                  Coaching Feedback
                </p>
              </div>

              {/* Email Body */}
              <div className="p-6 bg-white space-y-6">
                {/* Greeting */}
                <div>
                  <p className="text-gray-800 text-base">
                    Hej <strong>{exampleData.employeeName}</strong>,
                  </p>
                  <p className="text-gray-600 mt-2">
                    Din leder har givet dig feedback på din coaching-session for <strong>Dag {exampleData.dayNumber}: {exampleData.focusTitle}</strong>.
                  </p>
                </div>

                {/* Score Badge */}
                <div 
                  className="p-4 rounded-lg text-center"
                  style={{ backgroundColor: `${scoreInfo.color}15` }}
                >
                  <span className="text-2xl mr-2">{scoreInfo.emoji}</span>
                  <span 
                    className="text-lg font-semibold"
                    style={{ color: scoreInfo.color }}
                  >
                    {scoreInfo.text}
                  </span>
                </div>

                {/* Strength */}
                <div className="border-l-4 border-green-500 pl-4 py-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Award className="h-5 w-5 text-green-500" />
                    <span className="font-semibold text-green-600">Styrke</span>
                  </div>
                  <p className="text-gray-700">{exampleData.strength}</p>
                </div>

                {/* Improvement */}
                <div className="border-l-4 border-amber-500 pl-4 py-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="h-5 w-5 text-amber-500" />
                    <span className="font-semibold text-amber-600">Forbedringspunkt</span>
                  </div>
                  <p className="text-gray-700">{exampleData.improvement}</p>
                </div>

                {/* Suggested Phrase */}
                {exampleData.suggestedPhrase && (
                  <div 
                    className="p-4 rounded-lg"
                    style={{ backgroundColor: CPH_COLORS.lightBlue }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Quote className="h-5 w-5" style={{ color: CPH_COLORS.onyx }} />
                      <span className="font-semibold" style={{ color: CPH_COLORS.onyx }}>
                        Sig denne sætning næste gang
                      </span>
                    </div>
                    <p className="italic text-gray-700">"{exampleData.suggestedPhrase}"</p>
                  </div>
                )}

                {/* Assigned Drill */}
                {exampleData.drillTitle && (
                  <div 
                    className="p-4 rounded-lg border"
                    style={{ borderColor: CPH_COLORS.emerald }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Dumbbell className="h-5 w-5" style={{ color: CPH_COLORS.emerald }} />
                      <span className="font-semibold" style={{ color: CPH_COLORS.emerald }}>
                        Tildelt øvelse
                      </span>
                    </div>
                    <p className="text-gray-800 font-medium">{exampleData.drillTitle}</p>
                    <p className="text-gray-500 text-sm">{exampleData.drillDuration} minutter</p>
                  </div>
                )}

                {/* CTA */}
                <div className="text-center pt-4">
                  <a 
                    href="#" 
                    className="inline-block px-6 py-3 rounded-lg font-medium text-white"
                    style={{ backgroundColor: CPH_COLORS.emerald }}
                  >
                    Se din feedback i systemet →
                  </a>
                </div>
              </div>

              {/* Email Footer */}
              <div 
                style={{ backgroundColor: CPH_COLORS.lightBlue }} 
                className="p-4 text-center"
              >
                <p className="text-sm" style={{ color: CPH_COLORS.onyx }}>
                  Copenhagen Sales | Onboarding Program
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Template Variables Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tilgængelige flettefelter</CardTitle>
          <CardDescription>
            Disse variabler indsættes automatisk i emailen
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <code className="text-sm font-mono text-primary">{"{{fornavn}}"}</code>
              <span className="text-sm text-muted-foreground">Medarbejderens fornavn</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <code className="text-sm font-mono text-primary">{"{{dag}}"}</code>
              <span className="text-sm text-muted-foreground">Dag-nummer</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <code className="text-sm font-mono text-primary">{"{{fokus}}"}</code>
              <span className="text-sm text-muted-foreground">Dagens fokusområde</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <code className="text-sm font-mono text-primary">{"{{score}}"}</code>
              <span className="text-sm text-muted-foreground">Score (0-2)</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <code className="text-sm font-mono text-primary">{"{{styrke}}"}</code>
              <span className="text-sm text-muted-foreground">Styrke-feedback</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <code className="text-sm font-mono text-primary">{"{{forbedring}}"}</code>
              <span className="text-sm text-muted-foreground">Forbedrings-feedback</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <code className="text-sm font-mono text-primary">{"{{sætning}}"}</code>
              <span className="text-sm text-muted-foreground">Foreslået sætning</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <code className="text-sm font-mono text-primary">{"{{drill}}"}</code>
              <span className="text-sm text-muted-foreground">Tildelt øvelse</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
