import { cn } from "@/lib/utils";

type Status = "pending" | "active" | "cancelled" | "clawbacked" | "draft" | "approved" | "exported";

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

const statusConfig: Record<Status, { label: string; className: string }> = {
  pending: { label: "Afventer", className: "bg-warning/15 text-warning border-warning/30" },
  active: { label: "Aktiv", className: "bg-success/15 text-success border-success/30" },
  cancelled: { label: "Annulleret", className: "bg-danger/15 text-danger border-danger/30" },
  clawbacked: { label: "Modregnet", className: "bg-danger/15 text-danger border-danger/30" },
  draft: { label: "Kladde", className: "bg-muted text-muted-foreground border-border" },
  approved: { label: "Godkendt", className: "bg-success/15 text-success border-success/30" },
  exported: { label: "Eksporteret", className: "bg-primary/15 text-primary border-primary/30" },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending;
  
  return (
    <span 
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
