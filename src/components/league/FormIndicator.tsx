import { cn } from "@/lib/utils";

export type FormResult = "win" | "loss" | "draw";

interface FormIndicatorProps {
  form: FormResult[];
  className?: string;
}

export function FormIndicator({ form, className }: FormIndicatorProps) {
  return (
    <div className={cn("flex gap-1", className)}>
      {form.map((result, i) => (
        <div
          key={i}
          className={cn(
            "w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold",
            result === "win" && "bg-green-500 text-white",
            result === "loss" && "bg-red-500 text-white",
            result === "draw" && "bg-muted text-muted-foreground"
          )}
        >
          {result === "win" ? "✓" : result === "loss" ? "✗" : "—"}
        </div>
      ))}
    </div>
  );
}
