/**
 * Mailskabeloner til kvalitetsmodulet.
 *
 * Alle mails er komplette HTML-dokumenter, så process-scheduled-emails sender
 * dem uden at pakke dem i sin standardwrapper. Ingen kundedata må indgå — kun
 * sælger, team, kampagne, tidspunkt, søgenøgle, fejlkoder og kommentar.
 *
 * Designet følger det godkendte Copenhagen Sales mail-design: lys baggrund,
 * hvidt kort, mørk header med statuspille, datagitter, mørke fejlkode-pills,
 * kommentar med grøn kant og grøn CTA.
 */

const BRAND = {
  pageBg: "#e6eff1",
  card: "#ffffff",
  header: "#26262a",
  headerBorder: "#3a3a40",
  text: "#111318",
  muted: "#7b8794",
  headerMuted: "#b9bcc4",
  cellBg: "#f4f8f9",
  cellBorder: "#e2eaec",
  accent: "#2ee07f",
  accentText: "#0b1a13",
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
    month: "short",
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

export function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Lille overskrift som "SAGEN" / "FEJLKODE". */
function sectionLabel(text: string): string {
  return `<div style="font-size:11px;font-weight:700;letter-spacing:1.6px;color:${BRAND.muted};text-transform:uppercase;margin:0 0 12px;">${escapeHtml(text)}</div>`;
}

/** Datagitter i celler, tre pr. række. */
function dataGrid(items: Array<{ label: string; value: string; highlight?: boolean }>): string {
  const rows: string[] = [];
  for (let i = 0; i < items.length; i += 3) {
    const chunk = items.slice(i, i + 3);
    while (chunk.length < 3) chunk.push({ label: "", value: "" });
    rows.push(`<tr>${chunk
      .map((cell, idx) => {
        const borderRight = idx < 2 ? `border-right:1px solid ${BRAND.cellBorder};` : "";
        if (!cell.label && !cell.value) {
          return `<td width="33%" style="padding:18px 20px;${borderRight}"></td>`;
        }
        const value = cell.highlight
          ? `<span style="border-bottom:2px solid ${BRAND.accent};padding-bottom:2px;">${escapeHtml(cell.value)}</span>`
          : escapeHtml(cell.value);
        return `<td width="33%" valign="top" style="padding:18px 20px;${borderRight}">
          <div style="font-size:10px;font-weight:700;letter-spacing:1.4px;color:${BRAND.muted};text-transform:uppercase;">${escapeHtml(cell.label)}</div>
          <div style="font-size:15px;font-weight:700;color:${BRAND.text};margin-top:7px;">${value}</div>
        </td>`;
      })
      .join("")}</tr>`);
  }

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border:1px solid ${BRAND.cellBorder};border-radius:12px;background:${BRAND.cellBg};overflow:hidden;">
    ${rows.join(`<tr><td colspan="3" style="border-top:1px solid ${BRAND.cellBorder};font-size:0;line-height:0;">&nbsp;</td></tr>`)}
  </table>`;
}

/** Mørke pills, fx fejlkoder. */
function pills(values: string[]): string {
  return values
    .map(
      (v) =>
        `<span style="display:inline-block;background:${BRAND.header};color:#ffffff;font-size:14px;font-weight:700;padding:11px 18px;border-radius:10px;margin:0 8px 8px 0;">${escapeHtml(v)}</span>`,
    )
    .join("");
}

/** Kommentarblok med grøn venstrekant. */
function quote(html: string): string {
  return `<div style="border-left:4px solid ${BRAND.accent};background:${BRAND.cellBg};border-radius:0 10px 10px 0;padding:18px 20px;font-size:15px;line-height:1.65;color:${BRAND.text};">${html}</div>`;
}

function primaryButton(label: string, href: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:${BRAND.accent};color:${BRAND.accentText};text-decoration:none;font-size:15px;font-weight:700;padding:15px 26px;border-radius:12px;">${escapeHtml(label)}</a>`;
}

/**
 * Fælles ramme: lys side, hvidt kort, mørk header med statuspille.
 */
function shell(options: {
  badge: string;
  title: string;
  intro?: string;
  body: string;
}): string {
  const { badge, title, intro, body } = options;
  return `<!DOCTYPE html>
<html lang="da"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:28px 14px;background:${BRAND.pageBg};font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:660px;margin:0 auto;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      <tr>
        <td style="font-size:13px;font-weight:800;letter-spacing:2px;color:${BRAND.text};text-transform:uppercase;">Copenhagen Sales</td>
        <td align="right" style="font-size:13px;color:${BRAND.muted};">Kvalitetskontrol</td>
      </tr>
    </table>

    <div style="background:${BRAND.card};border-radius:18px;overflow:hidden;">
      <div style="background:${BRAND.header};padding:34px 34px 36px;">
        <span style="display:inline-block;border:1px solid ${BRAND.headerBorder};border-radius:999px;padding:9px 18px;font-size:12px;font-weight:800;letter-spacing:1.6px;color:#ffffff;text-transform:uppercase;">
          <span style="color:${BRAND.accent};">&bull;</span>&nbsp; ${escapeHtml(badge)}
        </span>
        <div style="font-size:30px;line-height:1.25;font-weight:800;color:#ffffff;margin-top:22px;">${escapeHtml(title)}</div>
        ${intro ? `<div style="font-size:15px;line-height:1.6;color:${BRAND.headerMuted};margin-top:14px;">${escapeHtml(intro)}</div>` : ""}
      </div>
      <div style="padding:30px 34px 34px;">
        ${body}
      </div>
    </div>

    <div style="text-align:center;color:${BRAND.muted};font-size:11px;padding:18px 0;">
      Copenhagen Sales · intern kvalitetskontrol. Resultatet påvirker ikke løn eller provision.
    </div>
  </div>
</body></html>`;
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
  const body = `
    ${sectionLabel("Sagen")}
    ${dataGrid([
      { label: "Sælger", value: data.sellerName },
      { label: "Team", value: data.teamName },
      { label: "Kampagne", value: data.campaignName },
      { label: "Salgstidspunkt", value: formatDanishDateTime(data.saleDateTime) || "Ikke oplyst" },
      { label: "Søgenøgle", value: data.searchKey ?? "Ikke oplyst", highlight: Boolean(data.searchKey) },
      { label: "Kontrolleret af", value: "Kvalitetsteamet" },
    ])}

    <div style="margin-top:28px;">
      ${sectionLabel("Fejlkode")}
      ${data.errorCodes.length ? pills(data.errorCodes) : `<div style="font-size:15px;color:${BRAND.muted};">Ingen koder valgt</div>`}
    </div>

    ${
      data.comment
        ? `<div style="margin-top:26px;">
             ${sectionLabel("Kvalitetsteamets kommentar")}
             ${quote(escapeHtml(data.comment).replace(/\n/g, "<br />"))}
           </div>`
        : ""
    }

    <div style="margin-top:30px;">
      ${primaryButton("Se salget i Stork", data.saleLink)}
    </div>
  `;
  return {
    subject,
    html: shell({
      badge: "Afvist i kvalitetskontrollen",
      title: "Et salg er afvist i kvalitetskontrollen",
      intro: "Du får denne mail som teamleder. Tag den med som coaching-punkt på næste 1:1.",
      body,
    }),
  };
}

export interface FeedbackMailData {
  sellerName: string;
  teamName: string;
  campaignName: string;
  saleDateTime: string | null;
  searchKey: string | null;
  comment: string | null;
  resultLabel: string;
  saleLink: string;
}

/**
 * Feedback uden anmærkning: salget er godkendt, men kontrollanten vil give
 * teamlederen en kommentar. Ingen fejlkoder — kun feedback.
 */
export function renderFeedbackMail(data: FeedbackMailData): { subject: string; html: string } {
  const subject = `Feedback fra kvalitetskontrol: ${data.sellerName}`;
  const body = `
    ${sectionLabel("Sagen")}
    ${dataGrid([
      { label: "Sælger", value: data.sellerName },
      { label: "Team", value: data.teamName },
      { label: "Kampagne", value: data.campaignName },
      { label: "Salgstidspunkt", value: formatDanishDateTime(data.saleDateTime) || "Ikke oplyst" },
      { label: "Søgenøgle", value: data.searchKey ?? "Ikke oplyst", highlight: Boolean(data.searchKey) },
      { label: "Resultat", value: data.resultLabel },
    ])}

    <div style="margin-top:26px;">
      ${sectionLabel("Kvalitetsteamets kommentar")}
      ${quote(escapeHtml(data.comment).replace(/\n/g, "<br />") || "Ingen kommentar")}
    </div>

    <div style="margin-top:16px;font-size:13px;color:${BRAND.muted};">
      Salget er ikke afvist, og der er ikke givet en anmærkning. Dette er alene feedback.
    </div>

    <div style="margin-top:28px;">
      ${primaryButton("Se salget i Stork", data.saleLink)}
    </div>
  `;
  return {
    subject,
    html: shell({
      badge: "Feedback uden anmærkning",
      title: "Feedback på et godkendt salg",
      intro: "Du får denne mail som teamleder. Salget er godkendt — brug feedbacken i coachingen.",
      body,
    }),
  };
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
      <div style="margin-top:16px;border-top:1px solid ${BRAND.cellBorder};padding-top:14px;">
        <div style="font-size:16px;font-weight:700;color:${BRAND.text};">${escapeHtml(s.sellerName)}</div>
        ${s.sales
          .map(
            (sale) => `<div style="margin-top:8px;font-size:14px;color:#4a5561;">
              ${escapeHtml(RESULT_LABEL[sale.result] ?? sale.result)} · ${escapeHtml(sale.campaignName)}${
              sale.searchKey ? ` · ${escapeHtml(sale.searchKey)}` : ""
            }${sale.errorCodes.length ? `<br /><span style="color:${BRAND.muted};">${sale.errorCodes.map(escapeHtml).join(", ")}</span>` : ""}
            </div>`,
          )
          .join("")}
      </div>`,
    )
    .join("");

  const body = `
    ${sectionLabel("Dagens tal")}
    ${dataGrid([
      { label: "Dato", value: formatDanishDate(data.date) },
      { label: "Kontrollerede salg", value: String(data.reviewedDay) },
      { label: "Dækningsgrad", value: `${data.coverageDay} i dag` },
      {
        label: "Afvist i dag",
        value: data.dayRejectedRate === null ? "–" : pct(data.dayRejectedRate, 100),
      },
      {
        label: "Bemærkning i dag",
        value: data.dayRemarkRate === null ? "–" : pct(data.dayRemarkRate, 100),
      },
      {
        label: "30 dage",
        value: `${data.d30RejectedRate === null ? "–" : pct(data.d30RejectedRate, 100)} afvist · ${data.coverage30} dækning`,
      },
    ])}

    <div style="margin-top:26px;">
      ${sectionLabel("Kontroller pr. sælger")}
      ${sellerBlocks || `<div style="font-size:15px;color:${BRAND.muted};">Ingen kontroller på teamet i dag.</div>`}
    </div>
  `;

  return {
    subject,
    html: shell({
      badge: "Dagens kvalitetskontrol",
      title: `Dagens kvalitetskontrol – ${data.teamName}`,
      intro: "Du får denne mail som teamleder. Brug den som udgangspunkt for dagens coaching.",
      body,
    }),
  };
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
  const th = `style="text-align:left;padding:10px 8px;font-size:10px;font-weight:700;letter-spacing:1.2px;color:${BRAND.muted};text-transform:uppercase;border-bottom:1px solid ${BRAND.cellBorder};"`;
  const td = `style="padding:11px 8px;font-size:14px;color:${BRAND.text};border-bottom:1px solid ${BRAND.cellBorder};"`;

  const body = `
    ${sectionLabel("Teams")}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
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

    <div style="margin-top:28px;">
      ${sectionLabel("Dagens afviste salg")}
      ${
        data.rejectedSales.length
          ? data.rejectedSales
              .map(
                (s) =>
                  `<div style="margin-top:8px;font-size:14px;color:${BRAND.text};">${escapeHtml(s.sellerName)} · ${escapeHtml(
                    s.teamName,
                  )} · ${escapeHtml(s.campaignName)}${
                    s.errorCodes.length
                      ? ` · <span style="color:${BRAND.muted};">${s.errorCodes.map(escapeHtml).join(", ")}</span>`
                      : ""
                  }</div>`,
              )
              .join("")
          : `<div style="font-size:14px;color:${BRAND.text};">Ingen afviste salg i dag.</div>`
      }
    </div>

    <div style="margin-top:28px;">
      ${sectionLabel("Hyppigste fejlkoder, 30 dage")}
      ${
        data.topCodes.length
          ? data.topCodes
              .map(
                (c) =>
                  `<div style="margin-top:8px;font-size:14px;color:${BRAND.text};">${escapeHtml(c.label)} · ${escapeHtml(c.share)}</div>`,
              )
              .join("")
          : `<div style="font-size:14px;color:${BRAND.muted};">Ingen fejlkoder registreret.</div>`
      }
    </div>
  `;

  return {
    subject,
    html: shell({
      badge: "Samlet kvalitetsoverblik",
      title: `Kvalitetskontrol – ${formatDanishDate(data.date)}`,
      intro: "Samlet overblik på tværs af teams for dagen.",
      body,
    }),
  };
}
