import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDbDataQuality, type ClientActivityInput } from "@/hooks/useDbDataQuality";

/**
 * Datakvalitet for DB-beregningen.
 *
 * Panelet advarer aktivt om huller i grundlaget, så et manglende beløb ikke
 * stille bliver 0 kr. Der ændres ingen data — det er ren diagnostik.
 */
interface DbDataQualityPanelProps {
  clientActivity: ClientActivityInput[];
}

export function DbDataQualityPanel({ clientActivity }: DbDataQualityPanelProps) {
  const { categories, totalIssues, criticalIssues, isLoading } = useDbDataQuality(clientActivity);
  const [isOpen, setIsOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (isLoading) return null;

  const allGood = totalIssues === 0;

  return (
    <Card
      className={cn(
        "border",
        allGood
          ? "border-primary/30"
          : criticalIssues > 0
            ? "border-destructive/50"
            : "border-amber-500/50"
      )}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer py-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                {allGood ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : criticalIssues > 0 ? (
                  <ShieldAlert className="h-4 w-4 text-destructive" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                )}
                Datakvalitet i beregningsgrundlaget
                {allGood ? (
                  <Badge variant="outline" className="ml-1">
                    Intet at rette
                  </Badge>
                ) : (
                  <>
                    {criticalIssues > 0 && (
                      <Badge variant="destructive" className="ml-1">
                        {criticalIssues} kritiske
                      </Badge>
                    )}
                    {totalIssues - criticalIssues > 0 && (
                      <Badge variant="secondary">{totalIssues - criticalIssues} advarsler</Badge>
                    )}
                  </>
                )}
              </CardTitle>
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
            </div>
            {!allGood && !isOpen && (
              <p className="text-xs text-muted-foreground pt-1">
                Beløb der ikke kan beregnes vises som "mangler grundlag" — ikke som 0 kr.
              </p>
            )}
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-2">
            {allGood ? (
              <p className="text-sm text-muted-foreground">
                Alle teams har leder med sats, alle assistenter har lønrække, og alle klienter
                med aktivitet er knyttet til et team.
              </p>
            ) : (
              categories.map((category) => {
                const count = category.issues.length;
                const isExpanded = expanded === category.id;
                return (
                  <div
                    key={category.id}
                    className={cn(
                      "rounded-md border",
                      count === 0 && "opacity-60",
                      count > 0 && category.severity === "critical" && "border-destructive/40"
                    )}
                  >
                    <button
                      type="button"
                      className="w-full flex items-center justify-between gap-3 p-3 text-left"
                      onClick={() => setExpanded(isExpanded ? null : category.id)}
                      disabled={count === 0}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{category.title}</span>
                          <Badge
                            variant={
                              count === 0
                                ? "outline"
                                : category.severity === "critical"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {count}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {category.description}
                        </p>
                      </div>
                      {count > 0 &&
                        (isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        ))}
                    </button>

                    {isExpanded && count > 0 && (
                      <div className="border-t divide-y">
                        {category.issues.map((issue) => (
                          <div
                            key={issue.id}
                            className="p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{issue.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {issue.role ? `${issue.role} · ` : ""}
                                {issue.teamName ? `${issue.teamName} · ` : ""}
                                {issue.detail}
                              </p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              {issue.employeeId && (
                                <Button asChild variant="outline" size="sm">
                                  <a
                                    href={`/employees?employee=${issue.employeeId}`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    Åbn medarbejder
                                  </a>
                                </Button>
                              )}
                              {!issue.employeeId && issue.teamId && (
                                <Button asChild variant="outline" size="sm">
                                  <a href="/team-management">Åbn team</a>
                                </Button>
                              )}
                              {issue.clientId && (
                                <Button asChild variant="outline" size="sm">
                                  <a href="/team-management">Tilknyt team</a>
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
