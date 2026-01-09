import { cn } from "@/lib/utils";

export type FormResult = "win" | "loss" | "draw";

interface FormIndicatorProps {
  form: FormResult[];
  className?: string;
  compact?: boolean;
}

export function FormIndicator({ form, className, compact = false }: FormIndicatorProps) {
  const size = compact ? "w-4 h-4 text-[9px]" : "w-4 h-4 sm:w-5 sm:h-5 text-[10px] sm:text-xs";
  
  return (
    <div className={cn("flex gap-0.5", className)}>
      {form.map((result, i) => (
        <div
          key={i}
          className={cn(
            "rounded-full flex items-center justify-center font-bold",
            size,
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
