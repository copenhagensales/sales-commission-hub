import { Phone, Mail, CalendarIcon } from "lucide-react";
import { format, parse, isValid } from "date-fns";
import { da } from "date-fns/locale";
import { PhoneLink } from "@/components/ui/phone-link";

interface ReadOnlyRowProps {
  label: string;
  value: string | number | null | undefined;
  displayValue?: string | null;
  masked?: boolean;
}

export function ReadOnlyRow({ label, value, displayValue, masked }: ReadOnlyRowProps) {
  const displayText = masked && value ? "••••••••" : (displayValue ?? value ?? "-");

  return (
    <tr className="border-b border-border/50 last:border-0">
      <td className="py-2.5 pr-4 text-sm text-muted-foreground w-1/3">{label}</td>
      <td className="py-2.5 text-sm font-medium">{displayText}</td>
    </tr>
  );
}

interface ReadOnlyContactRowProps {
  label: string;
  value: string | null;
  type: "phone" | "email";
}

export function ReadOnlyContactRow({ label, value, type }: ReadOnlyContactRowProps) {
  if (type === "phone") {
    return (
      <tr className="border-b border-border/50 last:border-0">
        <td className="py-2.5 pr-4 text-sm text-muted-foreground w-1/3">{label}</td>
        <td className="py-2.5 text-sm font-medium">
          {value ? (
            <PhoneLink 
              phoneNumber={value} 
              className="text-primary hover:underline"
              iconClassName="h-3.5 w-3.5"
            />
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border/50 last:border-0">
      <td className="py-2.5 pr-4 text-sm text-muted-foreground w-1/3">{label}</td>
      <td className="py-2.5 text-sm font-medium">
        {value ? (
          <a 
            href={`mailto:${value}`} 
            className="text-primary hover:underline flex items-center gap-1.5"
          >
            <Mail className="h-3.5 w-3.5" />
            {value}
          </a>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </td>
    </tr>
  );
}

interface ReadOnlyDateRowProps {
  label: string;
  value: string | null;
}

export function ReadOnlyDateRow({ label, value }: ReadOnlyDateRowProps) {
  const dateValue = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;
  const isValidDate = dateValue && isValid(dateValue);

  return (
    <tr className="border-b border-border/50 last:border-0">
      <td className="py-2.5 pr-4 text-sm text-muted-foreground w-1/3">{label}</td>
      <td className="py-2.5 text-sm font-medium">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className={!isValidDate ? "text-muted-foreground" : ""}>
            {isValidDate ? format(dateValue, "d. MMMM yyyy", { locale: da }) : "-"}
          </span>
        </div>
      </td>
    </tr>
  );
}

interface ReadOnlyTableSectionProps {
  title: string;
  children: React.ReactNode;
}

export function ReadOnlyTableSection({ title, children }: ReadOnlyTableSectionProps) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="px-4 py-2.5 border-b border-border bg-muted/30">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <table className="w-full">
        <tbody className="divide-y divide-border/50">
          {children}
        </tbody>
      </table>
    </div>
  );
}
