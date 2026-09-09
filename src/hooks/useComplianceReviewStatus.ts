import { useMemo } from "react";
import {
  COMPLIANCE_DOCUMENTS,
  COMPLIANCE_REVIEW_AREAS,
  DPA_REQUIRED_VENDORS,
  REVIEW_WARNING_DAYS,
  type ComplianceDocumentMeta,
} from "@/config/complianceDocuments";
import { useDpaDocuments } from "@/hooks/useDpaDocuments";
import { useComplianceAreaReviews } from "@/hooks/useComplianceAreaReviews";

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
  const { data: areaReviews = [], isLoading: isLoadingReviews } = useComplianceAreaReviews();

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

    const latestByArea = new Map<string, string>();
    for (const r of areaReviews) {
      if (!latestByArea.has(r.area_key)) latestByArea.set(r.area_key, r.reviewed_at);
    }
    for (const area of COMPLIANCE_REVIEW_AREAS) {
      const last = latestByArea.get(area.key);
      if (!last) {
        result.push({
          key: `area-${area.key}`,
          title: `Mangler gennemgang: ${area.title}`,
          detail: "Ingen gennemgang er registreret endnu. Bekræft gennemgangen på compliance-forsiden.",
          href: area.href,
          severity: "missing",
        });
        continue;
      }
      const due = addMonths(new Date(last), area.reviewIntervalMonths);
      const daysLeft = Math.ceil((due.getTime() - now.getTime()) / 86_400_000);
      if (daysLeft < 0) {
        result.push({
          key: `area-${area.key}`,
          title: `Gennemgang overskredet: ${area.title}`,
          detail: `Skulle være gennemgået ${formatDa(due)}. Gennemgå og bekræft på ny.`,
          href: area.href,
          severity: "overdue",
        });
      } else if (daysLeft <= REVIEW_WARNING_DAYS) {
        result.push({
          key: `area-${area.key}`,
          title: `Gennemgang forfalder snart: ${area.title}`,
          detail: `Skal gennemgås inden ${formatDa(due)}.`,
          href: area.href,
          severity: "due_soon",
        });
      }
    }

    return result;
  }, [dpaDocuments, areaReviews]);

  return {
    items,
    count: items.length,
    hasOverdue: items.some((i) => i.severity === "overdue"),
    isLoading: isLoading || isLoadingReviews,
  };
}
