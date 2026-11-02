import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IKKE_VORES, useAgentAlias, useAgentValg, useKoblAlias } from "@/hooks/useAgentAlias";

const OPRINDELSE_LABEL: Record<string, string> = { salg: "fra salg", kald_historik: "fra kaldshistorik", kald: "set i kald", brugere: "fra dialerens brugere", manuel: "valgt manuelt" };

/** Sælger-koblinger for en API-konto: id'er uden kobling vælges her (medarbejder eller »ikke vores«); kendte koblinger vises nedenfor. */
export function SaelgereUdenKobling({ kilde, kontoId, kunEgne }: { kilde: string; kontoId: string; kunEgne: boolean }) {
  const { data: alias = [], isLoading } = useAgentAlias(kilde, kontoId);
  const { data: agents = [] } = useAgentValg();
  const kobl = useKoblAlias();
  const uden = alias.filter((a) => !a.agent_id && !a.ikke_vores);
  const med = alias.filter((a) => a.agent_id);
  const ikkeVores = alias.filter((a) => a.ikke_vores);
  const agentNavn = (id: string | null) => agents.find((a) => a.id === id)?.name ?? (id ? id.slice(0, 8) : "–");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">Sælgere {uden.length > 0 && <Badge variant="destructive">{uden.length} uden kobling</Badge>}</CardTitle>
        <CardDescription>
          Samme medarbejder kan have flere bruger-id'er i dialeren. Koblingen bruger-id → medarbejder er data: den fyldes automatisk fra salg og dialerens
          brugerliste, og id'er uden kobling lander her. Vælg medarbejderen, så sættes sælgeren også på de kald, der mangler den.
          {kunEgne
            ? " Denne konto henter kun egne medarbejderes kald: brugere uden kobling hentes ikke, før du vælger medarbejder – eller markerer dem som »ikke vores medarbejder«."
            : " Brugere, der ikke er Copenhagen Sales' medarbejdere, kan markeres som »ikke vores medarbejder«."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && <div className="py-4 text-sm text-muted-foreground">Henter…</div>}
        {!isLoading && alias.length === 0 && <div className="py-4 text-sm text-muted-foreground">Ingen koblinger registreret for denne kilde.</div>}
        {alias.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Bruger-id</TableHead><TableHead>Navn i dialeren</TableHead><TableHead>E-mail</TableHead><TableHead>Medarbejder</TableHead><TableHead>Oprindelse</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {[...uden, ...med, ...ikkeVores].map((a) => (
                <TableRow key={a.ekstern_id} className={a.ikke_vores ? "opacity-60" : a.agent_id ? undefined : "bg-destructive/5"}>
                  <TableCell className="font-mono text-xs">{a.ekstern_id}</TableCell>
                  <TableCell className="text-xs">{a.navn ?? <span className="text-muted-foreground">–</span>}{a.aktiv === false && <span className="ml-1 text-muted-foreground">(inaktiv)</span>}</TableCell>
                  <TableCell className="text-xs">{a.email ?? <span className="text-muted-foreground">–</span>}</TableCell>
                  <TableCell>
                    <Select value={a.ikke_vores ? IKKE_VORES : a.agent_id ?? ""} disabled={kobl.isPending} onValueChange={(v) => kobl.mutate({ kilde, eksternId: a.ekstern_id, agentId: v, kontoId })}>
                      <SelectTrigger className="h-8 w-[260px] text-xs"><SelectValue placeholder="Vælg medarbejder…">{a.ikke_vores ? "Ikke vores medarbejder" : a.agent_id ? agentNavn(a.agent_id) : "Vælg medarbejder…"}</SelectValue></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={IKKE_VORES}>Ikke vores medarbejder</SelectItem>
                        {agents.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}{g.email ? ` · ${g.email}` : ""}{g.is_active === false ? " (inaktiv)" : ""}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{OPRINDELSE_LABEL[a.oprindelse] ?? a.oprindelse}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
