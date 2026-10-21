import { jsPDF } from "jspdf";
import figtreeRegularUrl from "@/assets/fonts/Figtree-Regular.ttf?url";
import figtreeBoldUrl from "@/assets/fonts/Figtree-Bold.ttf?url";

/** Copenhagen Sales' PDF-udseende til compliance-dokumenter. */
const ONYX: [number, number, number] = [0x2e, 0x31, 0x36];
const EMERALD: [number, number, number] = [0x3b, 0xe0, 0x86];
const MUTED: [number, number, number] = [0x6b, 0x70, 0x76];

const MARGIN = 20;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN * 2;

let fontCache: { regular: string; bold: string } | null = null;

async function toBase64(url: string): Promise<string> {
  const buf = await (await fetch(url)).arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function createDoc(): Promise<jsPDF> {
  if (!fontCache) {
    fontCache = {
      regular: await toBase64(figtreeRegularUrl),
      bold: await toBase64(figtreeBoldUrl),
    };
  }
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.addFileToVFS("Figtree-Regular.ttf", fontCache.regular);
  doc.addFont("Figtree-Regular.ttf", "Figtree", "normal");
  doc.addFileToVFS("Figtree-Bold.ttf", fontCache.bold);
  doc.addFont("Figtree-Bold.ttf", "Figtree", "bold");
  doc.setFont("Figtree", "normal");
  doc.setTextColor(...ONYX);
  return doc;
}

export type PdfBlock =
  | { kind: "h1" | "h2" | "h3"; text: string }
  | { kind: "p" | "li" | "meta"; text: string };

class Writer {
  y = MARGIN;
  constructor(private doc: jsPDF, private footer: string) {}

  private ensure(h: number) {
    if (this.y + h > PAGE_H - MARGIN) {
      this.doc.addPage();
      this.y = MARGIN;
    }
  }

  block(b: PdfBlock) {
    const d = this.doc;
    const text = b.text.replace(/\s+/g, " ").trim();
    if (!text) return;
    if (b.kind === "h1" || b.kind === "h2" || b.kind === "h3") {
      const size = b.kind === "h1" ? 18 : b.kind === "h2" ? 13 : 11;
      d.setFont("Figtree", "bold");
      d.setFontSize(size);
      d.setTextColor(...ONYX);
      const lines = d.splitTextToSize(text, CONTENT_W);
      const lh = size * 0.45;
      this.ensure(lines.length * lh + 8);
      this.y += b.kind === "h1" ? 0 : 3;
      d.text(lines, MARGIN, this.y + lh);
      this.y += lines.length * lh + 2;
      if (b.kind !== "h3") {
        d.setDrawColor(...EMERALD);
        d.setLineWidth(b.kind === "h1" ? 0.8 : 0.5);
        d.line(MARGIN, this.y, MARGIN + (b.kind === "h1" ? CONTENT_W : 40), this.y);
        this.y += 4;
      }
      return;
    }
    const size = b.kind === "meta" ? 8.5 : 10;
    d.setFont("Figtree", "normal");
    d.setFontSize(size);
    d.setTextColor(...(b.kind === "meta" ? MUTED : ONYX));
    const indent = b.kind === "li" ? 5 : 0;
    const lines = d.splitTextToSize(text, CONTENT_W - indent);
    const lh = size * 0.45;
    for (let i = 0; i < lines.length; i++) {
      this.ensure(lh);
      if (i === 0 && b.kind === "li") d.text("•", MARGIN + 1, this.y + lh);
      d.text(lines[i], MARGIN + indent, this.y + lh);
      this.y += lh;
    }
    this.y += 2;
  }

  finish() {
    const d = this.doc;
    const n = d.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      d.setPage(i);
      d.setFont("Figtree", "normal");
      d.setFontSize(8);
      d.setTextColor(...MUTED);
      d.text(this.footer, MARGIN, PAGE_H - 10);
      d.text(`Side ${i} af ${n}`, PAGE_W - MARGIN, PAGE_H - 10, { align: "right" });
    }
  }
}

/** Laver PDF ud fra en liste af blokke (overskrifter, afsnit, punkter). */
export async function exportBlocksPdf(blocks: PdfBlock[], fileName: string, footer: string) {
  const doc = await createDoc();
  const w = new Writer(doc, footer);
  blocks.forEach((b) => w.block(b));
  w.finish();
  doc.save(fileName);
}

/** Læser et vist dokument (DOM) og omsætter det til PDF-blokke. */
export function blocksFromElement(root: HTMLElement): PdfBlock[] {
  const out: PdfBlock[] = [];
  const walk = (el: Element) => {
    if ((el as HTMLElement).dataset?.noPrint !== undefined) return;
    const tag = el.tagName.toLowerCase();
    if (tag === "h1" || tag === "h2" || tag === "h3") {
      out.push({ kind: tag, text: el.textContent ?? "" });
      return;
    }
    if (tag === "h4") return void out.push({ kind: "h3", text: el.textContent ?? "" });
    if (tag === "p") return void out.push({ kind: "p", text: el.textContent ?? "" });
    if (tag === "li") return void out.push({ kind: "li", text: el.textContent ?? "" });
    if (tag === "tr") {
      const cells = Array.from(el.children).map((c) => (c.textContent ?? "").trim()).filter(Boolean);
      if (cells.length) out.push({ kind: "li", text: cells.join(" — ") });
      return;
    }
    if (tag === "button" || tag === "input" || tag === "svg") return;
    Array.from(el.children).forEach(walk);
  };
  walk(root);
  return out;
}

export const pdfFooter = (title: string, version: string) =>
  `Copenhagen Sales ApS · ${title} · version ${version}`;

export const pdfFileName = (title: string, version: string) =>
  `${title.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_|_$/g, "")}_v${version}.pdf`;
