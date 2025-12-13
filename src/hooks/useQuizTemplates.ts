import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface QuizOption {
  key: string;
  text: string;
}

export interface CarQuizQuestion {
  id: number;
  question: string;
  options: QuizOption[];
  correctAnswer: string;
}

export interface PulseSurveyQuestion {
  id: string;
  label: string;
  question: string;
  type: "rating";
  min: number;
  max: number;
}

export interface CodeOfConductQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: string;
}

export type QuizType = "car_quiz" | "code_of_conduct" | "pulse_survey";

export interface QuizTemplate {
  id: string;
  quiz_type: QuizType;
  questions: CarQuizQuestion[] | PulseSurveyQuestion[] | CodeOfConductQuestion[];
  summary_points: string[] | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export function useQuizTemplate(quizType: QuizType) {
  return useQuery({
    queryKey: ["quiz-template", quizType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quiz_templates")
        .select("*")
        .eq("quiz_type", quizType)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      
      return {
        id: data.id,
        quiz_type: data.quiz_type as QuizType,
        questions: data.questions as unknown as CarQuizQuestion[] | PulseSurveyQuestion[] | CodeOfConductQuestion[],
        summary_points: data.summary_points as unknown as string[] | null,
        created_at: data.created_at,
        updated_at: data.updated_at,
        updated_by: data.updated_by,
      } as QuizTemplate;
    },
  });
}

export function useUpdateQuizTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      quizType,
      questions,
      summaryPoints,
    }: {
      quizType: QuizType;
      questions: any[];
      summaryPoints?: string[];
    }) => {
      const { data: existing } = await supabase
        .from("quiz_templates")
        .select("id")
        .eq("quiz_type", quizType)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("quiz_templates")
          .update({
            questions,
            summary_points: summaryPoints || [],
          })
          .eq("quiz_type", quizType);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("quiz_templates").insert({
          quiz_type: quizType,
          questions,
          summary_points: summaryPoints || [],
        });

        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["quiz-template", variables.quizType] });
      toast.success("Skabelon gemt");
    },
    onError: (error: any) => {
      console.error("Error saving quiz template:", error);
      toast.error("Kunne ikke gemme skabelon");
    },
  });
}
