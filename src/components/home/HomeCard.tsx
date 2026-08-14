import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface HomeCardProps {
  icon?: LucideIcon;
  title: string;
  /** Optional short title used on very small screens */
  titleShort?: string;
  /** Right-aligned slot in the header (meta info or an action button) */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

/**
 * Shared card shell for the home page.
 * One place to change the card grammar: same radius, same 1px border,
 * same translucent surface, same header rhythm.
 */
export function HomeCard({
  icon: Icon,
  title,
  titleShort,
  action,
  children,
  className,
  contentClassName,
}: HomeCardProps) {
  return (
    <section
      className={cn(
        "flex flex-col rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm",
        className
      )}
    >
      <header className="flex h-12 items-center justify-between gap-3 border-b border-border/40 px-4">
        <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
          {Icon && <Icon className="h-4 w-4 shrink-0 text-primary" />}
          {titleShort ? (
            <>
              <span className="hidden truncate sm:inline">{title}</span>
              <span className="truncate sm:hidden">{titleShort}</span>
            </>
          ) : (
            <span className="truncate">{title}</span>
          )}
        </h2>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </header>
      <div className={cn("flex-1 p-4", contentClassName)}>{children}</div>
    </section>
  );
}

interface HomeCardEmptyProps {
  icon?: LucideIcon;
  title: string;
  hint?: string;
}

export function HomeCardEmpty({ icon: Icon, title, hint }: HomeCardEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-8 text-center">
      {Icon && <Icon className="mb-1 h-7 w-7 text-muted-foreground/40" />}
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      {hint && <p className="text-xs text-muted-foreground/70">{hint}</p>}
    </div>
  );
}
