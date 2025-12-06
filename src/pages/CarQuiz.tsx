import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useCarQuizCompletion, useCompleteCarQuiz } from "@/hooks/useCarQuiz";
import { CheckCircle, XCircle, Car, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { da } from "date-fns/locale";

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

export default function CarQuiz() {
  const { data: completion, isLoading } = useCarQuizCompletion();
  const completeQuiz = useCompleteCarQuiz();
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [gpsAccepted, setGpsAccepted] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [passed, setPassed] = useState(false);

  const handleSubmit = () => {
    // Check all answers
    const allCorrect = QUESTIONS.every(q => answers[q.id] === q.correctAnswer);
    const isValid = allCorrect && gpsAccepted;

    setPassed(isValid);
    setShowResults(true);

    if (isValid) {
      completeQuiz.mutate(undefined, {
        onSuccess: () => {
          toast.success("Tillykke! Du har bestået bil-quizzen.");
        },
        onError: () => {
          toast.error("Der opstod en fejl. Prøv igen.");
        },
      });
    }
  };

  const handleRetry = () => {
    setAnswers({});
    setGpsAccepted(false);
    setShowResults(false);
    setPassed(false);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="animate-pulse">Indlæser...</div>
      </div>
    );
  }

  // Already passed
  if (completion) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl">
        <Card className="border-green-500 bg-green-50 dark:bg-green-950/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div>
                <CardTitle className="text-green-700 dark:text-green-400">Quiz bestået</CardTitle>
                <CardDescription>
                  Du har bestået bil-quizzen den {format(new Date(completion.passed_at), "d. MMMM yyyy 'kl.' HH:mm", { locale: da })}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Du er nu godkendt til at bruge Copenhagen Sales' firmabiler. Husk altid at overholde færdselsloven og virksomhedens regler.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show failed result
  if (showResults && !passed) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl">
        <Card className="border-red-500 bg-red-50 dark:bg-red-950/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <XCircle className="h-8 w-8 text-red-600" />
              <div>
                <CardTitle className="text-red-700 dark:text-red-400">Ikke bestået</CardTitle>
                <CardDescription>
                  Du har ikke svaret korrekt på alle spørgsmål
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Du har ikke svaret korrekt på alle spørgsmål eller accepteret GPS-overvågningen. Læs reglerne igen og tag testen én gang til.
            </p>
            <Button onClick={handleRetry}>Tag testen igen</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const allAnswered = QUESTIONS.every(q => answers[q.id]) && gpsAccepted;

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Car className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Bil-quiz – Brug af firmabiler</h1>
          <p className="text-muted-foreground">Copenhagen Sales</p>
        </div>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Vigtig information</AlertTitle>
        <AlertDescription className="space-y-2 mt-2">
          <p>Denne quiz skal sikre, at du kender og accepterer reglerne for brug af Copenhagen Sales' biler.</p>
          <p>For at få lov til at bruge bilerne skal du:</p>
          <ul className="list-disc list-inside ml-2">
            <li>Overholde Færdselsloven</li>
            <li>Være indforstået med vores interne regler</li>
            <li>Forstå, at du selv hæfter for ulovlig kørsel, fartbøder, parkeringsafgifter m.m.</li>
            <li>Være indforstået med, at hvis bilen konfiskeres pga. vandvidskørsel, hæfter du personligt for bilens værdi</li>
          </ul>
          <p className="font-medium">Du skal svare rigtigt på alle spørgsmål for at bestå. Hvis du ikke består, skal du tage testen igen, indtil alle svar er korrekte.</p>
        </AlertDescription>
      </Alert>

      <div className="space-y-6">
        {QUESTIONS.map((q, index) => (
          <Card key={q.id}>
            <CardHeader>
              <CardTitle className="text-lg">
                Spørgsmål {index + 1}
              </CardTitle>
              <CardDescription className="text-foreground font-medium">
                {q.question}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={answers[q.id] || ""}
                onValueChange={(value) => setAnswers(prev => ({ ...prev, [q.id]: value }))}
              >
                {q.options.map((option) => (
                  <div key={option.key} className="flex items-center space-x-2">
                    <RadioGroupItem value={option.key} id={`q${q.id}-${option.key}`} />
                    <Label htmlFor={`q${q.id}-${option.key}`} className="cursor-pointer">
                      {option.key}: {option.text}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>
        ))}

        {/* GPS Acceptance */}
        <Card className="border-amber-500">
          <CardHeader>
            <CardTitle className="text-lg">Spørgsmål 9 – GPS-overvågning</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="bg-amber-50 dark:bg-amber-950/20 border-amber-300">
              <AlertDescription>
                <p className="mb-2">Der sidder en chip/GPS-enhed i Copenhagen Sales' biler, som registrerer bl.a. fart og kørsel.</p>
                <p className="mb-2">Det betyder, at Copenhagen Sales kan se, hvor hurtigt bilen er blevet ført, og hvordan den er blevet brugt.</p>
                <p>Formålet er sikkerhed, dokumentation og kontrol af, at bilerne bruges forsvarligt og efter virksomhedens regler.</p>
              </AlertDescription>
            </Alert>

            <div className="flex items-start space-x-3 pt-2">
              <Checkbox
                id="gps-accept"
                checked={gpsAccepted}
                onCheckedChange={(checked) => setGpsAccepted(checked === true)}
              />
              <Label htmlFor="gps-accept" className="cursor-pointer leading-relaxed">
                Ja, jeg er indforstået og accepterer, at min kørsel i Copenhagen Sales' biler bliver registreret og overvåget via chip/GPS, og at virksomheden kan se disse data.
              </Label>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end pt-4">
        <Button 
          size="lg" 
          onClick={handleSubmit}
          disabled={!allAnswered || completeQuiz.isPending}
        >
          {completeQuiz.isPending ? "Gemmer..." : "Indsend svar"}
        </Button>
      </div>
    </div>
  );
}
