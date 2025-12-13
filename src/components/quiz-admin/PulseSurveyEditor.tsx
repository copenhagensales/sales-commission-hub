import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, GripVertical, Save, ChevronDown, ChevronUp } from "lucide-react";
import { PulseSurveyQuestion } from "@/hooks/useQuizTemplates";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface PulseSurveyEditorProps {
  questions: PulseSurveyQuestion[];
  onChange: (questions: PulseSurveyQuestion[]) => void;
  onSave: () => void;
  isSaving: boolean;
}

export function PulseSurveyEditor({
  questions,
  onChange,
  onSave,
  isSaving,
}: PulseSurveyEditorProps) {
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(
    new Set(questions[0] ? [questions[0].id] : [])
  );

  const toggleQuestion = (id: string) => {
    const newExpanded = new Set(expandedQuestions);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedQuestions(newExpanded);
  };

  const updateQuestion = (id: string, field: keyof PulseSurveyQuestion, value: any) => {
    const updated = questions.map((q) =>
      q.id === id ? { ...q, [field]: value } : q
    );
    onChange(updated);
  };

  const addQuestion = () => {
    const newId = `question_${Date.now()}`;
    const newQuestion: PulseSurveyQuestion = {
      id: newId,
      label: "",
      question: "",
      type: "rating",
      min: 1,
      max: 10,
    };
    onChange([...questions, newQuestion]);
    setExpandedQuestions(new Set([...expandedQuestions, newId]));
  };

  const removeQuestion = (id: string) => {
    onChange(questions.filter((q) => q.id !== id));
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
                      <Badge variant="secondary">{q.label || "Ny"}</Badge>
                      <span className="text-sm text-muted-foreground truncate max-w-md">
                        {q.question || "Nyt spørgsmål..."}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {q.min}-{q.max}
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
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Label (kort navn)</Label>
                      <Input
                        value={q.label}
                        onChange={(e) => updateQuestion(q.id, "label", e.target.value)}
                        placeholder="F.eks. NPS, Trivsel..."
                        className="mt-1.5"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Min score</Label>
                        <Input
                          type="number"
                          value={q.min}
                          onChange={(e) => updateQuestion(q.id, "min", parseInt(e.target.value) || 0)}
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label>Max score</Label>
                        <Input
                          type="number"
                          value={q.max}
                          onChange={(e) => updateQuestion(q.id, "max", parseInt(e.target.value) || 10)}
                          className="mt-1.5"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label>Spørgsmål</Label>
                    <Textarea
                      value={q.question}
                      onChange={(e) => updateQuestion(q.id, "question", e.target.value)}
                      placeholder="Skriv spørgsmålet her..."
                      className="mt-1.5"
                    />
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
    </div>
  );
}
