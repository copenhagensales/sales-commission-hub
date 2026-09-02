import { useMutation } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface SendTrygCancellationInput {
  subject: string;
  body: string;
  phones: string[];
}

/** Sender annulleringsmail til de faste Tryg-modtagere via edge function. */
export function useSendTrygCancellation() {
  return useMutation({
    mutationFn: async (input: SendTrygCancellationInput) => {
      const { data, error } = await supabase.functions.invoke(
        "send-tryg-cancellation",
        { body: input },
      );

      if (error) {
        let message = error.message;
        if (error instanceof FunctionsHttpError) {
          const text = await error.context.text();
          try {
            const parsed = JSON.parse(text) as { error?: unknown };
            if (typeof parsed.error === "string") message = parsed.error;
            else if (parsed.error) message = JSON.stringify(parsed.error);
            else message = text;
          } catch {
            message = text || message;
          }
        }
        throw new Error(message);
      }

      return data as { success: boolean; recipients: string[]; phoneCount: number };
    },
  });
}
