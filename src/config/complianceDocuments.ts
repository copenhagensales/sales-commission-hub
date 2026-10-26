/**
 * Registry over formelle compliance-dokumenter og deres review-cyklus.
 * Bruges til at vise en påmindelse i systemet når et dokument skal gennemgås igen.
 */

/** Selve dokumenterne, deres versioner og godkendelser ligger i databasen (compliance_documents). */

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
  { key: "processing-activities", title: "Behandlingsaktiviteter (art. 30)", href: "/compliance?tab=registre&side=processing-activities", reviewIntervalMonths: 12 },
  { key: "dpia", title: "Konsekvensanalyse (DPIA)", href: "/compliance?tab=registre&side=dpia", reviewIntervalMonths: 12 },
  { key: "retention-policies", title: "Sletningspolitikker", href: "/compliance?tab=registre&side=retention-policies", reviewIntervalMonths: 12 },
  { key: "data-transfers", title: "Dataoverførsler til tredjeparter", href: "/compliance?tab=registre&side=data-transfers", reviewIntervalMonths: 12 },
  { key: "ai-governance", title: "AI Governance", href: "/compliance?tab=procedurer&side=ai-governance", reviewIntervalMonths: 12 },
  { key: "processes", title: "Interne processer og compliance", href: "/compliance?tab=procedurer&side=processes", reviewIntervalMonths: 12 },
  { key: "awareness", title: "Medarbejder-awareness", href: "/compliance?tab=procedurer&side=awareness", reviewIntervalMonths: 12 },
];
