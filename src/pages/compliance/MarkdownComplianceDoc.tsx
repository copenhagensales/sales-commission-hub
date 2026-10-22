import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { SuperadminGate } from "@/components/auth/SuperadminGate";
import { ComplianceDocument } from "@/components/compliance/ComplianceDocument";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useIsSuperadmin } from "@/hooks/useIsSuperadmin";
import {
  useComplianceDocument,
  useSaveComplianceDraft,
  versionLabel,
  type ComplianceVersionRow,
} from "@/hooks/useComplianceDocuments";

function Body({ docKey }: { docKey: string }) {
  const { doc, isLoading } = useComplianceDocument(docKey);
  const { isSuperadmin } = useIsSuperadmin();
  const save = useSaveComplianceDraft();
  const [shown, setShown] = useState<ComplianceVersionRow | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => setShown(null), [docKey]);
  const version = shown ?? doc?.current ?? doc?.pending ?? null;

  const openEdit = () => {
    const base = doc?.pending ?? doc?.current;
    setText(base?.content_md ?? "");
    setNote(doc?.pending?.change_note ?? "");
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!doc || !note.trim()) return toast.error("Skriv en ændringsnote");
    try {
      await save.mutateAsync({ doc, contentMd: text, changeNote: note.trim() });
      toast.success("Udkastet er gemt og afventer Kaspers godkendelse");
      setShown(null);
      setEditOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke gemme");
    }
  };

  if (isLoading) return null;
  if (!doc) return <p className="p-6 text-muted-foreground">Dokumentet findes ikke.</p>;

  return (
    <ComplianceDocument
      docKey={docKey}
      title={doc.title}
      shownVersion={version}
      onShowVersion={setShown}
      actions={
        isSuperadmin && (
          <Button variant="outline" size="sm" onClick={openEdit}>
            <Pencil className="h-4 w-4 mr-2" />
            {doc.pending ? `Redigér udkast ${versionLabel(doc.pending)}` : "Redigér (ny version)"}
          </Button>
        )
      }
    >
      <div className="space-y-3">
        <ReactMarkdown
          components={{
            h1: () => null,
            h2: ({ children }) => <h2 className="text-lg font-semibold text-foreground pt-4">{children}</h2>,
            h3: ({ children }) => <h3 className="font-medium text-foreground pt-2">{children}</h3>,
            p: ({ children }) => <p className="text-foreground">{children}</p>,
            ul: ({ children }) => <ul className="list-disc pl-6 space-y-1">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal pl-6 space-y-1">{children}</ol>,
            em: ({ children }) => <em className="text-muted-foreground">{children}</em>,
          }}
        >
          {version?.content_md ?? ""}
        </ReactMarkdown>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {doc.pending ? `Redigér udkast ${versionLabel(doc.pending)}` : "Ny version"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Ændringsnote (ændringslog)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Hvad er ændret og hvorfor" />
            </div>
            <div className="space-y-1">
              <Label>Tekst (markdown)</Label>
              <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[50vh] font-mono text-xs" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Annullér</Button>
            <Button onClick={handleSave} disabled={save.isPending}>Gem udkast</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ComplianceDocument>
  );
}

export function makeMarkdownDocPage(docKey: string) {
  return function MarkdownComplianceDocPage() {
    return (
      <MainLayout>
        <SuperadminGate message="Compliance-dokumenterne kan kun ses af superadmins.">
          <Body docKey={docKey} />
        </SuperadminGate>
      </MainLayout>
    );
  };
}

export const PersondatapolitikPage = makeMarkdownDocPage("persondatapolitik");
export const DatabrudsprocedurePage = makeMarkdownDocPage("databrudsprocedure");
export const KonsekvensvurderingProcedurePage = makeMarkdownDocPage("konsekvensvurdering-procedure");
export const Art30PulsenPage = makeMarkdownDocPage("art30-pulsen");
export const Art30PushPage = makeMarkdownDocPage("art30-push");
