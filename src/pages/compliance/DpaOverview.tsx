import { MainLayout } from "@/components/layout/MainLayout";
import {
  ComplianceDocument,
  DocSection,
} from "@/components/compliance/ComplianceDocument";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRef, useState } from "react";
import { FileText, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  useCanManageDpaDocuments,
  useDeleteDpaDocument,
  useDpaDocuments,
  useOpenDpaDocument,
  useUploadDpaDocument,
  type DpaDocument,
} from "@/hooks/useDpaDocuments";

interface DpaRow {
  vendor: string;
  purpose: string;
  link?: { href: string; label: string };
  linkNote?: string;
  archive: string;
  status: string;
}

const rows: DpaRow[] = [
  {
    vendor: "Lovable",
    purpose: "Udviklingsplatform",
    link: {
      href: "https://lovable.dev/data-processing-agreement",
      label: "lovable.dev/data-processing-agreement",
    },
    linkNote:
      "DPA indgår automatisk i Business-planen. Signeret PDF (Lovable_DPA, nov. 2025) kan downloades fra siden.",
    archive: "PDF",
    status: "Aktiveret 9. september 2026",
  },
  {
    vendor: "Supabase",
    purpose:
      "Hosting/database, region eu-west-3 (Paris). Aftalepart: Supabase Pte. Ltd, Singapore — DPA'en indeholder Standard Contractual Clauses som overførselsgrundlag.",
    link: { href: "https://supabase.com/legal/dpa", label: "supabase.com/legal/dpa" },
    linkNote:
      "Binder ved accept af Terms; der findes ingen medunderskrevet version.",
    archive: "Dateret screenshot/PDF af siden med versionsnummer",
    status: "Mangler arkivering",
  },
  {
    vendor: "Microsoft",
    purpose: "M365 / Entra ID-login",
    link: {
      href: "https://www.microsoft.com/licensing/docs/view/Microsoft-Products-and-Services-Data-Protection-Addendum-DPA",
      label: "Microsoft Products and Services DPA",
    },
    linkNote: "Seneste version maj 2026, download som PDF.",
    archive: "PDF",
    status: "Mangler arkivering",
  },
  {
    vendor: "Adversus",
    purpose: "Dialer",
    link: { href: "https://www.adversus.io/privacy", label: "adversus.io/privacy" },
    linkNote:
      "Ingen offentlig DPA-side; DPA underskrives individuelt. Kontakt: legal@adversus.io (CISO Jacob Rasmussen, Adversus A/S, Aarhus). Data hostes i EU jf. deres privacy-side.",
    archive:
      "Den signerede DPA fra onboarding, eller rekvirér via legal@adversus.io",
    status: "Tjek onboarding-dokumenter / rekvirér",
  },
  {
    vendor: "Enreach",
    purpose: "Dialer (Enreach Campaigns)",
    link: {
      href: "https://enreach.com/en/our-labels/enreach-campaigns/legal-documents",
      label: "enreach.com — legal documents",
    },
    linkNote:
      "Generisk DPA-skabelon kan downloades, men siden angiver, at den individuelt underskrevne DPA er den gældende.",
    archive:
      "Den signerede version fra onboarding hvis den findes, ellers skabelonen + afklaring",
    status: "Tjek onboarding-dokumenter",
  },
  {
    vendor: "Twilio",
    purpose: "SMS/telefoni",
    link: {
      href: "https://www.twilio.com/en-us/legal/data-protection-addendum",
      label: "twilio.com — data protection addendum",
    },
    linkNote:
      "Automatisk inkorporeret i Terms of Service, inkl. Standard Contractual Clauses.",
    archive: "Dateret PDF af siden",
    status: "Mangler arkivering",
  },
  {
    vendor: "Visma e-conomic",
    purpose: "Økonomi",
    link: { href: "https://www.e-conomic.dk/sikkerhed/dpa", label: "e-conomic.dk/sikkerhed/dpa" },
    linkNote:
      "Dansk art. 28-aftale. Personaliseret version med egne virksomhedsoplysninger kan downloades i e-conomic: Alle indstillinger → Stamoplysninger → \"Download databehandleraftale\".",
    archive: "Den personaliserede PDF (opgave: Lone)",
    status: "Mangler arkivering",
  },
];

