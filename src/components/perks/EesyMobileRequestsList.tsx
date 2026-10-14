import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { downloadExcel } from "@/utils/excel";
import {
  logEesyCprAccess, useEesyMobileRequests, useSetEesyMobileStatus, type EesyMobileRequest,
} from "@/hooks/useEesyMobileRequests";

const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("da-DK") : "");
const maskCpr = (c: string | null) => (c ? `${c.slice(0, 6)}-****` : "Slettet");

/** Kun ejere. Visning og eksport af CPR logges. */
export function EesyMobileRequestsList() {
  const { toast } = useToast();
  const { data: rows = [], isLoading } = useEesyMobileRequests(true);
  const setStatus = useSetEesyMobileStatus();
  const [showCpr, setShowCpr] = useState(false);

  const toggleCpr = async () => {
    if (!showCpr) await logEesyCprAccess(rows, "view");
    setShowCpr((v) => !v);
  };

  const exportRows = async (list: EesyMobileRequest[]) => {
    await logEesyCprAccess(list, "export");
    await downloadExcel(`eesy-mobil-anmodninger-${new Date().toISOString().slice(0, 10)}.xlsx`, [{
      name: "Eesy",
      rows: list.map((r) => ({
        Navn: r.full_name,
        Adresse: r.address ?? "",
        "CPR-nr.": r.cpr_number ? `${r.cpr_number.slice(0, 6)}-${r.cpr_number.slice(6)}` : "",
        Telefonnummer: r.phone_number ?? "",
        "ICC-nummer": r.icc_number ?? "",
        Abonnement: r.subscription,
        Indsendt: fmtDate(r.created_at),
        Status: r.status === "sendt" ? "Sendt" : "Ny",
      })),
      columnWidths: [24, 34, 14, 14, 24, 56, 12, 10],
    }]);
  };

  const onToggleSent = async (r: EesyMobileRequest) => {
    try {
      await setStatus.mutateAsync({ id: r.id, sent: r.status !== "sendt" });
    } catch (e) {
      toast({ title: "Kunne ikke opdatere", description: (e as Error).message, variant: "destructive" });
    }
  };

  const newRows = rows.filter((r) => r.status === "ny");

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <CardTitle className="text-lg">Eesy-anmodninger · {rows.length}</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" className="gap-1" onClick={toggleCpr}>
            {showCpr ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} {showCpr ? "Skjul CPR" : "Vis CPR"}
          </Button>
          <Button size="sm" variant="outline" className="gap-1" disabled={newRows.length === 0} onClick={() => exportRows(newRows)}>
            <Download className="h-4 w-4" /> Eksportér nye ({newRows.length})
          </Button>
          <Button size="sm" variant="outline" className="gap-1" disabled={rows.length === 0} onClick={() => exportRows(rows)}>
            <Download className="h-4 w-4" /> Eksportér alle
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">
          Kun ejere kan se listen. CPR, ICC, adresse og telefon slettes automatisk 30 dage efter markering som sendt.
        </p>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Indlæser...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ingen anmodninger endnu.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-1 pr-3">Navn</th><th className="pr-3">Adresse</th><th className="pr-3">CPR</th>
                  <th className="pr-3">Telefon</th><th className="pr-3">ICC</th><th className="pr-3">Abonnement</th>
                  <th className="pr-3">Indsendt</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t align-top">
                    <td className="py-2 pr-3 font-medium">{r.full_name}</td>
                    <td className="pr-3">{r.address ?? "Slettet"}</td>
                    <td className="pr-3 font-mono">{showCpr && r.cpr_number ? `${r.cpr_number.slice(0, 6)}-${r.cpr_number.slice(6)}` : maskCpr(r.cpr_number)}</td>
                    <td className="pr-3">{r.phone_number ?? "Slettet"}</td>
                    <td className="pr-3 font-mono">{r.icc_number ?? "Slettet"}</td>
                    <td className="pr-3">{r.subscription}</td>
                    <td className="pr-3">{fmtDate(r.created_at)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Badge variant={r.status === "sendt" ? "secondary" : "default"}>
                          {r.status === "sendt" ? `Sendt ${fmtDate(r.sent_at)}` : "Ny"}
                        </Badge>
                        <Button size="sm" variant="ghost" onClick={() => onToggleSent(r)} disabled={setStatus.isPending}>
                          {r.status === "sendt" ? "Fortryd" : "Markér sendt"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
