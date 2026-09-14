/**
 * Mailskabeloner til kvalitetsmodulet.
 *
 * Alle mails er komplette HTML-dokumenter, så process-scheduled-emails sender
 * dem uden at pakke dem i sin standardwrapper. Ingen kundedata må indgå — kun
 * sælger, team, kampagne, tidspunkt, søgenøgle, fejlkoder og kommentar.
 */

const BRAND = {
  bg: "#f5f5f7",
  card: "#141419",
  cardBorder: "#26262e",
  text: "#ffffff",
  muted: "#9a9aa8",
  accent: "#e4572e",
  ok: "#3ecf8e",
};

export const RESULT_LABEL: Record<string, string> = {
  godkendt: "Godkendt",
  godkendt_med_bemaerkning: "Godkendt m. bemærkning",
  afvist: "Afvist",
  ikke_kontrolleret: "Ikke kontrolleret",
};

export function formatDanishDateTime(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("da-DK", {
    timeZone: "Europe/Copenhagen",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDanishDate(iso: string): string {
  return new Intl.DateTimeFormat("da-DK", {
    timeZone: "Europe/Copenhagen",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${iso}T12:00:00Z`));
}

export function pct(part: number, whole: number): string {
  if (!whole) return "–";
  return `${(Math.round((part / whole) * 1000) / 10).toString().replace(".", ",")} %`;
}

export function trendArrow(current: number | null, previous: number | null): string {
  if (current === null || previous === null) return "";
  if (Math.abs(current - previous) < 0.05) return " →";
  return current > previous ? " ↑" : " ↓";
}

export function rate(part: number, whole: number): number | null {
  if (!whole) return null;
  return (part / whole) * 100;
}

function shell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="da"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:24px 12px;background:${BRAND.bg};font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:660px;margin:0 auto;">
    <div style="background:${BRAND.card};border:1px solid ${BRAND.cardBorder};border-radius:18px;padding:28px;color:${BRAND.text};">
      <div style="font-size:11px;letter-spacing:2px;color:${BRAND.muted};text-transform:uppercase;">Kvalitetskontrol</div>
      <div style="font-size:22px;font-weight:600;margin-top:6px;">${escapeHtml(title)}</div>
      ${body}
    </div>
    <div style="text-align:center;color:#8a8a95;font-size:11px;padding:16px 0;">
      Copenhagen Sales · intern kvalitetskontrol. Resultatet påvirker ikke løn eller provision.
    </div>
  </div>
</body></html>`;
}

export function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function labelValue(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;color:${BRAND.muted};font-size:13px;width:38%;">${escapeHtml(label)}</td>
    <td style="padding:6px 0;font-size:13px;">${escapeHtml(value)}</td>
  </tr>`;
}

export interface RejectionMailData {
  sellerName: string;
  teamName: string;
  campaignName: string;
  saleDateTime: string | null;
  searchKey: string | null;
  errorCodes: string[];
  comment: string | null;
  saleLink: string;
}

export function renderRejectionMail(data: RejectionMailData): { subject: string; html: string } {
  const subject = `Afvist kvalitetskontrol: ${data.sellerName}`;
  const html = shell("Et salg er afvist i kvalitetskontrollen", `
    <table style="width:100%;border-collapse:collapse;margin-top:18px;">
      ${labelValue("Sælger", data.sellerName)}
      ${labelValue("Team", data.teamName)}
      ${labelValue("Kampagne", data.campaignName)}
      ${labelValue("Salgstidspunkt", formatDanishDateTime(data.saleDateTime))}
      ${labelValue("Søgenøgle", data.searchKey ?? "Ikke oplyst")}
    </table>
    <div style="margin-top:20px;">
      <div style="font-size:11px;letter-spacing:1.5px;color:${BRAND.muted};text-transform:uppercase;">Fejlkoder</div>
      <div style="margin-top:8px;font-size:14px;">${
        data.errorCodes.length
          ? data.errorCodes.map((c) => escapeHtml(c)).join("<br />")
          : "Ingen koder valgt"
      }</div>
    </div>
    ${
      data.comment
        ? `<div style="margin-top:20px;">
             <div style="font-size:11px;letter-spacing:1.5px;color:${BRAND.muted};text-transform:uppercase;">Kommentar</div>
             <div style="margin-top:8px;font-size:14px;line-height:1.6;">${escapeHtml(data.comment)}</div>
           </div>`
        : ""
    }
    <div style="margin-top:26px;">
      <a href="${escapeHtml(data.saleLink)}" style="display:inline-block;background:${BRAND.accent};color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;">Se salget i Stork</a>
    </div>
  `);
  return { subject, html };
}

export interface TeamSummarySeller {
  sellerName: string;
  sales: Array<{ result: string; campaignName: string; searchKey: string | null; errorCodes: string[] }>;
}

export interface TeamSummaryData {
  teamName: string;
  date: string;
  sellers: TeamSummarySeller[];
  dayRejectedRate: number | null;
  dayRemarkRate: number | null;
  d30RejectedRate: number | null;
  d30RemarkRate: number | null;
  coverageDay: string;
  coverage30: string;
  reviewedDay: number;
}

export function renderTeamSummaryMail(data: TeamSummaryData): { subject: string; html: string } {
  const subject = `Kvalitetskontrol ${data.teamName} – ${formatDanishDate(data.date)}`;
  const sellerBlocks = data.sellers
    .map(
      (s) => `
      <div style="margin-top:18px;border-top:1px solid ${BRAND.cardBorder};padding-top:14px;">
        <div style="font-size:15px;font-weight:600;">${escapeHtml(s.sellerName)}</div>
        ${s.sales
          .map(
            (sale) => `<div style="margin-top:8px;font-size:13px;color:#d5d5de;">
              ${escapeHtml(RESULT_LABEL[sale.result] ?? sale.result)} · ${escapeHtml(sale.campaignName)}${
              sale.searchKey ? ` · ${escapeHtml(sale.searchKey)}` : ""
            }${sale.errorCodes.length ? `<br /><span style="color:${BRAND.muted};">${sale.errorCodes.map(escapeHtml).join(", ")}</span>` : ""}
            </div>`,
          )
          .join("")}
      </div>`,
    )
    .join("");

  const html = shell(`Dagens kvalitetskontrol – ${data.teamName}`, `
    <table style="width:100%;border-collapse:collapse;margin-top:18px;">
      ${labelValue("Dato", formatDanishDate(data.date))}
      ${labelValue("Kontrollerede salg", String(data.reviewedDay))}
      ${labelValue(
        "Afvisningsprocent",
        `${data.dayRejectedRate === null ? "–" : pct(data.dayRejectedRate, 100)} i dag · ${
          data.d30RejectedRate === null ? "–" : pct(data.d30RejectedRate, 100)
        } over 30 dage`,
      )}
      ${labelValue(
        "Bemærkningsprocent",
        `${data.dayRemarkRate === null ? "–" : pct(data.dayRemarkRate, 100)} i dag · ${
          data.d30RemarkRate === null ? "–" : pct(data.d30RemarkRate, 100)
        } over 30 dage`,
      )}
      ${labelValue("Dækningsgrad", `${data.coverageDay} i dag · ${data.coverage30} over 30 dage`)}
    </table>
    ${sellerBlocks || `<div style="margin-top:18px;font-size:14px;color:${BRAND.muted};">Ingen kontroller på teamet i dag.</div>`}
  `);
  return { subject, html };
}

export interface ManagementTeamRow {
  teamName: string;
  reviewed: number;
  coverage: string;
  rejectedDay: string;
  remarkDay: string;
  rejected30: string;
  remark30: string;
}

export interface ManagementMailData {
  date: string;
  teams: ManagementTeamRow[];
  rejectedSales: Array<{ sellerName: string; teamName: string; campaignName: string; errorCodes: string[] }>;
  topCodes: Array<{ label: string; share: string }>;
}

export function renderManagementMail(data: ManagementMailData): { subject: string; html: string } {
  const subject = `Kvalitetskontrol samlet – ${formatDanishDate(data.date)}`;
  const th = `style="text-align:left;padding:8px 6px;font-size:11px;letter-spacing:1px;color:${BRAND.muted};text-transform:uppercase;border-bottom:1px solid ${BRAND.cardBorder};"`;
  const td = `style="padding:8px 6px;font-size:13px;border-bottom:1px solid ${BRAND.cardBorder};"`;

  const html = shell(`Kvalitetskontrol – ${formatDanishDate(data.date)}`, `
    <table style="width:100%;border-collapse:collapse;margin-top:18px;">
      <tr>
        <th ${th}>Team</th><th ${th}>Kontrol</th><th ${th}>Dækning</th>
        <th ${th}>Afvist</th><th ${th}>Bemærk.</th><th ${th}>Afvist 30d</th><th ${th}>Bemærk. 30d</th>
      </tr>
      ${data.teams
        .map(
          (t) => `<tr>
            <td ${td}>${escapeHtml(t.teamName)}</td>
            <td ${td}>${t.reviewed}</td>
            <td ${td}>${escapeHtml(t.coverage)}</td>
            <td ${td}>${escapeHtml(t.rejectedDay)}</td>
            <td ${td}>${escapeHtml(t.remarkDay)}</td>
            <td ${td}>${escapeHtml(t.rejected30)}</td>
            <td ${td}>${escapeHtml(t.remark30)}</td>
          </tr>`,
        )
        .join("")}
    </table>

    <div style="margin-top:26px;font-size:11px;letter-spacing:1.5px;color:${BRAND.muted};text-transform:uppercase;">Dagens afviste salg</div>
    ${
      data.rejectedSales.length
        ? data.rejectedSales
            .map(
              (s) =>
                `<div style="margin-top:8px;font-size:13px;">${escapeHtml(s.sellerName)} · ${escapeHtml(
                  s.teamName,
                )} · ${escapeHtml(s.campaignName)}${
                  s.errorCodes.length
                    ? ` · <span style="color:${BRAND.muted};">${s.errorCodes.map(escapeHtml).join(", ")}</span>`
                    : ""
                }</div>`,
            )
            .join("")
        : `<div style="margin-top:8px;font-size:13px;color:${BRAND.ok};">Ingen afviste salg i dag.</div>`
    }

    <div style="margin-top:26px;font-size:11px;letter-spacing:1.5px;color:${BRAND.muted};text-transform:uppercase;">Hyppigste fejlkoder, 30 dage</div>
    ${
      data.topCodes.length
        ? data.topCodes
            .map(
              (c) =>
                `<div style="margin-top:8px;font-size:13px;">${escapeHtml(c.label)} · ${escapeHtml(c.share)}</div>`,
            )
            .join("")
        : `<div style="margin-top:8px;font-size:13px;color:${BRAND.muted};">Ingen fejlkoder registreret.</div>`
    }
  `);
  return { subject, html };
}
