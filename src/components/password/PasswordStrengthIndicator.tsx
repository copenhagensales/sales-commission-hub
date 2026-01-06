import { useMemo } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  validatePassword,
  getPasswordStrengthLabel,
  getPasswordStrengthColor,
  PASSWORD_REQUIREMENTS,
} from "@/lib/password-validation";

interface PasswordStrengthIndicatorProps {
  password: string;
  showRequirements?: boolean;
  className?: string;
}

export function PasswordStrengthIndicator({
  password,
  showRequirements = true,
  className,
}: PasswordStrengthIndicatorProps) {
  const validation = useMemo(() => validatePassword(password), [password]);

  if (!password) return null;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Strength bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-xs">
          <span className="text-muted-foreground">Styrke:</span>
          <span
            className={cn(
              "font-medium",
              validation.score <= 1 && "text-destructive",
              validation.score === 2 && "text-yellow-600",
              validation.score >= 3 && "text-green-600"
            )}
          >
            {getPasswordStrengthLabel(validation.score)}
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all duration-300 rounded-full",
              getPasswordStrengthColor(validation.score)
            )}
            style={{ width: `${(validation.score + 1) * 20}%` }}
          />
        </div>
      </div>

      {/* Requirements checklist */}
      {showRequirements && (
        <div className="space-y-1">
          {PASSWORD_REQUIREMENTS.map((req) => {
            const passed = req.validator(password);
            return (
              <div
                key={req.key}
                className={cn(
                  "flex items-center gap-2 text-xs transition-colors",
                  passed ? "text-green-600" : "text-muted-foreground"
                )}
              >
                {passed ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <X className="h-3 w-3" />
                )}
                <span>{req.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Suggestions */}
      {validation.suggestions.length > 0 && validation.isValid && (
        <div className="text-xs text-muted-foreground mt-2">
          <span className="font-medium">Tip: </span>
          {validation.suggestions[0]}
        </div>
      )}
    </div>
  );
}
