import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { CalendarClock, LifeBuoy, Users } from "lucide-react";
import {
  RAMP_ACTION_TYPES,
  formatRiskStatSentence,
  useCanViewRampTeam,
  useCloseRampFlag,
  useLogRampAction,
  useRampRiskStats,
  useRampTeamOverview,
  type RampActionType,
  type RampStatus,
  type RampTeamMember,
} from "@/hooks/useRampTeam";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("da-DK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const STATUS_LABEL: Record<RampStatus, string> = {
  over: "Over det typiske",
  midt: "Midt i feltet",
  under: "Under det typiske",
  ukendt: "Intet sammenligningsgrundlag",
};

function statusVariant(status: RampStatus): "default" | "secondary" | "outline" {
  if (status === "under") return "default";
  if (status === "over") return "secondary";
  return "outline";
}

const STATUS_RANK: Record<RampStatus, number> = { under: 0, midt: 1, over: 2, ukendt: 3 };

function sortMembers(members: RampTeamMember[]): RampTeamMember[] {
  return [...members].sort((a, b) => {
    if (STATUS_RANK[a.status] !== STATUS_RANK[b.status]) {
      return STATUS_RANK[a.status] - STATUS_RANK[b.status];
    }
    const aOpen = a.flag_days_open ?? -1;
    const bOpen = b.flag_days_open ?? -1;
    if (aOpen !== bOpen) return bOpen - aOpen;
    return a.employee_name.localeCompare(b.employee_name, "da-DK");
  });
}

export default function RampTeam() {
  const { data: canView, isLoading: accessLoading } = useCanViewRampTeam();
  const { data: members = [], isLoading } = useRampTeamOverview();
  const { data: stats = [] } = useRampRiskStats();
  const logAction = useLogRampAction();
  const closeFlag = useCloseRampFlag();
  const [selected, setSelected] = useState<Record<string, RampActionType | undefined>>({});

  const sorted = useMemo(() => sortMembers(members), [members]);

  if (accessLoading) {
    return (
      <MainLayout>
        <div className="text-muted-foreground py-12 text-center">Indlæser…</div>
      </MainLayout>
    );
  }

  if (!canView) {
    return (
      <MainLayout>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Denne side er kun for teamledere og assisterende teamledere på et hold med
              opstartskurve, samt ejere, admins og superadmins.
            </p>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Opstartshold</h1>
          <p className="text-muted-foreground text-sm">
            Alle sælgere i deres første 40 arbejdsdage — både dem i farezonen og dem der ser godt
            ud.
          </p>
        </div>

        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LifeBuoy className="h-5 w-5" />
              Det vi faktisk har observeret
            </CardTitle>
            <CardDescription className="text-foreground">
              {stats.length === 0 ? (
                "Der er endnu ikke beregnet observerede tal."
              ) : (
                <span className="space-y-1 block">
                  {stats.map((stat) => (
                    <span key={stat.day_no} className="block">
                      {formatRiskStatSentence(stat)}
                    </span>
                  ))}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Grundlaget er lille, så tallene kan flytte sig.
            </p>
            <p className="text-sm text-muted-foreground">
              Tallene gælder grupper, ikke enkeltpersoner. Det er en samtale der mangler — ikke en
              vurdering af sælgeren.
            </p>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="text-muted-foreground py-8 text-center">Indlæser holdet…</div>
        ) : sorted.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                Ingen sælgere er i deres første 40 arbejdsdage lige nu.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {sorted.map((member) => {
              const chosen = selected[member.employee_id];
              return (
                <Card key={member.employee_id}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-lg">{member.employee_name}</CardTitle>
                        <CardDescription>
                          {member.campaign_name ?? "Ukendt kampagne"} · arbejdsdag {member.day_no}
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={statusVariant(member.status)}>
                          {STATUS_LABEL[member.status]}
                        </Badge>
                        {member.flag_days_open != null && (
                          <Badge variant="outline" className="flex items-center gap-1">
                            <CalendarClock className="h-3.5 w-3.5" />
                            Åbent i {member.flag_days_open}{" "}
                            {member.flag_days_open === 1 ? "dag" : "dage"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Egne salg</p>
                        <p className="text-2xl font-semibold">{member.cum_sales}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Typisk spænd på dag {member.day_no}
                        </p>
                        <p className="text-2xl font-semibold">
                          {member.p25 != null && member.p75 != null
                            ? `${Math.round(Number(member.p25))}–${Math.round(Number(member.p75))}`
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Median på dagen</p>
                        <p className="text-2xl font-semibold">
                          {member.p50 != null ? Math.round(Number(member.p50)) : "—"}
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        Registrerede handlinger
                      </p>
                      {member.actions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Ingen handlinger registreret endnu.
                        </p>
                      ) : (
                        <ul className="space-y-1 text-sm">
                          {member.actions.map((action, index) => (
                            <li
                              key={`${member.employee_id}-${index}`}
                              className="flex flex-wrap gap-x-2"
                            >
                              <span className="font-medium">{action.action_type}</span>
                              <span className="text-muted-foreground">
                                · {action.performed_by_name ?? "Ukendt"} ·{" "}
                                {formatDate(action.performed_at)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        value={chosen}
                        onValueChange={(value) =>
                          setSelected((prev) => ({
                            ...prev,
                            [member.employee_id]: value as RampActionType,
                          }))
                        }
                      >
                        <SelectTrigger className="w-full sm:w-64">
                          <SelectValue placeholder="Vælg handling" />
                        </SelectTrigger>
                        <SelectContent>
                          {RAMP_ACTION_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        disabled={!chosen || logAction.isPending}
                        onClick={() => {
                          if (!chosen) return;
                          logAction.mutate(
                            {
                              employeeId: member.employee_id,
                              actionType: chosen,
                              flagId: member.flag_id,
                            },
                            {
                              onSuccess: () =>
                                setSelected((prev) => ({
                                  ...prev,
                                  [member.employee_id]: undefined,
                                })),
                            },
                          );
                        }}
                      >
                        Registrér handling
                      </Button>
                      {member.flag_id && (
                        <Button
                          variant="outline"
                          disabled={closeFlag.isPending}
                          onClick={() => closeFlag.mutate(member.flag_id as string)}
                        >
                          Luk flag
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
