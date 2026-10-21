import { ReactNode, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, FileDown, History, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useApproveComplianceVersion,
  useComplianceDocument,
  useIsComplianceApprover,
  versionLabel,
  type ComplianceVersionRow,
} from "@/hooks/useComplianceDocuments";
import { blocksFromElement, exportBlocksPdf, pdfFileName, pdfFooter } from "@/utils/compliancePdf";

interface ComplianceDocumentProps {
  /** Nøgle i compliance_documents – status, version og godkendelse hentes derfra. */
  docKey: string;
  title: string;
  children: ReactNode;
  /** Vist version (markdown-dokumenter kan vise ældre versioner). */
  shownVersion?: ComplianceVersionRow | null;
  onShowVersion?: (v: ComplianceVersionRow) => void;
  /** Ekstra knapper (fx Redigér) i topbjælken. */
  actions?: ReactNode;
}

export const formatDaDate = (iso: string) =>
  new Date(iso).toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" });

const STATUS_TEXT: Record<string, string> = {
  pending: "Afventer Kaspers godkendelse",
  approved: "Gældende",
  superseded: "Tidligere version",
};

/**
 * Fælles ramme for compliance-dokumenter i Stork.
 * Status/version/godkendelse kommer fra databasen; kun den udpegede godkender kan godkende.
 */
export function ComplianceDocument({
  docKey,
  title,
  children,
  shownVersion,
  onShowVersion,
  actions,
}: ComplianceDocumentProps) {
  const navigate = useNavigate();
  const articleRef = useRef<HTMLElement>(null);
  const { doc, isLoading } = useComplianceDocument(docKey);
  const { data: isApprover } = useIsComplianceApprover();
  const approve = useApproveComplianceVersion();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const shown = shownVersion ?? doc?.current ?? doc?.pending ?? null;
  const status = shown?.status ?? "pending";

  const handleApprove = async () => {
    if (!doc?.pending) return;
    try {
      await approve.mutateAsync(doc.pending.id);
      toast.success(`Version ${versionLabel(doc.pending)} er godkendt og gældende`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Godkendelse fejlede");
    }
  };

  const handlePdf = async () => {
    if (!articleRef.current) return;
    setExporting(true);
    try {
      const v = shown ? versionLabel(shown) : "1.0";
      const meta = [
        `Version ${v} · Status: ${STATUS_TEXT[status]}`,
        shown?.approved_at
          ? `Godkendt af ${shown.approved_by_email ?? ""} den ${formatDaDate(shown.approved_at)}`
          : "Ikke godkendt endnu",
        "Copenhagen Sales ApS",
      ];
      const body = blocksFromElement(articleRef.current);
      const hasH1 = body[0]?.kind === "h1";
      await exportBlocksPdf(
        [
          ...(hasH1 ? [] : [{ kind: "h1" as const, text: title }]),
          ...(hasH1 ? [body[0]] : []),
          ...meta.map((text) => ({ kind: "meta" as const, text })),
          ...(hasH1 ? body.slice(1) : body),
        ],
        pdfFileName(title, v),
        pdfFooter(title, v),
      );
    } catch (e) {
      toast.error("PDF kunne ikke laves");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 doc-print-root">
      <div className="flex flex-wrap items-center justify-between gap-2" data-no-print>
        <Button variant="ghost" size="sm" onClick={() => navigate("/compliance")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Tilbage til Compliance
        </Button>
        <div className="flex flex-wrap gap-2">
          {actions}
          <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)} disabled={!doc}>
            <History className="h-4 w-4 mr-2" />
            Versioner
          </Button>
          <Button variant="outline" size="sm" onClick={handlePdf} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
            Eksportér PDF
          </Button>
        </div>
      </div>

      <header className="space-y-3 border-b pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={
              status === "approved"
                ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                : status === "superseded"
                  ? "bg-muted text-muted-foreground"
                  : "bg-amber-500/10 text-amber-700 border-amber-500/30"
            }
          >
            {isLoading ? "Henter status…" : STATUS_TEXT[status]}
          </Badge>
          {doc?.pending && doc.current && shown?.id === doc.current.id && (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30">
              Udkast {versionLabel(doc.pending)} afventer godkendelse
            </Badge>
          )}
        </div>
        <h1 className="text-3xl font-bold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">
          Version {shown ? versionLabel(shown) : "1.0"}
          {shown?.approved_at
            ? ` · Godkendt af ${shown.approved_by_email} den ${formatDaDate(shown.approved_at)}`
            : " · Ikke godkendt endnu"}
          {" · Copenhagen Sales ApS · Stork"}
        </p>
        {isApprover && doc?.pending && (
          <div className="flex items-center gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3" data-no-print>
            <p className="text-sm flex-1">
              Version {versionLabel(doc.pending)} afventer din godkendelse
              {doc.pending.change_note ? ` – ${doc.pending.change_note}` : ""}.
            </p>
            <Button size="sm" onClick={handleApprove} disabled={approve.isPending}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Godkend version {versionLabel(doc.pending)}
            </Button>
          </div>
        )}
      </header>

      <article ref={articleRef} className="space-y-8 text-sm leading-relaxed text-foreground">
        {children}
      </article>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Versioner og ændringslog</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {doc?.versions.map((v) => (
              <div key={v.id} className="rounded-md border p-3 text-sm space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    Version {versionLabel(v)} · {STATUS_TEXT[v.status]}
                  </span>
                  {onShowVersion && v.content_md && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        onShowVersion(v);
                        setHistoryOpen(false);
                      }}
                    >
                      Vis
                    </Button>
                  )}
                </div>
                <p className="text-muted-foreground">{v.change_note || "Ingen ændringsnote"}</p>
                <p className="text-xs text-muted-foreground">
                  Oprettet {formatDaDate(v.created_at)}
                  {v.approved_at ? ` · Godkendt af ${v.approved_by_email} den ${formatDaDate(v.approved_at)}` : ""}
                </p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function DocSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">{heading}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function DocSubSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-md border bg-card p-4">
      <h3 className="font-medium text-foreground">{heading}</h3>
      <div className="space-y-2 text-muted-foreground">{children}</div>
    </div>
  );
}

export function Confirm({ children }: { children: ReactNode }) {
  return (
    <span className="font-medium text-amber-700">[BEKRÆFTES: {children}]</span>
  );
}
