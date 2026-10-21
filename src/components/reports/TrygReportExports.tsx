import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useIsSuperadmin } from "@/hooks/useIsSuperadmin";
import { useDownloadTrygReportExport, useTrygReportExports } from "@/hooks/useTrygReportExports";

/** Udtræk (Excel) – vises kun for superadmin. */
export function TrygReportExports() {
  const { isSuperadmin } = useIsSuperadmin();
  const { data: files = [], isLoading } = useTrygReportExports(isSuperadmin);
  const download = useDownloadTrygReportExport();
  if (!isSuperadmin) return null;

  return (
    <Card className="rounded-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSpreadsheet className="h-4 w-4" /> Udtræk (kun superadmin)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {!isLoading && files.length === 0 && <p className="text-sm text-muted-foreground">Ingen udtræk endnu.</p>}
        {files.map((f) => (
          <div key={f.name} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
            <span className="truncate text-sm">{f.name}</span>
            <Button
              size="sm"
              variant="outline"
              disabled={download.isPending}
              onClick={() => download.mutate(f.name, { onError: () => toast.error("Kunne ikke hente filen") })}
            >
              <Download className="mr-1 h-4 w-4" /> Hent
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
