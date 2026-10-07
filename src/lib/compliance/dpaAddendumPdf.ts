import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { FIGTREE_REGULAR, FIGTREE_EXTRABOLD } from "./fonts/figtree";

/** Låst indhold for én version af tillægget. Gemmes 1:1 som JSON i dpa_addenda.content. */
export interface DpaAddendumContent {
  version: number;
  generated_at: string;
  client: { name: string; legal_name: string; cvr: string; address: string };
  original_agreement: { title: string; date: string };
  subprocessor_approval: { form: "general" | "specific"; notice_days: number | null };
  /** Sand når aftaleparten har flere Stork-kunder; tabellen i afsnit 1 får da kolonnen "Brand". */
  multi_brand?: boolean;
  campaigns: Array<{
    name: string;
    /** Kundens visningsnavn i tillægget (brand). Valgfri for ældre versioner. */
    brand?: string;
    fields: string[];
    /** Datakilde (fritekst). Valgfri for bagudkompatibilitet med ældre versioner. */
    data_source?: string | null;
    retention_days: number | null;
    /** Manuel opbevaringstekst; bruges 1:1 frem for retention_days. Valgfri for ældre versioner. */
    retention_text?: string | null;
    missing_retention: boolean;
  }>;
  subprocessors: Array<{
    name: string;
    registration: string;
    processing: string;
    location: string;
    transfer_basis: string;
  }>;
  hosting: string;
  other_changes: string | null;
}

export const PROCESSOR = {
  name: "Copenhagen Sales ApS",
  cvr: "35890513",
  address: "Vesterbrogade 149, 1620 København V",
};

export const HOSTING_TEXT = "Supabase, EU-regionen Paris (eu-west-3)";

/**
 * Rækker til afsnit 1 uden kampagnenavne. Identiske rækker slås sammen; rækker med samme
 * oplysninger og datakilde men forskellig (kendt) opbevaring vises som "X–Y dage afhængigt af aktivitet".
 * En manuel opbevaringstekst bruges 1:1 og er selv en del af sammenligningen.
 */
export function buildSection1Rows(campaigns: DpaAddendumContent["campaigns"], multiBrand = false): string[][] {
  const groups = new Map<string, { brand: string; fields: string; source: string; manual: string | null; days: Array<number | null> }>();
  for (const k of campaigns) {
    if (k.fields.length === 0) continue;
    const brand = multiBrand ? k.brand?.trim() || k.name : "";
    const fields = k.fields.join(", ");
    const source = k.data_source?.trim() || "–";
    const manual = k.retention_text?.trim() || null;
    // Rækker slås kun sammen inden for samme brand.
    const key = `${brand}\u0000${fields}\u0000${source}\u0000${manual ?? "\u0001auto"}`;
    const g = groups.get(key) ?? { brand, fields, source, manual, days: [] };
    if (!g.days.includes(k.retention_days)) g.days.push(k.retention_days);
    groups.set(key, g);
  }
  const rows: Array<{ brand: string; cells: string[] }> = [];
  const push = (g: { brand: string; fields: string; source: string }, ret: string) => rows.push({ brand: g.brand, cells: [g.fields, g.source, ret] });
  for (const g of groups.values()) {
    if (g.manual) {
      push(g, g.manual);
      continue;
    }
    const known = g.days.filter((d): d is number => d != null).sort((a, b) => a - b);
    const hasUnknown = g.days.some((d) => d == null);
    if (known.length > 1) push(g, `${known[0]}–${known[known.length - 1]} dage afhængigt af aktivitet`);
    else if (known.length === 1) push(g, `${known[0]} dage`);
    if (hasUnknown) push(g, "Ikke fastsat");
  }
  if (!multiBrand) return rows.map((r) => r.cells);
  return rows
    .map((r, i) => ({ ...r, i }))
    .sort((a, b) => a.brand.localeCompare(b.brand, "da") || a.i - b.i)
    .map((r) => [r.brand, ...r.cells]);
}

