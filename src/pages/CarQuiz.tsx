import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useCarQuizCompletion, useSubmitCarQuiz } from "@/hooks/useCarQuiz";
import { CheckCircle, XCircle, Car, AlertTriangle, Shield, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format, addMonths } from "date-fns";
import { da } from "date-fns/locale";
import { MainLayout } from "@/components/layout/MainLayout";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

const QUESTIONS = [
  {
    id: 1,
    question: "Hvad gælder, når du kører i Copenhagen Sales' biler?",
    options: [
      { key: "A", text: "Færdselsloven gælder kun, hvis bilen bruges til private ture" },
      { key: "B", text: "Færdselsloven gælder altid, uanset om turen er privat eller erhverv" },
      { key: "C", text: "Færdselsloven gælder ikke, hvis man kører for en virksomhed" },
      { key: "D", text: "Det er op til føreren selv, hvilke regler der gælder" },
    ],
    correctAnswer: "B",
  },
  {
    id: 2,
    question: "Hvad sker der, hvis du kører vandvidskørsel i en Copenhagen Sales-bil?",
    options: [
      { key: "A", text: "Virksomheden betaler alle omkostninger, inkl. hvis bilen konfiskeres" },
      { key: "B", text: "Bilen kan blive konfiskeret, og du hæfter personligt for bilens værdi" },
      { key: "C", text: "Der sker ikke noget særligt – det er 'kun' en bøde" },
      { key: "D", text: "Kun din førerret påvirkes, ikke noget økonomisk" },
    ],
    correctAnswer: "B",
  },
  {
    id: 3,
    question: "Hvordan er reglerne for privat brug af Copenhagen Sales' biler?",
    options: [
      { key: "A", text: "Det er tilladt frit, så længe man selv betaler benzinen" },
      { key: "B", text: "Det er kun tilladt, hvis man spørger sin teamleder først" },
      { key: "C", text: "Privat brug er forbudt og kan medføre skattepligt og konsekvenser ansættelsesmæssigt" },
      { key: "D", text: "Det er okay, hvis man kun bruger bilen privat uden for arbejdstid" },
    ],
    correctAnswer: "C",
  },
  {
    id: 4,
    question: "Hvad kan der ske, hvis du alligevel bruger firmabilen privat?",
    options: [
      { key: "A", text: "Ingenting, så længe bilen er forsikret" },
      { key: "B", text: "Du kan blive skattepligtig af fri bil og kan få alvorlige ansættelsesmæssige konsekvenser" },
      { key: "C", text: "Du får kun en mundtlig advarsel" },
      { key: "D", text: "Du får automatisk højere løn" },
    ],
    correctAnswer: "B",
  },
  {
    id: 5,
    question: "Hvad kan der ske, hvis du kører for hurtigt i en Copenhagen Sales-bil på en måde, der anses som alvorlig eller uforsvarlig (og dermed sætter andre liv i fare)?",
    options: [
      { key: "A", text: "Der sker som udgangspunkt ikke noget, det er jo 'bare' en fartbøde" },
      { key: "B", text: "Du kan få en bonus, hvis du når flere møder" },
      { key: "C", text: "Du kan blive bortvist fra Copenhagen Sales" },
      { key: "D", text: "Kun bilen bliver 'spærret' i systemet, men du beholder jobbet" },
    ],
    correctAnswer: "C",
  },
  {
    id: 6,
    question: "Hvem betaler fartbøder, hvis du kører for hurtigt i en Copenhagen Sales-bil?",
    options: [
      { key: "A", text: "Copenhagen Sales betaler altid" },
      { key: "B", text: "Bøden deles mellem dig og virksomheden" },
      { key: "C", text: "Din teamleder betaler" },
      { key: "D", text: "Du betaler selv, da du er ansvarlig for din kørsel" },
    ],
    correctAnswer: "D",
  },
  {
    id: 7,
    question: "Hvem hæfter for parkeringsafgifter, hvis du parkerer forkert?",
    options: [
      { key: "A", text: "Copenhagen Sales betaler automatisk alle parkeringsafgifter" },
      { key: "B", text: "Din kollega, hvis det er dem, der bookede bilen" },
      { key: "C", text: "Du hæfter selv for parkeringsafgifter, fordi du har ansvaret for, hvor og hvordan du parkerer" },
      { key: "D", text: "Ingen betaler, medmindre det går til inkasso" },
    ],
    correctAnswer: "C",
  },
  {
    id: 8,
    question: "Hvad er korrekt ift. parkering og betaling?",
    options: [
      { key: "A", text: "Du skal selv sikre, at du parkerer lovligt – men Copenhagen Sales betaler evt. parkeringsbillet (lovlig parkering)" },
      { key: "B", text: "Du må parkere, hvor du vil, så længe du er under 10 minutter" },
      { key: "C", text: "Du skal selv betale både parkering og parkeringsbøder" },
      { key: "D", text: "Der er ingen regler for parkering, når det er firmabil" },
    ],
    correctAnswer: "A",
  },
];

