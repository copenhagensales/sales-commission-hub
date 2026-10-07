import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

/** Låst indhold for én version af tillægget. Gemmes 1:1 som JSON i dpa_addenda.content. */
export interface DpaAddendumContent {
  version: number;
  generated_at: string;
  client: { name: string; legal_name: string; cvr: string; address: string };
  original_agreement: { title: string; date: string };
  subprocessor_approval: { form: "general" | "specific"; notice_days: number | null };
  campaigns: Array<{
    name: string;
    fields: string[];
    /** Datakilde (fritekst). Valgfri for bagudkompatibilitet med ældre versioner. */
    data_source?: string | null;
    retention_days: number | null;
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
  if (us.length) {
    out.push(
      `Flere af databehandlerens underdatabehandlere er amerikanske selskaber. Hos ${joinDa(us)} kan begrænset supportadgang fra USA ikke udelukkes.`,
    );
  }
  if (lv) {
    out.push(
      "Databehandlerens udviklingsplatform Lovable kan i forbindelse med udvikling, fejlsøgning og drift af afregningssystemet få adgang til oplysninger fra USA.",
    );
  }
  const scc = [ms && "Microsoft", sb && "Supabase", lv && "Lovable"].filter(Boolean) as string[];
  if (scc.length) {
    const dpf = ms ? "EU-US Data Privacy Framework (art. 45) for Microsoft og " : "";
    out.push(
      `Overførslerne sker på grundlag af ${dpf}EU-Kommissionens standardkontraktbestemmelser (art. 46) for ${joinDa(scc)}, jf. de respektive underdatabehandleres databehandleraftaler, som kan rekvireres hos databehandleren.`,
    );
  }
  return out;
}

// Brandfarver (fra designsystemet: mørk skifer + grøn accent)
const INK: [number, number, number] = [47, 50, 55];
const ACCENT: [number, number, number] = [52, 215, 127];
const MUTED: [number, number, number] = [110, 114, 120];

function fmtDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" });
}

export function generateDpaAddendumPdf(c: DpaAddendumContent): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 22;
  const TW = W - M * 2;
  let y = 30;

  const ensure = (h: number) => {
    if (y + h > H - 22) {
      doc.addPage();
      y = 28;
    }
  };
  const heading = (t: string) => {
    ensure(14);
    y += 4;
    doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...INK);
    doc.text(t, M, y);
    y += 6;
  };
  const para = (t: string, opts: { bold?: boolean; size?: number } = {}) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal").setFontSize(opts.size ?? 10).setTextColor(...INK);
    const lines = doc.splitTextToSize(t, TW) as string[];
    for (const line of lines) {
      ensure(5.2);
      doc.text(line, M, y);
      y += 5.2;
    }
    y += 1.5;
  };

  // Titel
  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(...INK);
  doc.text("Tillæg (allonge) til databehandleraftale", M, y);
  y += 4;
  doc.setDrawColor(...ACCENT).setLineWidth(0.8).line(M, y, M + 40, y);
  y += 10;

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
    "Databehandleren registrerer oplysninger i afregningssystemet Stork med det formål at foretage afregning, " +
      "provisionsberegning og afstemning af annulleringer og fortrydelser mellem parterne.",
  );
  para("Databehandleren registrerer følgende oplysninger pr. kampagne:");
  const anyFields = c.campaigns.some((k) => k.fields.length > 0);
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [["Kampagne", "Oplysninger der registreres", "Datakilde", "Opbevaring"]],
    body: c.campaigns
      .filter((k) => k.fields.length > 0)
      .map((k) => [k.name, k.fields.join(", "), k.data_source?.trim() || "—", k.retention_days != null ? `${k.retention_days} dage` : "Ikke fastsat"]),
    styles: { font: "helvetica", fontSize: 9, textColor: INK, cellPadding: 2 },
    headStyles: { fillColor: INK, textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [245, 246, 247] },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
  para("Oplysningerne hentes fra den kilde, der er angivet for kampagnen.");
  if (anyFields) {
    para(
      "Oplysningerne opbevares i det antal dage, der er angivet for kampagnen, og anonymiseres herefter irreversibelt. " +
        "Ved anonymiseringen fjernes den dataansvarliges kundes persondata, mens salgsregistreringen og oplysninger om sælgeren bevares til afregningsbrug.",
    );
  }
  para(
    "Databehandleren registrerer ikke navn, adresse, e-mail, fritekst, sælgernoter eller berigelsesdata om den dataansvarliges kunder.",
  );
  if (anyFields) {
    para("Anonymiseringen er endelig, når databehandlerens backup-vindue på 14 dage er udløbet.");
  }

  heading("2. Underdatabehandlere");
  para(
    c.subprocessor_approval.form === "general"
      ? `Den dataansvarlige har givet generel godkendelse af underdatabehandlere med et varsel på ${c.subprocessor_approval.notice_days ?? "—"} dage. Databehandleren benytter følgende underdatabehandlere, som hermed meddeles den dataansvarlige:`
      : "Den dataansvarlige godkender ved underskrift af dette tillæg følgende underdatabehandlere:",
  );
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [["Navn", "CVR/registrering", "Behandling", "Lokation", "Overførselsgrundlag"]],
    body: c.subprocessors.map((s) => [s.name, s.registration || "—", s.processing || "—", s.location || "—", s.transfer_basis || "—"]),
    styles: { font: "helvetica", fontSize: 8.5, textColor: INK, cellPadding: 2 },
    headStyles: { fillColor: INK, textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [245, 246, 247] },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;

  heading("3. Lokation og overførsel til tredjelande");
  buildSection3Paragraphs(c.subprocessors.map((s) => s.name)).forEach((p) => para(p));

  let n = 4;
  if (c.other_changes && c.other_changes.trim()) {
    heading(`${n}. Øvrige ændringer`);
    para(c.other_changes.trim());
    n++;
  }

  heading(`${n}. Slutbestemmelse`);
  para("Aftalen er i øvrigt uændret. Tillægget træder i kraft ved begge parters underskrift.");

  // Underskrifter
  ensure(58);
  y += 8;
  const colW = (TW - 12) / 2;
  const sign = (x: number, title: string, party: string) => {
    let yy = y;
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...INK).text(title, x, yy);
    yy += 5;
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
    (doc.splitTextToSize(party, colW) as string[]).forEach((l) => {
      doc.text(l, x, yy);
      yy += 4.5;
    });
    yy += 6;
    for (const label of ["Navn", "Dato", "Underskrift"]) {
      yy += 9;
      doc.setDrawColor(...MUTED).setLineWidth(0.2).line(x, yy, x + colW, yy);
      doc.setFontSize(8).text(label, x, yy + 4);
    }
  };
  sign(M, "For den dataansvarlige", c.client.legal_name);
  sign(M + colW + 12, "For databehandleren", PROCESSOR.name);

  // Sidehoved og -fod
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED);
    doc.text(`${PROCESSOR.name} · Tillæg til databehandleraftale · ${c.client.legal_name}`, M, 14);
    doc.text(`Version v${c.version}`, W - M, 14, { align: "right" });
    doc.setDrawColor(...ACCENT).setLineWidth(0.3).line(M, 16, W - M, 16);
    doc.text(`Genereret ${fmtDate(c.generated_at)}`, M, H - 10);
    doc.text(`Side ${i} af ${pages}`, W - M, H - 10, { align: "right" });
  }

  return doc.output("blob");
}