/** Dansk opremsning: "A", "A og B", "A, B og C". */
function joinDa(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} og ${items[items.length - 1]}`;
}

/** Afsnit 3 bygges ud fra de underdatabehandlere, der er valgt for kunden. */
export function buildSection3Paragraphs(selectedNames: string[]): string[] {
  const has = (n: string) => selectedNames.some((s) => s.trim().toLowerCase() === n.toLowerCase());
  const ms = has("Microsoft");
  const sb = has("Supabase");
  const lv = has("Lovable");
  const out = [
    "Databehandlerens database hostes hos Supabase i EU-regionen Paris (eu-west-3), og oplysningerne opbevares i EU/EØS.",
  ];
  const us = [ms && "Microsoft", sb && "Supabase"].filter(Boolean) as string[];
  const usAll = [ms && "Microsoft", sb && "Supabase", lv && "Lovable"].filter(Boolean) as string[];
  if (us.length) {
    const intro =
      usAll.length === 1
        ? `${usAll[0]} er et amerikansk selskab.`
        : "Flere af databehandlerens underdatabehandlere er amerikanske selskaber.";
    out.push(`${intro} Hos ${joinDa(us)} kan begrænset supportadgang fra USA ikke udelukkes.`);
  }
  if (lv) {
    out.push(
      "Databehandlerens udviklingsplatform Lovable kan i forbindelse med udvikling, fejlsøgning og drift af afregningssystemet få adgang til oplysninger fra USA.",
    );
  }
  if (usAll.length) {
    const dpf = ms ? ", for Microsofts vedkommende tillige EU-US Data Privacy Framework (art. 45)" : "";
    out.push(
      `Overførslerne sker på grundlag af EU-Kommissionens standardkontraktbestemmelser (art. 46) for ${joinDa(usAll)}${dpf}, jf. de respektive underdatabehandleres databehandleraftaler, som kan rekvireres hos databehandleren.`,
    );
  }
  return out;
}

// Copenhagen Sales' designregler for kontraktdokumenter: Onyx til tekst, Emerald kun som tynd accentlinje.
const INK: [number, number, number] = [46, 49, 54]; // Onyx #2E3136
const ACCENT: [number, number, number] = [59, 224, 134]; // Emerald #3BE086
const MUTED: [number, number, number] = [110, 114, 120];
const ROW_ALT: [number, number, number] = [246, 247, 248];
const LINE: [number, number, number] = [214, 217, 221];
const FONT = "Figtree";

function fmtDate(iso: string): string {
  if (!iso) return "–";
  return new Date(iso).toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" });
}

function registerFonts(doc: jsPDF) {
  doc.addFileToVFS("Figtree-Regular.ttf", FIGTREE_REGULAR);
  doc.addFont("Figtree-Regular.ttf", FONT, "normal");
  doc.addFileToVFS("Figtree-ExtraBold.ttf", FIGTREE_EXTRABOLD);
  doc.addFont("Figtree-ExtraBold.ttf", FONT, "bold");
}

export function generateDpaAddendumPdf(c: DpaAddendumContent): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  registerFonts(doc);
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 22; // sidemargin
  const TOP = 28; // indholdsstart under sidehoved
  const BOTTOM = H - 22; // indholdsgrænse over sidefod
  const TW = W - M * 2;
  const LH = 5.2; // linjehøjde brødtekst
  const PARA_GAP = 2.5;
  const SECTION_GAP = 7;
  let y = TOP;

  const newPage = () => {
    doc.addPage();
    y = TOP;
  };
  const ensure = (h: number) => {
    if (y + h > BOTTOM) newPage();
  };
  const textLines = (t: string, size: number, bold = false) => {
    doc.setFont(FONT, bold ? "bold" : "normal").setFontSize(size);
    return doc.splitTextToSize(t, TW) as string[];
  };
  /** Sektionsoverskrift med tynd accentlinje; holdes sammen med mindst `keep` mm efterfølgende indhold. */
  const heading = (t: string, keep = 3 * LH) => {
    y += SECTION_GAP;
    ensure(10 + keep);
    doc.setFont(FONT, "bold").setFontSize(11.5).setTextColor(...INK);
    doc.text(t, M, y);
    y += 2.2;
    doc.setDrawColor(...ACCENT).setLineWidth(0.4).line(M, y, M + 18, y);
    y += 5.5;
  };
  const para = (t: string, opts: { bold?: boolean } = {}) => {
    const lines = textLines(t, 10, opts.bold);
    doc.setTextColor(...INK);
    // Undgå én forældreløs linje nederst: kræv mindst to linjer (eller hele afsnittet) på siden.
    ensure(Math.min(lines.length, 2) * LH);
    for (const line of lines) {
      ensure(LH);
      doc.text(line, M, y);
      y += LH;
    }
    y += PARA_GAP;
  };
  /**
   * Kolonnebredder: hver kolonne får mindst plads til sit længste ord (så ord ikke brydes midt i),
   * resten fordeles efter vægte.
   */
  const colWidths = (head: string[], body: string[][], weights: number[], size: number, pad: number) => {
    const longest = (t: string, bold: boolean) => {
      doc.setFont(FONT, bold ? "bold" : "normal").setFontSize(size);
      return Math.max(0, ...t.split(/\s+/).map((w) => doc.getTextWidth(w)));
    };
    const mins = head.map((h, i) => Math.max(longest(h, true), ...body.map((r) => longest(r[i] ?? "", false))) + pad * 2 + 0.6);
    const minSum = mins.reduce((a, b) => a + b, 0);
    const wSum = weights.reduce((a, b) => a + b, 0);
    const rest = Math.max(0, TW - minSum);
    const widths = mins.map((m, i) => m + (rest * weights[i]) / wSum);
    const scale = TW / widths.reduce((a, b) => a + b, 0);
    return Object.fromEntries(widths.map((w, i) => [i, { cellWidth: w * scale }])) as Record<number, { cellWidth: number }>;
  };
  const table = (head: string[], body: string[][], weights: number[], size = 8.5) => {
    const pad = 2;
    const rows = body.length ? body : [head.map(() => "–")];
    const columnStyles = colWidths(head, rows, weights, size, pad);
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, top: TOP, bottom: H - BOTTOM },
      head: [head],
      body: rows,
      theme: "grid",
      showHead: "everyPage",
      rowPageBreak: "avoid",
      columnStyles,
      styles: {
        font: FONT,
        fontStyle: "normal",
        fontSize: size,
        textColor: INK,
        cellPadding: { top: 2.2, bottom: 2.2, left: pad, right: pad },
        lineColor: LINE,
        lineWidth: 0.15,
        valign: "top",
        overflow: "linebreak",
      },
      headStyles: { font: FONT, fontStyle: "bold", fillColor: INK, textColor: [255, 255, 255], lineColor: INK },
      bodyStyles: { fillColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: ROW_ALT },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;
  };

  // Titel
  y = 40;
  doc.setFont(FONT, "bold").setFontSize(19).setTextColor(...INK);
  doc.text("Tillæg (allonge) til databehandleraftale", M, y);
  y += 3.5;
  doc.setDrawColor(...ACCENT).setLineWidth(0.6).line(M, y, M + 30, y);
  y += 6;

  heading("Parter");
  para(`${c.client.legal_name}, CVR ${c.client.cvr}, ${c.client.address}`, { bold: true });
  para("(herefter \"den dataansvarlige\")");
  para("og");
  para(`${PROCESSOR.name}, CVR ${PROCESSOR.cvr}, ${PROCESSOR.address}`, { bold: true });
  para("(herefter \"databehandleren\")");

  heading("Henvisning");
  para(
    `Dette tillæg supplerer parternes databehandleraftale "${c.original_agreement.title}" af ${fmtDate(c.original_agreement.date)} (herefter "aftalen"). ` +
      "Begreber anvendt i tillægget har samme betydning som i aftalen.",
  );

  heading("1. Behandling i afregningssystemet Stork");
  para(
    "Stork er Copenhagen Sales' eget interne system, som er udviklet til og alene anvendes af Copenhagen Sales. " +
      "Systemet anvendes til registrering af gennemførte salg og møder, beregning af provision til Copenhagen Sales' medarbejdere " +
      "samt afregning og afstemning af annulleringer med den dataansvarlige. Stork modtager ikke kontaktlister, " +
      "men alene oplysninger om gennemførte salg og møder samt opkaldsstatistik. Systemet er ikke tilgængeligt for tredjeparter, og adgang sker " +
      "udelukkende for Copenhagen Sales' medarbejdere via personligt Microsoft-login og er begrænset efter rolle.",
  );
  para(
    "Behandlingen i Stork omfatter alene den dataansvarliges kunder og medlemmer, som har indgået aftale eller booket møde " +
      "via databehandleren. For øvrige kontakter, der er ringet op, registreres alene et teknisk lead-id sammen med opkaldsstatistik. " +
      "Det fjernes sammen med de øvrige oplysninger efter den angivne periode.",
  );
  para(
    "Databehandleren registrerer oplysninger i afregningssystemet Stork med det formål at foretage afregning, " +
      "provisionsberegning og afstemning af annulleringer og fortrydelser mellem parterne.",
  );
  ensure(LH + 22); // indledning + tabelhoved + første række holdes samlet
  para("Databehandleren registrerer følgende oplysninger:");
  const anyFields = c.campaigns.some((k) => k.fields.length > 0);
  const multi = c.multi_brand === true;
  table(
    multi ? ["Brand", "Oplysninger der registreres", "Datakilde", "Opbevaring"] : ["Oplysninger der registreres", "Datakilde", "Opbevaring"],
    buildSection1Rows(c.campaigns, multi),
    multi ? [1, 5, 3, 3] : [5, 3, 3],
  );
  para("Oplysningerne hentes fra den angivne datakilde.");
  if (anyFields) {
    para(
      "Oplysningerne opbevares i den angivne periode og anonymiseres herefter irreversibelt. " +
        "Ved anonymiseringen fjernes den dataansvarliges kundes persondata, mens salgsregistreringen og oplysninger om sælgeren bevares til afregningsbrug.",
    );
  }
  para(
    "Databehandleren registrerer ikke navn, adresse, e-mail, fritekst, sælgernoter eller berigelsesdata om den dataansvarliges kunder.",
  );
  if (anyFields) {
    para("Anonymiseringen er endelig, når databehandlerens backup-vindue på 14 dage er udløbet.");
  }

  heading("2. Underdatabehandlere", 4 * LH + 22);
  para(
    c.subprocessor_approval.form === "general"
      ? `Den dataansvarlige har givet generel godkendelse af underdatabehandlere med et varsel på ${c.subprocessor_approval.notice_days ?? "–"} dage. Databehandleren benytter følgende underdatabehandlere, som hermed meddeles den dataansvarlige:`
      : "Den dataansvarlige godkender ved underskrift af dette tillæg følgende underdatabehandlere:",
  );
  table(
    ["Navn", "CVR/registrering", "Behandling", "Lokation", "Overførselsgrundlag"],
    c.subprocessors.map((s) => [s.name, s.registration || "–", s.processing || "–", s.location || "–", s.transfer_basis || "–"]),
    [0, 4, 3, 1, 4],
    8,
  );

  heading("3. Lokation og overførsel til tredjelande");
  buildSection3Paragraphs(c.subprocessors.map((s) => s.name)).forEach((p) => para(p));

  let n = 4;
  if (c.other_changes && c.other_changes.trim()) {
    heading(`${n}. Øvrige ændringer`);
    c.other_changes
      .trim()
      .split(/\n\s*\n/)
      .forEach((p) => para(p.replace(/\s*\n\s*/g, " ")));
    n++;
  }

  // Slutbestemmelse og underskrifter holdes samlet på samme side.
  const colW = (TW - 14) / 2;
  const partyLines = (party: string) => {
    doc.setFont(FONT, "normal").setFontSize(9);
    return doc.splitTextToSize(party, colW) as string[];
  };
  const maxParty = Math.max(partyLines(c.client.legal_name).length, partyLines(PROCESSOR.name).length);
  const signH = 6 + maxParty * 4.5 + 3 * 13 + 4;
  const finalText = "Aftalen er i øvrigt uændret. Tillægget træder i kraft ved begge parters underskrift.";
  const finalH = textLines(finalText, 10).length * LH + PARA_GAP;
  heading(`${n}. Slutbestemmelse`, finalH + 12 + signH);
  para(finalText);

  y += 12;
  const top = y;
  const sign = (x: number, title: string, party: string) => {
    let yy = top;
    doc.setFont(FONT, "bold").setFontSize(10).setTextColor(...INK).text(title, x, yy);
    yy += 5;
    doc.setFont(FONT, "normal").setFontSize(9).setTextColor(...INK);
    partyLines(party).forEach((l, i) => doc.text(l, x, yy + i * 4.5));
    yy += maxParty * 4.5;
    for (const label of ["Navn:", "Dato:", "Underskrift:"]) {
      yy += 13;
      doc.setFont(FONT, "normal").setFontSize(9).setTextColor(...INK).text(label, x, yy - 1.2);
      const lx = x + 22;
      doc.setDrawColor(...MUTED).setLineWidth(0.2).line(lx, yy, x + colW, yy);
    }
  };
  sign(M, "For den dataansvarlige", c.client.legal_name);
  sign(M + colW + 14, "For databehandleren", PROCESSOR.name);

  // Sidehoved og -fod (diskret version og dato)
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont(FONT, "normal").setFontSize(7.5).setTextColor(...MUTED);
    doc.text(`${PROCESSOR.name} · Tillæg til databehandleraftale · ${c.client.legal_name}`, M, 13);
    doc.text(`Version v${c.version}`, W - M, 13, { align: "right" });
    doc.setDrawColor(...ACCENT).setLineWidth(0.3).line(M, 16, W - M, 16);
    doc.text(`Genereret ${fmtDate(c.generated_at)}`, M, H - 11);
    doc.text(`Side ${i} af ${pages}`, W - M, H - 11, { align: "right" });
  }

  return doc.output("blob");
}