const SUMMARY_POINTS = [
  "Færdselsloven gælder ALTID, når du kører i Copenhagen Sales' biler",
  "Ved vandvidskørsel kan bilen blive konfiskeret, og du hæfter PERSONLIGT for bilens fulde værdi",
  "Privat brug af firmabiler er FORBUDT og kan medføre skattepligt og ansættelsesmæssige konsekvenser",
  "Du betaler SELV alle fartbøder og parkeringsafgifter ved ulovlig parkering",
  "Uforsvarlig kørsel kan medføre BORTVISNING fra Copenhagen Sales",
  "Copenhagen Sales betaler kun for lovlig parkering – du har ansvaret for at parkere korrekt",
  "Din kørsel overvåges via GPS/chip til sikkerhed og dokumentation",
];

export default function CarQuiz() {
  const { data: completion, isLoading } = useCarQuizCompletion();
  const submitQuiz = useSubmitCarQuiz();
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [gpsAccepted, setGpsAccepted] = useState(false);
  const [summaryAccepted, setSummaryAccepted] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [passed, setPassed] = useState(false);

  const handleSubmit = () => {
    const allCorrect = QUESTIONS.every(q => answers[q.id] === q.correctAnswer);
    const isValid = allCorrect && gpsAccepted && summaryAccepted;

    setPassed(isValid);
    setShowResults(true);

    // Submit quiz with all answers and acceptance states
    submitQuiz.mutate(
      { answers, gpsAccepted, summaryAccepted },
      {
        onSuccess: (result) => {
          if (result.passed) {
            toast.success("Tillykke! Du har bestået bil-quizzen. Resultatet er sendt til din email.");
          } else {
            toast.info("Dit svar er registreret. Resultatet er sendt til din email.");
          }
        },
        onError: () => {
          toast.error("Der opstod en fejl. Prøv igen.");
        },
      }
    );
  };

  const handleRetry = () => {
    setAnswers({});
    setGpsAccepted(false);
    setSummaryAccepted(false);
    setShowResults(false);
    setPassed(false);
  };

  // Calculate progress
  const answeredCount = Object.keys(answers).length + (gpsAccepted ? 1 : 0) + (summaryAccepted ? 1 : 0);
  const totalItems = QUESTIONS.length + 2; // +2 for GPS and summary checkboxes
  const progressPercent = Math.round((answeredCount / totalItems) * 100);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-pulse text-muted-foreground">Indlæser...</div>
        </div>
      </MainLayout>
    );
  }

  // Already passed and not expired - show certificate
  if (completion && !completion.isExpired) {
    const nextRenewalDate = addMonths(new Date(completion.passed_at), 6);
    
    return (
      <MainLayout>
        <div className="container mx-auto py-8 px-4 max-w-3xl space-y-8">
          {/* Header */}
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Car className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Bil-quiz – Firmabiler</h1>
              <p className="text-muted-foreground">Copenhagen Sales</p>
            </div>
          </div>

          {/* Official certificate card */}
          <Card className="relative overflow-hidden border-2 border-green-500/50 shadow-lg">
            {/* Green gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-green-50 via-background to-emerald-50/50 dark:from-green-950/30 dark:via-background dark:to-emerald-950/20" />
            
            {/* Stamp */}
            <div className="absolute top-6 right-6 rotate-12 z-10">
              <div className="border-4 border-green-600 dark:border-green-500 rounded-xl px-5 py-2.5 bg-white/90 dark:bg-background/90 shadow-lg">
                <div className="text-green-700 dark:text-green-400 font-bold text-2xl tracking-widest">BESTÅET</div>
                <div className="text-green-600 dark:text-green-500 text-xs text-center font-semibold tracking-wider">COPENHAGEN SALES</div>
              </div>
            </div>

            <CardHeader className="relative pb-2">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40 ring-4 ring-green-200/50 dark:ring-green-800/30">
                  <Shield className="h-7 w-7 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <CardTitle className="text-xl text-green-700 dark:text-green-400">Godkendt til brug af firmabiler</CardTitle>
                  <CardDescription className="text-base">
                    Bestået {format(new Date(completion.passed_at), "d. MMMM yyyy 'kl.' HH:mm", { locale: da })}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="relative space-y-6 pt-4">
              <div className="rounded-xl bg-white/60 dark:bg-muted/30 p-5 border border-green-200/50 dark:border-green-800/30">
                <h3 className="font-semibold mb-4 text-sm uppercase tracking-wide text-muted-foreground">Du har bekræftet følgende</h3>
                <ul className="space-y-3">
                  {SUMMARY_POINTS.map((point, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-500 mt-0.5 shrink-0" />
                      <span className="text-sm leading-relaxed">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center gap-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 p-4 border border-amber-200 dark:border-amber-800/50">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0" />
                <div>
                  <p className="font-medium text-amber-700 dark:text-amber-400">Fornyelse påkrævet</p>
                  <p className="text-sm text-amber-600 dark:text-amber-500">
                    Senest {format(nextRenewalDate, "d. MMMM yyyy", { locale: da })} (hver 6. måned)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  // Quiz expired - show renewal notice
  if (completion?.isExpired) {
    return (
      <MainLayout>
        <div className="container mx-auto py-8 px-4 max-w-3xl space-y-8">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Car className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Bil-quiz – Firmabiler</h1>
              <p className="text-muted-foreground">Copenhagen Sales</p>
            </div>
          </div>

          <Card className="border-amber-300 dark:border-amber-700 bg-gradient-to-br from-amber-50 to-background dark:from-amber-950/30 dark:to-background">
            <CardContent className="flex flex-col items-center text-center py-12 space-y-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
                <AlertTriangle className="h-8 w-8 text-amber-600 dark:text-amber-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-amber-700 dark:text-amber-400">Din godkendelse er udløbet</h2>
                <p className="text-muted-foreground max-w-md">
                  Du bestod sidst {format(new Date(completion.passed_at), "d. MMMM yyyy", { locale: da })}. 
                  Tag quizzen igen for at fortsætte med at bruge firmabilerne.
                </p>
              </div>
              <Button size="lg" onClick={handleRetry} className="gap-2">
                Tag quizzen igen
                <ChevronRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  // Show failed result
  if (showResults && !passed) {
    return (
      <MainLayout>
        <div className="container mx-auto py-8 px-4 max-w-3xl">
          <Card className="border-red-300 dark:border-red-800 bg-gradient-to-br from-red-50 to-background dark:from-red-950/30 dark:to-background">
            <CardContent className="flex flex-col items-center text-center py-12 space-y-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
                <XCircle className="h-8 w-8 text-red-600 dark:text-red-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-red-700 dark:text-red-400">Ikke bestået</h2>
                <p className="text-muted-foreground max-w-md">
                  Du har ikke svaret korrekt på alle spørgsmål eller accepteret alle betingelser. 
                  Læs reglerne igen og prøv én gang til.
                </p>
              </div>
              <Button size="lg" onClick={handleRetry} className="gap-2">
                Prøv igen
                <ChevronRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const allAnswered = QUESTIONS.every(q => answers[q.id]) && gpsAccepted && summaryAccepted;

  return (
    <MainLayout>
      <div className="container mx-auto py-8 px-4 max-w-3xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Car className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Bil-quiz – Firmabiler</h1>
              <p className="text-muted-foreground">Copenhagen Sales</p>
            </div>
          </div>
          <Badge variant="outline" className="text-sm px-3 py-1">
            {progressPercent}% færdig
          </Badge>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <Progress value={progressPercent} className="h-2" />
          <p className="text-xs text-muted-foreground text-right">
            {answeredCount} af {totalItems} besvaret
          </p>
        </div>

        {/* Info alert */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-5">
            <div className="flex gap-4">
              <div className="shrink-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <AlertTriangle className="h-5 w-5 text-primary" />
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold">Vigtig information</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Denne quiz sikrer, at du kender og accepterer reglerne for brug af firmabiler.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <ChevronRight className="h-4 w-4 text-primary shrink-0" />
                    <span>Overhold Færdselsloven</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChevronRight className="h-4 w-4 text-primary shrink-0" />
                    <span>Forstå dit personlige ansvar</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChevronRight className="h-4 w-4 text-primary shrink-0" />
                    <span>Acceptér interne regler</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChevronRight className="h-4 w-4 text-primary shrink-0" />
                    <span>Forny hver 6. måned</span>
                  </div>
                </div>
                <p className="text-sm font-medium text-destructive">
                  Du skal svare rigtigt på ALLE spørgsmål for at bestå.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Questions */}
        <div className="space-y-4">
          {QUESTIONS.map((q, index) => (
            <Card 
              key={q.id} 
              className={`transition-all duration-200 ${
                answers[q.id] 
                  ? "border-primary/30 bg-primary/5" 
                  : "hover:border-muted-foreground/30"
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                    answers[q.id] 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {index + 1}
                  </div>
                  <CardTitle className="text-base font-medium leading-relaxed">
                    {q.question}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 pl-14">
                <RadioGroup
                  value={answers[q.id] || ""}
                  onValueChange={(value) => setAnswers(prev => ({ ...prev, [q.id]: value }))}
                  className="space-y-2"
                >
                  {q.options.map((option) => (
                    <div 
                      key={option.key} 
                      className={`flex items-start space-x-3 rounded-lg border p-3 transition-colors cursor-pointer ${
                        answers[q.id] === option.key 
                          ? "border-primary bg-primary/5" 
                          : "border-transparent hover:bg-muted/50"
                      }`}
                      onClick={() => setAnswers(prev => ({ ...prev, [q.id]: option.key }))}
                    >
                      <RadioGroupItem value={option.key} id={`q${q.id}-${option.key}`} className="mt-0.5" />
                      <Label htmlFor={`q${q.id}-${option.key}`} className="cursor-pointer text-sm leading-relaxed font-normal">
                        <span className="font-medium">{option.key}:</span> {option.text}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>
          ))}

          {/* GPS Acceptance */}
          <Card className={`transition-all duration-200 ${
            gpsAccepted ? "border-primary/30 bg-primary/5" : "border-amber-300 dark:border-amber-700"
          }`}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                  gpsAccepted 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400"
                }`}>
                  9
                </div>
                <CardTitle className="text-base font-medium">GPS-overvågning</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pl-14">
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-4 text-sm space-y-2 border border-amber-200 dark:border-amber-800/50">
                <p>Der sidder en chip/GPS-enhed i Copenhagen Sales' biler, som registrerer bl.a. fart og kørsel.</p>
                <p>Copenhagen Sales kan se, hvor hurtigt bilen er blevet ført, og hvordan den er blevet brugt.</p>
                <p className="font-medium">Formålet er sikkerhed, dokumentation og kontrol.</p>
              </div>

              <div 
                className={`flex items-start space-x-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                  gpsAccepted ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                }`}
                onClick={() => setGpsAccepted(!gpsAccepted)}
              >
                <Checkbox
                  id="gps-accept"
                  checked={gpsAccepted}
                  onCheckedChange={(checked) => setGpsAccepted(checked === true)}
                />
                <Label htmlFor="gps-accept" className="cursor-pointer text-sm leading-relaxed">
                  Ja, jeg accepterer at min kørsel overvåges via chip/GPS, og at virksomheden kan se disse data.
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Summary and final acceptance */}
          <Card className={`transition-all duration-200 ${
            summaryAccepted ? "border-green-500/50 bg-green-50/50 dark:bg-green-950/20" : "border-2 border-primary"
          }`}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  summaryAccepted 
                    ? "bg-green-100 dark:bg-green-900/40" 
                    : "bg-primary/10"
                }`}>
                  <Shield className={`h-5 w-5 ${summaryAccepted ? "text-green-600" : "text-primary"}`} />
                </div>
                <div>
                  <CardTitle className="text-base font-medium">Endelig bekræftelse</CardTitle>
                  <CardDescription>Læs og acceptér alle vilkår</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl bg-muted/50 p-5 border">
                <h4 className="font-semibold mb-4 text-sm uppercase tracking-wide text-muted-foreground">Ved at acceptere bekræfter du</h4>
                <ul className="space-y-3">
                  {SUMMARY_POINTS.map((point, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary shrink-0">
                        {index + 1}
                      </span>
                      <span className="text-sm leading-relaxed">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg bg-destructive/10 p-4 border border-destructive/30">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-destructive">Vigtigt</p>
                    <p className="text-destructive/80">
                      Ved at acceptere bekræfter du, at du forstår og accepterer dit personlige ansvar, 
                      herunder at du kan hæfte for bilens fulde værdi ved konfiskering pga. vandvidskørsel.
                    </p>
                  </div>
                </div>
              </div>

              <div 
                className={`flex items-start space-x-3 rounded-lg border-2 p-4 cursor-pointer transition-all ${
                  summaryAccepted 
                    ? "border-green-500 bg-green-50 dark:bg-green-950/30" 
                    : "border-dashed border-primary/50 hover:border-primary hover:bg-primary/5"
                }`}
                onClick={() => setSummaryAccepted(!summaryAccepted)}
              >
                <Checkbox
                  id="summary-accept"
                  checked={summaryAccepted}
                  onCheckedChange={(checked) => setSummaryAccepted(checked === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="summary-accept" className="cursor-pointer leading-relaxed font-medium">
                  Jeg har læst, forstået og accepterer alle ovenstående vilkår for brug af Copenhagen Sales' biler
                </Label>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Submit button */}
        <div className="sticky bottom-4 flex justify-center pt-4">
          <Button 
            size="lg" 
            onClick={handleSubmit}
            disabled={!allAnswered || submitQuiz.isPending}
            className="w-full max-w-md shadow-lg gap-2"
          >
            {submitQuiz.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Indsender...
              </>
            ) : (
              <>
                Indsend svar
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
