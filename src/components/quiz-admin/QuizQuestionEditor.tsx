import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, GripVertical, Save, ChevronDown, ChevronUp } from "lucide-react";
import { CarQuizQuestion, QuizOption } from "@/hooks/useQuizTemplates";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface QuizQuestionEditorProps {
  questions: CarQuizQuestion[];
  summaryPoints?: string[];
  onChange: (questions: CarQuizQuestion[], summaryPoints?: string[]) => void;
  onSave: () => void;
  isSaving: boolean;
}

export function QuizQuestionEditor({
  questions,
  summaryPoints = [],
  onChange,
  onSave,
  isSaving,
}: QuizQuestionEditorProps) {
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set([1]));

  const toggleQuestion = (id: number) => {
    const newExpanded = new Set(expandedQuestions);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedQuestions(newExpanded);
  };

  const updateQuestion = (id: number, field: keyof CarQuizQuestion, value: any) => {
    const updated = questions.map((q) =>
      q.id === id ? { ...q, [field]: value } : q
    );
    onChange(updated, summaryPoints);
  };

  const updateOption = (questionId: number, optionKey: string, newText: string) => {
    const updated = questions.map((q) => {
      if (q.id === questionId) {
        return {
          ...q,
          options: q.options.map((opt) =>
            opt.key === optionKey ? { ...opt, text: newText } : opt
          ),
        };
      }
      return q;
    });
    onChange(updated, summaryPoints);
  };

  const addOption = (questionId: number) => {
    const updated = questions.map((q) => {
      if (q.id === questionId) {
        const nextKey = String.fromCharCode(65 + q.options.length); // A, B, C, D, E...
        return {
          ...q,
          options: [...q.options, { key: nextKey, text: "" }],
        };
      }
      return q;
    });
    onChange(updated, summaryPoints);
  };

  const removeOption = (questionId: number, optionKey: string) => {
    const updated = questions.map((q) => {
      if (q.id === questionId) {
        const filteredOptions = q.options.filter((opt) => opt.key !== optionKey);
        // If the removed option was the correct answer, reset it
        const newCorrectAnswer =
          q.correctAnswer === optionKey ? filteredOptions[0]?.key || "" : q.correctAnswer;
        return {
          ...q,
          options: filteredOptions,
          correctAnswer: newCorrectAnswer,
        };
      }
      return q;
    });
    onChange(updated, summaryPoints);
  };

  const addQuestion = () => {
    const newId = Math.max(...questions.map((q) => q.id), 0) + 1;
    const newQuestion: CarQuizQuestion = {
      id: newId,
      question: "",
      options: [
        { key: "A", text: "" },
        { key: "B", text: "" },
      ],
      correctAnswer: "A",
    };
    onChange([...questions, newQuestion], summaryPoints);
    setExpandedQuestions(new Set([...expandedQuestions, newId]));
  };

  const removeQuestion = (id: number) => {
    onChange(
      questions.filter((q) => q.id !== id),
      summaryPoints
    );
  };

  const updateSummaryPoint = (index: number, value: string) => {
    const updated = [...summaryPoints];
    updated[index] = value;
    onChange(questions, updated);
  };

  const addSummaryPoint = () => {
    onChange(questions, [...summaryPoints, ""]);
  };

  const removeSummaryPoint = (index: number) => {
    onChange(
      questions,
      summaryPoints.filter((_, i) => i !== index)
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Spørgsmål ({questions.length})</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={addQuestion}>
            <Plus className="h-4 w-4 mr-2" />
            Tilføj spørgsmål
          </Button>
          <Button size="sm" onClick={onSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Gemmer..." : "Gem ændringer"}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {questions.map((q, index) => (
          <Collapsible
            key={q.id}
            open={expandedQuestions.has(q.id)}
            onOpenChange={() => toggleQuestion(q.id)}
          >
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="outline">Spørgsmål {index + 1}</Badge>
                      <span className="text-sm text-muted-foreground truncate max-w-md">
                        {q.question || "Nyt spørgsmål..."}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        Svar: {q.correctAnswer}
                      </Badge>
                      {expandedQuestions.has(q.id) ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4 pt-0">
                  <div>
                    <Label>Spørgsmål</Label>
                    <Textarea
                      value={q.question}
                      onChange={(e) => updateQuestion(q.id, "question", e.target.value)}
                      placeholder="Skriv spørgsmålet her..."
                      className="mt-1.5"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Svarmuligheder</Label>
                    <RadioGroup
                      value={q.correctAnswer}
                      onValueChange={(value) => updateQuestion(q.id, "correctAnswer", value)}
                    >
                      {q.options.map((option) => (
                        <div key={option.key} className="flex items-center gap-3">
                          <RadioGroupItem value={option.key} id={`${q.id}-${option.key}`} />
                          <Badge variant={q.correctAnswer === option.key ? "default" : "outline"}>
                            {option.key}
                          </Badge>
                          <Input
                            value={option.text}
                            onChange={(e) => updateOption(q.id, option.key, e.target.value)}
                            placeholder={`Svarmulighed ${option.key}...`}
                            className="flex-1"
                          />
                          {q.options.length > 2 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeOption(q.id, option.key)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </RadioGroup>
                    <Button variant="outline" size="sm" onClick={() => addOption(q.id)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Tilføj svarmulighed
                    </Button>
                  </div>

                  <div className="pt-2 border-t">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeQuestion(q.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Slet spørgsmål
                    </Button>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}
      </div>

      {summaryPoints.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Opsummeringspunkter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {summaryPoints.map((point, index) => (
              <div key={index} className="flex items-center gap-2">
                <Badge variant="outline" className="shrink-0">
                  {index + 1}
                </Badge>
                <Input
                  value={point}
                  onChange={(e) => updateSummaryPoint(index, e.target.value)}
                  placeholder="Opsummeringspunkt..."
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeSummaryPoint(index)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addSummaryPoint}>
              <Plus className="h-4 w-4 mr-2" />
              Tilføj punkt
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
