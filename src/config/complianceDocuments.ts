/**
 * Registry over formelle compliance-dokumenter og deres review-cyklus.
 * Bruges til at vise en påmindelse i systemet når et dokument skal gennemgås igen.
 */

export interface ComplianceDocumentMeta {
  key: string;
  title: string;
  href: string;
  version: string;
  /** Dato for seneste godkendelse (ISO, YYYY-MM-DD). */
  approvedAt: string;
  /** Hvor ofte dokumentet skal gennemgås. */
  reviewIntervalMonths: number;
  permKey: string;
}

export const COMPLIANCE_DOCUMENTS: ComplianceDocumentMeta[] = [
  {
    key: "backup-policy",
    title: "Backup- og gendannelsespolitik (GDPR)",
    href: "/compliance/documents/backup-policy",
    version: "1.0",
    approvedAt: "2026-09-09",
    reviewIntervalMonths: 12,
    permKey: "menu_compliance_admin",
  },
  {
    key: "processing-registry",
    title: "Fortegnelse over behandlingsaktiviteter (art. 30)",
    href: "/compliance/documents/processing-registry",
    version: "1.0",
    approvedAt: "2026-09-09",
    reviewIntervalMonths: 12,
    permKey: "menu_compliance_admin",
  },
  {
    key: "dpa-overview",
    title: "Databehandleraftaler (DPA) — oversigt og status",
    href: "/compliance/documents/dpa-overview",
    version: "1.0",
    approvedAt: "2026-09-09",
    reviewIntervalMonths: 12,
    permKey: "menu_compliance_admin",
  },
];

/** Leverandører der skal have en arkiveret databehandleraftale i Stork. */
export const DPA_REQUIRED_VENDORS = ["Lovable", "Supabase", "Microsoft", "Adversus"];

/** Antal dage før deadline hvor påmindelsen begynder at vises. */
export const REVIEW_WARNING_DAYS = 30;

/**
 * Områder i compliance-sektionen der skal bekræftes gennemgået med et fast interval.
 * Bekræftelser gemmes i tabellen compliance_area_reviews og kan ikke ændres bagefter.
 */
export interface ComplianceReviewArea {
  key: string;
  title: string;
  href: string;
  reviewIntervalMonths: number;
}

export const COMPLIANCE_REVIEW_AREAS: ComplianceReviewArea[] = [
  { key: "processing-activities", title: "Behandlingsaktiviteter (art. 30)", href: "/compliance/processing-activities", reviewIntervalMonths: 12 },
  { key: "dpia", title: "Konsekvensanalyse (DPIA)", href: "/compliance/dpia", reviewIntervalMonths: 12 },
  { key: "retention-policies", title: "Sletningspolitikker", href: "/compliance/retention-policies", reviewIntervalMonths: 12 },
  { key: "data-transfers", title: "Dataoverførsler til tredjeparter", href: "/compliance/data-transfers", reviewIntervalMonths: 12 },
  { key: "ai-governance", title: "AI Governance", href: "/compliance/ai-governance", reviewIntervalMonths: 12 },
  { key: "processes", title: "Interne processer og compliance", href: "/compliance/processes", reviewIntervalMonths: 12 },
  { key: "awareness", title: "Medarbejder-awareness", href: "/compliance/awareness", reviewIntervalMonths: 12 },
];
