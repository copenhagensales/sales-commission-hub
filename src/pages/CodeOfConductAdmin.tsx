import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePositionPermissions";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, CheckCircle2, XCircle, AlertTriangle, Search, Users, FileText, Plus, Trash2, Save, ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { da } from "date-fns/locale";
import { MainLayout } from "@/components/layout/MainLayout";
import { CODE_OF_CONDUCT_QUESTIONS } from "@/hooks/useCodeOfConduct";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface EmployeeWithStatus {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  manager_id: string | null;
  completion: {
    passed_at: string;
    isExpired: boolean;
    daysUntilExpiry: number;
  } | null;
  totalAttempts: number;
  wrongAnswersBeforePass: number;
}

interface CodeOfConductQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: string;
}

export default function CodeOfConductAdmin() {
  const { scopeQuiz, canViewCocAdmin } = usePermissions();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set([1]));

  // Local state for editing - initialized from the hardcoded questions
  const [questions, setQuestions] = useState<CodeOfConductQuestion[]>(
    CODE_OF_CONDUCT_QUESTIONS.map(q => ({
      id: q.id,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
    }))
  );

  const toggleQuestion = (id: number) => {
    const newExpanded = new Set(expandedQuestions);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedQuestions(newExpanded);
  };

  // Get current user's employee ID for teamleder filtering
  const { data: currentEmployeeId } = useQuery({
    queryKey: ["current-employee-id", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const { data } = await supabase
        .from("employee_master_data")
        .select("id")
        .or(`private_email.eq.${user.email},work_email.eq.${user.email}`)
        .maybeSingle();
      return data?.id || null;
    },
    enabled: !!user?.email,
  });

  // Fetch all Salgskonsulenter with their Code of Conduct status
  const { data: employees, isLoading } = useQuery({
    queryKey: ["code-of-conduct-admin", currentEmployeeId, scopeQuiz],
    queryFn: async () => {
      // Get all Salgskonsulenter
      let query = supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, job_title, manager_id")
        .eq("is_active", true)
        .eq("job_title", "Salgskonsulent");

      // If scope is not "alt", filter by manager_id (teamleder can only see their team)
      if (scopeQuiz !== "alt" && currentEmployeeId) {
        query = query.eq("manager_id", currentEmployeeId);
      }

      const { data: employeesData, error } = await query.order("first_name");
      if (error) throw error;

      if (!employeesData || employeesData.length === 0) return [];

      const employeeIds = employeesData.map(e => e.id);

      // Get completions for all employees
      const { data: completions } = await supabase
        .from("code_of_conduct_completions")
        .select("employee_id, passed_at")
        .in("employee_id", employeeIds);

      // Get all attempts for statistics
      const { data: attempts } = await supabase
        .from("code_of_conduct_attempts")
        .select("employee_id, passed, wrong_question_numbers")
        .in("employee_id", employeeIds);

      // Build employee status map
      const completionMap = new Map(
        (completions || []).map(c => [c.employee_id, c])
      );

      // Calculate attempt statistics per employee
      const attemptStats = new Map<string, { total: number; wrongBeforePass: number }>();
      for (const attempt of attempts || []) {
        const current = attemptStats.get(attempt.employee_id) || { total: 0, wrongBeforePass: 0 };
        current.total += 1;
        if (!attempt.passed && attempt.wrong_question_numbers) {
          current.wrongBeforePass += (attempt.wrong_question_numbers as number[]).length;
        }
        attemptStats.set(attempt.employee_id, current);
      }

      return employeesData.map(emp => {
        const completion = completionMap.get(emp.id);
        const stats = attemptStats.get(emp.id) || { total: 0, wrongBeforePass: 0 };

        let completionStatus = null;
        if (completion) {
          const passedDate = new Date(completion.passed_at);
          const daysSincePassed = differenceInDays(new Date(), passedDate);
          const daysUntilExpiry = 60 - daysSincePassed; // 2 months
          completionStatus = {
            passed_at: completion.passed_at,
            isExpired: daysSincePassed >= 60, // 2 months
            daysUntilExpiry: Math.max(0, daysUntilExpiry),
          };
        }

        return {
          id: emp.id,
          first_name: emp.first_name,
          last_name: emp.last_name,
          job_title: emp.job_title,
          manager_id: emp.manager_id,
          completion: completionStatus,
          totalAttempts: stats.total,
          wrongAnswersBeforePass: stats.wrongBeforePass,
        } as EmployeeWithStatus;
      });
    },
    enabled: canViewCocAdmin && !!currentEmployeeId,
  });

  // Filter employees by search
  const filteredEmployees = useMemo(() => {
    if (!employees) return [];
    if (!searchQuery.trim()) return employees;

    const query = searchQuery.toLowerCase();
    return employees.filter(emp => 
      `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(query)
    );
  }, [employees, searchQuery]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (!employees) return { total: 0, passed: 0, expired: 0, notStarted: 0 };

    return {
      total: employees.length,
      passed: employees.filter(e => e.completion && !e.completion.isExpired).length,
      expired: employees.filter(e => e.completion?.isExpired).length,
      notStarted: employees.filter(e => !e.completion).length,
    };
  }, [employees]);

  const updateQuestion = (id: number, field: keyof CodeOfConductQuestion, value: any) => {
    setQuestions(prev => prev.map(q =>
      q.id === id ? { ...q, [field]: value } : q
    ));
  };

  const updateOption = (questionId: number, optionIndex: number, newText: string) => {
    setQuestions(prev => prev.map(q => {
      if (q.id === questionId) {
        const newOptions = [...q.options];
        newOptions[optionIndex] = newText;
        return { ...q, options: newOptions };
      }
      return q;
    }));
  };

  const addOption = (questionId: number) => {
    setQuestions(prev => prev.map(q => {
      if (q.id === questionId) {
        return { ...q, options: [...q.options, ""] };
      }
      return q;
    }));
  };

  const removeOption = (questionId: number, optionIndex: number) => {
    setQuestions(prev => prev.map(q => {
      if (q.id === questionId) {
        const newOptions = q.options.filter((_, i) => i !== optionIndex);
        // If the removed option was the correct answer, reset to first option
        const removedOption = q.options[optionIndex];
        const newCorrectAnswer = q.correctAnswer === removedOption ? newOptions[0] || "" : q.correctAnswer;
        return { ...q, options: newOptions, correctAnswer: newCorrectAnswer };
      }
      return q;
    }));
  };

  const addQuestion = () => {
    const newId = Math.max(...questions.map(q => q.id), 0) + 1;
    setQuestions(prev => [...prev, {
      id: newId,
      question: "",
      options: ["", ""],
      correctAnswer: "",
    }]);
    setExpandedQuestions(new Set([...expandedQuestions, newId]));
  };

  const removeQuestion = (id: number) => {
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  if (!canViewCocAdmin) {
    return (
      <MainLayout>
        <div className="container mx-auto">
          <Card>
            <CardContent className="py-12 text-center">
              <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Du har ikke adgang til denne side.</p>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Code of Conduct Overblik</h1>
            <p className="text-muted-foreground">
              {scopeQuiz === "alt" ? "Alle salgskonsulenter" : "Dit team"}
            </p>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overblik</TabsTrigger>
            <TabsTrigger value="template">
              <FileText className="h-4 w-4 mr-2" />
              Skabelon
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Salgskonsulenter
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <span className="text-2xl font-bold">{stats.total}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Bestået
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="text-2xl font-bold">{stats.passed}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Udløbet
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    <span className="text-2xl font-bold">{stats.expired}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Ikke påbegyndt
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-destructive" />
                    <span className="text-2xl font-bold">{stats.notStarted}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Search */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Søg efter medarbejder..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Employee Table */}
            <Card>
              <CardHeader>
                <CardTitle>Status oversigt</CardTitle>
                <CardDescription>
                  Oversigt over Code of Conduct & GDPR test resultater
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="py-12 text-center text-muted-foreground">
                    Indlæser...
                  </div>
                ) : filteredEmployees.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    Ingen salgskonsulenter fundet
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Medarbejder</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Sidst bestået</TableHead>
                        <TableHead className="text-right">Forsøg</TableHead>
                        <TableHead className="text-right">Forkerte svar</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEmployees.map((employee) => (
                        <TableRow key={employee.id}>
                          <TableCell className="font-medium">
                            {employee.first_name} {employee.last_name}
                          </TableCell>
                          <TableCell>
                            {employee.completion ? (
                              employee.completion.isExpired ? (
                                <Badge variant="outline" className="border-amber-500 text-amber-600">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Udløbet
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="border-green-500 text-green-600">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Bestået ({employee.completion.daysUntilExpiry}d)
                                </Badge>
                              )
                            ) : (
                              <Badge variant="outline" className="border-destructive text-destructive">
                                <XCircle className="h-3 w-3 mr-1" />
                                Ikke påbegyndt
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {employee.completion ? (
                              format(new Date(employee.completion.passed_at), "d. MMM yyyy", { locale: da })
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {employee.totalAttempts || 0}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={employee.wrongAnswersBeforePass > 0 ? "text-amber-600 font-medium" : ""}>
                              {employee.wrongAnswersBeforePass || 0}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="template" className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Spørgsmål ({questions.length})</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={addQuestion}>
                  <Plus className="h-4 w-4 mr-2" />
                  Tilføj spørgsmål
                </Button>
                <Button size="sm" disabled>
                  <Save className="h-4 w-4 mr-2" />
                  Gem ændringer
                </Button>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Bemærk: Ændringer i denne skabelon gemmes ikke permanent, da spørgsmålene er kodet direkte i systemet. 
              Kontakt udvikler for at gemme ændringer permanent.
            </p>

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
                            {q.options.map((option, optIndex) => (
                              <div key={optIndex} className="flex items-center gap-3">
                                <RadioGroupItem value={option} id={`${q.id}-${optIndex}`} />
                                <Badge variant={q.correctAnswer === option ? "default" : "outline"}>
                                  {optIndex + 1}
                                </Badge>
                                <Textarea
                                  value={option}
                                  onChange={(e) => updateOption(q.id, optIndex, e.target.value)}
                                  placeholder={`Svarmulighed ${optIndex + 1}...`}
                                  className="flex-1 min-h-[60px]"
                                />
                                {q.options.length > 2 && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeOption(q.id, optIndex)}
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
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