function ArchiveCell({
  vendor,
  documents,
  canManage,
}: {
  vendor: string;
  documents: DpaDocument[];
  canManage: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const uploadMut = useUploadDpaDocument();
  const deleteMut = useDeleteDpaDocument();
  const openMut = useOpenDpaDocument();

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Filen må højst være 25 MB");
      return;
    }
    setBusy(true);
    try {
      await uploadMut.mutateAsync({ vendor, file });
      toast.success(`Aftalen er arkiveret for ${vendor}`);
    } catch {
      toast.error("Kunne ikke arkivere filen");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      {documents.length === 0 && (
        <p className="text-muted-foreground">Ingen fil arkiveret</p>
      )}
      {documents.map((doc) => (
        <div key={doc.id} className="flex items-start gap-1">
          <button
            type="button"
            onClick={() => openMut.mutate(doc.storage_path)}
            className="flex items-start gap-1 text-left text-primary underline break-all"
          >
            <FileText className="h-4 w-4 shrink-0" />
            <span>{doc.file_name}</span>
          </button>
          {canManage && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={async () => {
                if (!window.confirm(`Slet ${doc.file_name} fra arkivet?`)) return;
                try {
                  await deleteMut.mutateAsync(doc);
                  toast.success("Filen er slettet fra arkivet");
                } catch {
                  toast.error("Kunne ikke slette filen");
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          )}
        </div>
      ))}

      {canManage && (
        <div data-no-print>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.docx"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5 mr-2" />
            {busy ? "Uploader..." : "Upload aftale"}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function DpaOverview() {
  const { data: documents } = useDpaDocuments();
  const { data: canManage } = useCanManageDpaDocuments();

  const byVendor = (vendor: string) =>
    (documents || []).filter((doc) => doc.vendor === vendor);

  return (
    <MainLayout>
      <ComplianceDocument
        title="Databehandleraftaler (DPA) — oversigt og status"
        version="0.1"
        documentDate="9. september 2026"
        statusLabel="UDKAST — til godkendelse af Mathias og Lone"
      >
        <DocSection heading="Oversigt over databehandlere">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[130px]">Leverandør</TableHead>
                  <TableHead className="w-[200px]">Rolle/formål</TableHead>
                  <TableHead>DPA-link</TableHead>
                  <TableHead className="w-[220px]">Hvad der skal arkiveres</TableHead>
                  <TableHead className="w-[180px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.vendor} className="align-top">
                    <TableCell className="font-medium">{row.vendor}</TableCell>
                    <TableCell className="text-muted-foreground">{row.purpose}</TableCell>
                    <TableCell className="space-y-1">
                      {row.link && (
                        <a
                          href={row.link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline break-all"
                        >
                          {row.link.label}
                        </a>
                      )}
                      {row.linkNote && (
                        <p className="text-muted-foreground">{row.linkNote}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.archive}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="bg-amber-500/10 text-amber-700 border-amber-500/30 whitespace-normal text-left"
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DocSection>

        <DocSection heading="Arkivering">
          <p className="text-muted-foreground">
            Dokumenterne arkiveres samlet ét sted. Compliance-sektionen understøtter
            i dag ikke filupload, så aftalerne lægges i en fælles mappe:{" "}
            <span className="font-medium text-amber-700">
              Arkiveres i [mappe — udfyldes]
            </span>
            .
          </p>
          <p className="text-muted-foreground">
            Status opdateres pr. leverandør, når aftalen er arkiveret.
          </p>
          <p className="font-medium text-foreground">
            Gennemgås juridisk af Mathias/Lone før markering som komplet.
          </p>
        </DocSection>
      </ComplianceDocument>
    </MainLayout>
  );
}
