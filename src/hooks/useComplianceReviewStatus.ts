import { useMemo } from "react";
import {
  COMPLIANCE_DOCUMENTS,
  DPA_REQUIRED_VENDORS,
  REVIEW_WARNING_DAYS,
  type ComplianceDocumentMeta,
} from "@/config/complianceDocuments";
import { useDpaDocuments } from "@/hooks/useDpaDocuments";

export type ComplianceItemSeverity = "overdue" | "due_soon" | "missing";

export interface ComplianceReviewItem {
  key: string;
  title: string;
  detail: string;
  href: string;
  severity: ComplianceItemSeverity;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date.getTime());
  next.setMonth(next.getMonth() + months);
  return next;
}

function nextReviewDate(doc: ComplianceDocumentMeta): Date {
  return addMonths(new Date(`${doc.approvedAt}T00:00:00`), doc.reviewIntervalMonths);
}

function formatDa(date: Date): string {
  return date.toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Samler alt der mangler review i compliance-sektionen:
 * - dokumenter hvis review-frist er overskredet eller nærmer sig
 * - leverandører uden arkiveret databehandleraftale
 */
export function useComplianceReviewStatus() {
  const { data: dpaDocuments = [], isLoading } = useDpaDocuments();

  const items = useMemo<ComplianceReviewItem[]>(() => {
    const now = new Date();
    const result: ComplianceReviewItem[] = [];

    for (const doc of COMPLIANCE_DOCUMENTS) {
      const due = nextReviewDate(doc);
      const daysLeft = Math.ceil((due.getTime() - now.getTime()) / 86_400_000);
      if (daysLeft < 0) {
        result.push({
          key: `doc-${doc.key}`,
          title: doc.title,
          detail: `Skulle være gennemgået ${formatDa(due)}. Gennemgå og godkend på ny.`,
          href: doc.href,
          severity: "overdue",
        });
      } else if (daysLeft <= REVIEW_WARNING_DAYS) {
        result.push({
          key: `doc-${doc.key}`,
          title: doc.title,
          detail: `Skal gennemgås inden ${formatDa(due)}.`,
          href: doc.href,
          severity: "due_soon",
        });
      }
    }

    const archivedVendors = new Set(dpaDocuments.map((d) => d.vendor));
    for (const vendor of DPA_REQUIRED_VENDORS) {
      if (!archivedVendors.has(vendor)) {
        result.push({
          key: `dpa-${vendor}`,
          title: `Databehandleraftale mangler arkivering: ${vendor}`,
          detail: "Upload aftalen som fil i DPA-oversigten, så dokumentationen er på plads.",
          href: "/compliance/documents/dpa-overview",
          severity: "missing",
        });
      }
    }

    return result;
  }, [dpaDocuments]);

  return {
    items,
    count: items.length,
    hasOverdue: items.some((i) => i.severity === "overdue"),
    isLoading,
  };
}
