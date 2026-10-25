// Rene matchregler for mail-regler (ingen Deno-afhængigheder, testes med vitest).
export interface MailRule {
  mailbox: string;
  from_domain?: string;
  subject_contains?: string;
  attachment_contains?: string;
  lookback_days?: number;
}

export function matchesRule(rule: MailRule, msg: { from: string; subject: string }) {
  const from = msg.from.toLowerCase();
  if (rule.from_domain && !from.endsWith("@" + rule.from_domain.toLowerCase().replace(/^@/, "")) &&
      !from.endsWith("." + rule.from_domain.toLowerCase().replace(/^@/, ""))) return false;
  if (rule.subject_contains && !msg.subject.toLowerCase().includes(rule.subject_contains.toLowerCase())) return false;
  return true;
}

export function attachmentMatches(rule: MailRule, name: string, contentType: string) {
  const isPdf = contentType === "application/pdf" || name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return false;
  return !rule.attachment_contains || name.toLowerCase().includes(rule.attachment_contains.toLowerCase());
}

