import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Printer } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ComplianceDocumentProps {
  title: string;
  version: string;
  documentDate: string;
  statusLabel: string;
  /** "draft" (default) = amber, "approved" = emerald */
  statusTone?: "draft" | "approved";
  children: ReactNode;
}

/**
 * Fælles ramme for læsbare compliance-dokumenter i Stork.
 * Indholdet kan printes eller gemmes som PDF via browserens printdialog.
 */
export function ComplianceDocument({
  title,
  version,
  documentDate,
  statusLabel,
  statusTone = "draft",
  children,
}: ComplianceDocumentProps) {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 doc-print-root">
      <div className="flex items-center justify-between gap-4" data-no-print>
        <Button variant="ghost" size="sm" onClick={() => navigate("/compliance")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Tilbage til Compliance
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" />
          Print / gem som PDF
        </Button>
      </div>

      <header className="space-y-3 border-b pb-5">
        <Badge
          variant="outline"
          className="bg-amber-500/10 text-amber-700 border-amber-500/30"
        >
          {statusLabel}
        </Badge>
        <h1 className="text-3xl font-bold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">
          Version {version} · Dato {documentDate} · Copenhagen Sales ApS · Stork
        </p>
      </header>

      <article className="space-y-8 text-sm leading-relaxed text-foreground">
        {children}
      </article>
    </div>
  );
}

export function DocSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">{heading}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function DocSubSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-md border bg-card p-4">
      <h3 className="font-medium text-foreground">{heading}</h3>
      <div className="space-y-2 text-muted-foreground">{children}</div>
    </div>
  );
}

export function Confirm({ children }: { children: ReactNode }) {
  return (
    <span className="font-medium text-amber-700">[BEKRÆFTES: {children}]</span>
  );
}
