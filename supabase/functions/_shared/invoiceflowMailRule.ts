// Mail-regel-motor: finder vedhæftede PDF'er i en M365-indbakke ud fra regler.
// Genbruges i fase 2 til at læse engangskoder.
import { type MailRule } from "./invoiceflowMailMatch.ts";
import { matchesRule, attachmentMatches } from "./invoiceflowMailMatch.ts";
export type { MailRule };
export interface MailMatch {
  messageId: string;
  receivedAt: string;
  subject: string;
  attachments: { name: string; bytes: Uint8Array }[];
}

export class MailRuleError extends Error {
  constructor(public code: string, msg: string, public retryable: boolean) { super(msg); }
}

async function graphToken() {
  const t = Deno.env.get("M365_TENANT_ID"), id = Deno.env.get("M365_CLIENT_ID"), s = Deno.env.get("M365_CLIENT_SECRET");
  if (!t || !id || !s) throw new MailRuleError("M365_CONFIG", "M365 er ikke sat op", false);
  const r = await fetch(`https://login.microsoftonline.com/${t}/oauth2/v2.0/token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: s, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }),
  });
  if (!r.ok) { await r.text(); throw new MailRuleError("M365_TOKEN", `Token-fejl (${r.status})`, true); }
  return (await r.json()).access_token as string;
}

export async function findMailInvoices(rule: MailRule): Promise<MailMatch[]> {
  if (!rule.mailbox) throw new MailRuleError("RULE_INVALID", "Indbakke mangler i reglen", false);
  const token = await graphToken();
  const since = new Date(Date.now() - (rule.lookback_days ?? 35) * 86400_000).toISOString();
  const base = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(rule.mailbox)}`;
  const url = `${base}/messages?$filter=hasAttachments eq true and receivedDateTime ge ${since}&$select=id,subject,from,receivedDateTime&$top=50&$orderby=receivedDateTime desc`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 401 || r.status === 403) { await r.text(); throw new MailRuleError("GRAPH_NO_MAIL_READ", "Stork har ikke adgang til at læse indbakken (Mail.Read mangler)", false); }
  if (r.status === 404) { await r.text(); throw new MailRuleError("MAILBOX_NOT_FOUND", "Indbakken findes ikke", false); }
  if (!r.ok) { await r.text(); throw new MailRuleError("GRAPH_ERROR", `Graph-fejl (${r.status})`, true); }
  // deno-lint-ignore no-explicit-any
  const msgs: any[] = (await r.json()).value ?? [];
  const out: MailMatch[] = [];
  for (const m of msgs) {
    const from = m.from?.emailAddress?.address ?? "";
    if (!matchesRule(rule, { from, subject: m.subject ?? "" })) continue;
    const ar = await fetch(`${base}/messages/${m.id}/attachments`, { headers: { Authorization: `Bearer ${token}` } });
    if (!ar.ok) { await ar.text(); continue; }
    // deno-lint-ignore no-explicit-any
    const atts: any[] = (await ar.json()).value ?? [];
    const pdfs = atts.filter((a) => a.contentBytes && attachmentMatches(rule, a.name ?? "", a.contentType ?? ""))
      .map((a) => ({ name: a.name as string, bytes: Uint8Array.from(atob(a.contentBytes), (c) => c.charCodeAt(0)) }));
    if (pdfs.length) out.push({ messageId: m.id, receivedAt: m.receivedDateTime, subject: m.subject ?? "", attachments: pdfs });
  }
  return out;
}
