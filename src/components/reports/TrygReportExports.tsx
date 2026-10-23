import { useState } from "react";
import { Download, FileSpreadsheet, Loader2, Play } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useIsSuperadmin } from "@/hooks/useIsSuperadmin";
import { useDownloadTrygReportExport, useRunHjerteforeningenExport, useTrygReportExports } from "@/hooks/useTrygReportExports";

/** Udtræk (Excel) – vises kun for superadmin. */
export function TrygReportExports() {
  const { isSuperadmin } = useIsSuperadmin();
  const { data: files = [], isLoading } = useTrygReportExports(isSuperadmin);
  const download = useDownloadTrygReportExport();
  const run = useRunHjerteforeningenExport();
  const [ids, setIds] = useState("");
  const [link, setLink] = useState<{ url: string; name: string; rows: number } | null>(null);
  if (!isSuperadmin) return null;

  return (
    <Card className="rounded-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSpreadsheet className="h-4 w-4" /> Udtræk (kun superadmin)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="space-y-2 rounded-lg border p-3">
          <Input
            value={ids}
            onChange={(e) => setIds(e.target.value)}
            placeholder="Kampagne-id'er, kommasepareret (tom = alle fundne Hjerteforeningen-kampagner)"
          />
          <Button
            size="sm"
            disabled={run.isPending}
            onClick={() => {
              const list = ids.split(/[,\s]+/).map(Number).filter(Boolean);
              run.mutate(list, {
                onSuccess: (d) => {
                  if (d.signedUrl) setLink({ url: d.signedUrl, name: d.fileName, rows: d.rows });
                  toast.success(`Udtræk klar: ${d.rows} rækker`);
                },
                onError: (e) => toast.error(e instanceof Error ? e.message : "Udtræk fejlede"),
              });
            }}
          >
            {run.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Play className="mr-1 h-4 w-4" />}
            Hjerteforeningen – lukkede leads (hele året)
          </Button>
          {link && (
            <a className="block text-sm underline" href={link.url}>
              Hent {link.name} ({link.rows} rækker, link virker i 5 min.)
            </a>
          )}
        </div>
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
