import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRef, useState } from "react";
import { Building2, FileSignature, FileText, RotateCcw, ShieldCheck, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useCanManageDpaDocuments } from "@/hooks/useDpaDocuments";
import {
  useClientAgreementDocuments,
  useComplianceClients,
  useDeleteClientAgreement,
  useHiddenAgreementClients,
  useHideAgreementClient,
  useOpenClientAgreement,
  useRestoreAgreementClient,
  useUploadClientAgreement,
  type ClientAgreementDocument,
  type ClientAgreementType,
} from "@/hooks/useClientAgreementDocuments";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const TYPE_LABEL: Record<ClientAgreementType, string> = {
  dpa: "Databehandleraftale",
  contract: "Kontrakt",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("da-DK", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function ClientAgreements() {
  const { data: clients = [], isLoading: clientsLoading } = useComplianceClients();
  const { data: documents = [] } = useClientAgreementDocuments();
  const { data: canManage = false } = useCanManageDpaDocuments();

  const { data: hiddenIds = [] } = useHiddenAgreementClients();

  const upload = useUploadClientAgreement();
  const remove = useDeleteClientAgreement();
  const open = useOpenClientAgreement();
  const hideClient = useHideAgreementClient();
  const restoreClient = useRestoreAgreementClient();

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [pendingHide, setPendingHide] = useState<{ id: string; name: string } | null>(null);

  const hiddenSet = new Set(hiddenIds);
  const visibleClients = clients.filter((c) => !hiddenSet.has(c.id));
  const hiddenClients = clients.filter((c) => hiddenSet.has(c.id));

  const confirmHide = async () => {
    if (!pendingHide) return;
    try {
      await hideClient.mutateAsync(pendingHide.id);
      toast.success(`${pendingHide.name} er fjernet fra oversigten`);
    } catch {
      toast.error("Kunden kunne ikke fjernes");
    } finally {
      setPendingHide(null);
    }
  };

  const handleRestore = async (client: { id: string; name: string }) => {
    try {
      await restoreClient.mutateAsync(client.id);
      toast.success(`${client.name} er tilbage i oversigten`);
    } catch {
      toast.error("Kunden kunne ikke gendannes");
    }
  };

  const docsFor = (clientId: string, docType: ClientAgreementType) =>
    documents.filter((d) => d.client_id === clientId && d.doc_type === docType);

  const handleFile = async (
    clientId: string,
    docType: ClientAgreementType,
    file: File | undefined
  ) => {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Filen er for stor. Maks. 25 MB.");
      return;
    }
    const key = `${clientId}-${docType}`;
    setBusyKey(key);
    try {
      await upload.mutateAsync({ clientId, docType, file });
      toast.success(`${TYPE_LABEL[docType]} arkiveret`);
    } catch {
      toast.error("Filen kunne ikke uploades");
    } finally {
      setBusyKey(null);
      const input = inputRefs.current[key];
      if (input) input.value = "";
    }
  };

  const handleDelete = async (doc: ClientAgreementDocument) => {
    try {
      await remove.mutateAsync({ id: doc.id, storage_path: doc.storage_path });
      toast.success("Filen er fjernet");
    } catch {
      toast.error("Filen kunne ikke fjernes");
    }
  };

  const renderSlot = (clientId: string, docType: ClientAgreementType) => {
    const key = `${clientId}-${docType}`;
    const docs = docsFor(clientId, docType);
    const Icon = docType === "dpa" ? ShieldCheck : FileSignature;

    return (
      <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Icon className="h-4 w-4 text-primary" />
            {TYPE_LABEL[docType]}
          </div>
          {docs.length > 0 ? (
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
              Arkiveret
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30">
              Mangler
            </Badge>
          )}
        </div>

        {docs.length > 0 && (
          <ul className="space-y-1">
            {docs.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => open.mutate(doc.storage_path)}
                  className="flex items-center gap-1.5 text-left text-primary hover:underline min-w-0"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{doc.file_name}</span>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-muted-foreground">{formatDate(doc.created_at)}</span>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(doc)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {canManage && (
          <>
            <input
              ref={(el) => {
                inputRefs.current[key] = el;
              }}
              type="file"
              className="hidden"
              onChange={(e) => handleFile(clientId, docType, e.target.files?.[0])}
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              disabled={busyKey === key}
              onClick={() => inputRefs.current[key]?.click()}
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              {busyKey === key ? "Uploader..." : "Upload fil"}
            </Button>
          </>
        )}
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto space-y-6 p-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Building2 className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Kundeaftaler: DPA og kontrakt</h1>
          </div>
          <p className="text-muted-foreground">
            Hver kunde har sin egen boks med databehandleraftale og kontrakt. Filerne gemmes i et lukket
            arkiv, som kun ejere og superadmins kan åbne. Maks. 25 MB pr. fil.
          </p>
        </div>

        {clientsLoading ? (
          <p className="text-sm text-muted-foreground">Henter kunder...</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {visibleClients.map((client) => (
              <Card key={client.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg">{client.name}</CardTitle>
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        title="Fjern kunden fra denne oversigt"
                        onClick={() => setPendingHide({ id: client.id, name: client.name })}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {renderSlot(client.id, "dpa")}
                  {renderSlot(client.id, "contract")}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {canManage && hiddenClients.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Fjernet fra oversigten</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {hiddenClients.map((client) => (
                <Button
                  key={client.id}
                  variant="outline"
                  size="sm"
                  onClick={() => handleRestore(client)}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  {client.name}
                </Button>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={!!pendingHide} onOpenChange={(o) => !o && setPendingHide(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fjern {pendingHide?.name} fra oversigten?</AlertDialogTitle>
            <AlertDialogDescription>
              Kunden vises ikke længere her, men bliver ikke slettet i systemet. Salg, provision og
              rapporter er uændrede, og uploadede filer bevares. Du kan sætte kunden tilbage nederst
              på siden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annullér</AlertDialogCancel>
            <AlertDialogAction onClick={confirmHide}>Fjern</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
