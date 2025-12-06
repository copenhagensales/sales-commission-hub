import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Shield, CheckCircle2, XCircle, AlertTriangle, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  useCodeOfConductCompletion, 
  useCodeOfConductCurrentAttempt,
  useSubmitCodeOfConduct,
  CODE_OF_CONDUCT_QUESTIONS,
  useCodeOfConductLock
} from "@/hooks/useCodeOfConduct";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { da } from "date-fns/locale";

export default function CodeOfConduct() {
  const { toast } = useToast();
  const { data: completion, isLoading: completionLoading } = useCodeOfConductCompletion();
  const { data: currentAttempt, isLoading: attemptLoading } = useCodeOfConductCurrentAttempt();
  const { daysRemaining, isRequired } = useCodeOfConductLock();
  const submitQuiz = useSubmitCodeOfConduct();
  
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [showResult, setShowResult] = useState(false);
  const [wrongQuestions, setWrongQuestions] = useState<number[]>([]);

  // Determine which questions to show
  const questionsToShow = currentAttempt?.wrong_question_numbers?.length 
    ? CODE_OF_CONDUCT_QUESTIONS.filter(q => currentAttempt.wrong_question_numbers.includes(q.id))
    : CODE_OF_CONDUCT_QUESTIONS;

  const allQuestionsAnswered = questionsToShow.every(q => answers[q.id]);
  const totalQuestions = CODE_OF_CONDUCT_QUESTIONS.length;
  const answeredCount = Object.keys(answers).length;

  // Reset when attempt changes
  useEffect(() => {
    setAnswers({});
    setShowResult(false);
    setWrongQuestions([]);
  }, [currentAttempt?.id]);

  const handleSubmit = async () => {
    if (!allQuestionsAnswered) {
      toast({
        title: "Besvar alle spørgsmål",
        description: "Du skal besvare alle spørgsmål før du kan aflevere.",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await submitQuiz.mutateAsync({
        answers,
        questionsToAnswer: questionsToShow.map(q => q.id),
      });

      if (result.passed) {
        setShowResult(true);
        setWrongQuestions([]);
        toast({
          title: "Tillykke!",
          description: "Du har bestået Code of Conduct & GDPR testen.",
        });
      } else {
        setShowResult(true);
        setWrongQuestions(result.wrongQuestionNumbers);
        toast({
          title: "Ikke bestået",
          description: `${result.wrongQuestionNumbers.length} spørgsmål var forkerte. Prøv igen med de forkerte spørgsmål.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Fejl",
        description: "Der opstod en fejl. Prøv igen.",
        variant: "destructive",
      });
    }
  };

  const handleRetry = () => {
    setAnswers({});
    setShowResult(false);
    setWrongQuestions([]);
  };

  if (completionLoading || attemptLoading) {
    return (
      <div className="container mx-auto p-6 max-w-3xl">
        <div className="animate-pulse text-center text-muted-foreground py-12">
          Indlæser...
        </div>
      </div>
    );
  }

  // Show completion certificate if passed and not expired
  if (completion && !completion.isExpired) {
    const passedDate = new Date(completion.passed_at);
    const nextRenewal = new Date(passedDate);
    nextRenewal.setDate(nextRenewal.getDate() + 60); // 2 months

    return (
      <div className="container mx-auto p-6 max-w-3xl">
        <Card className="border-green-500/50 bg-green-50/30 dark:bg-green-950/10">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <Trophy className="h-10 w-10 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Code of Conduct & GDPR</CardTitle>
            <CardDescription className="text-base">
              Salgskonsulenter
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="relative rounded-lg border-2 border-green-500 bg-white dark:bg-background p-6 text-center">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-green-600 text-white text-lg px-4 py-1">BESTÅET</Badge>
              </div>
              
              <div className="mt-4 space-y-2">
                <p className="text-lg font-semibold">Du har gennemført testen</p>
                <p className="text-muted-foreground">
                  Bestået: {format(passedDate, "d. MMMM yyyy 'kl.' HH:mm", { locale: da })}
                </p>
              </div>
              
              <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Næste fornyelse:</p>
                <p className="font-medium">{format(nextRenewal, "d. MMMM yyyy", { locale: da })}</p>
                {daysRemaining !== null && daysRemaining > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    ({daysRemaining} dage tilbage)
                  </p>
                )}
              </div>
            </div>

            <div className="text-center text-sm text-muted-foreground">
              <p>Denne test skal gennemføres hver 2. måned.</p>
              <p>Du vil blive påmindet når det er tid til at tage testen igen.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show result if just submitted
  if (showResult && wrongQuestions.length > 0) {
    return (
      <div className="container mx-auto p-6 max-w-3xl">
        <Card className="border-destructive/50">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-xl">Ikke bestået</CardTitle>
            <CardDescription className="text-base">
              Du svarede forkert på {wrongQuestions.length} spørgsmål
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg bg-muted p-4">
              <h3 className="font-medium mb-3">Følgende spørgsmål var forkerte:</h3>
              <ul className="space-y-2">
                {wrongQuestions.map(qNum => {
                  const question = CODE_OF_CONDUCT_QUESTIONS.find(q => q.id === qNum);
                  return (
                    <li key={qNum} className="flex items-start gap-2 text-sm">
                      <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      <span className="line-clamp-2">
                        Spørgsmål {qNum}: {question?.question.substring(0, 60)}...
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="text-center text-muted-foreground text-sm">
              <p>Ved næste forsøg skal du kun besvare de spørgsmål, der var forkerte.</p>
            </div>

            <Button onClick={handleRetry} className="w-full" size="lg">
              Prøv igen med de forkerte spørgsmål
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Code of Conduct & GDPR</h1>
            <p className="text-muted-foreground">Salgskonsulenter</p>
          </div>
        </div>

        {isRequired && daysRemaining !== null && daysRemaining > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200 mb-4">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm">
              Du har {daysRemaining} dage til at gennemføre testen
            </span>
          </div>
        )}

        {currentAttempt?.wrong_question_numbers?.length ? (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-200">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm">
              Du skal besvare {questionsToShow.length} spørgsmål der var forkerte sidste gang
            </span>
          </div>
        ) : (
          <p className="text-muted-foreground">
            Besvar alle {totalQuestions} spørgsmål for at bestå testen. 
            Alle svar skal være korrekte.
          </p>
        )}
      </div>

      {/* Progress indicator */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur py-3 mb-6 border-b">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Besvaret: {answeredCount} af {questionsToShow.length}
          </span>
          <div className="flex items-center gap-2">
            <div className="h-2 w-32 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${(answeredCount / questionsToShow.length) * 100}%` }}
              />
            </div>
            <span className="text-sm font-medium">
              {Math.round((answeredCount / questionsToShow.length) * 100)}%
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {questionsToShow.map((question, index) => (
          <Card 
            key={question.id}
            className={cn(
              "transition-all duration-200",
              answers[question.id] ? "border-primary/30 bg-primary/5" : ""
            )}
          >
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between gap-4">
                <CardTitle className="text-base font-medium leading-relaxed">
                  <span className="text-primary font-bold mr-2">
                    {index + 1}.
                  </span>
                  {question.question}
                </CardTitle>
                {answers[question.id] && (
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                )}
              </div>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={answers[question.id] || ""}
                onValueChange={(value) => setAnswers(prev => ({ ...prev, [question.id]: value }))}
                className="space-y-3"
              >
                {question.options.map((option, optionIndex) => (
                  <div
                    key={optionIndex}
                    className={cn(
                      "flex items-start space-x-3 rounded-lg border p-4 cursor-pointer transition-colors",
                      answers[question.id] === option 
                        ? "border-primary bg-primary/5" 
                        : "hover:bg-muted/50"
                    )}
                    onClick={() => setAnswers(prev => ({ ...prev, [question.id]: option }))}
                  >
                    <RadioGroupItem 
                      value={option} 
                      id={`q${question.id}-${optionIndex}`}
                      className="mt-0.5"
                    />
                    <Label 
                      htmlFor={`q${question.id}-${optionIndex}`}
                      className="cursor-pointer leading-relaxed text-sm"
                    >
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Submit button */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur py-4 mt-6 border-t">
        <Button
          onClick={handleSubmit}
          disabled={!allQuestionsAnswered || submitQuiz.isPending}
          className="w-full"
          size="lg"
        >
          {submitQuiz.isPending ? "Afleverer..." : "Aflever test"}
        </Button>
        {!allQuestionsAnswered && (
          <p className="text-center text-sm text-muted-foreground mt-2">
            Besvar alle spørgsmål for at kunne aflevere
          </p>
        )}
      </div>
    </div>
  );
}
