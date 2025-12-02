import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TrendingUp } from "lucide-react";

interface Agent {
  id: string;
  name: string;
  sales: number;
  commission: number;
  revenue?: number;
}

interface TopAgentsTableProps {
  agents: Agent[];
}

export function TopAgentsTable({ agents }: TopAgentsTableProps) {
  const formatCurrency = (value: number) => value.toLocaleString("da-DK") + " kr";

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Top 5 Agenter</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">Sorteret efter omsætning</p>
      
      <div className="space-y-3">
        {agents.map((agent, index) => (
          <div 
            key={agent.id}
            className="flex items-center gap-4 rounded-lg bg-muted/30 p-3 transition-colors hover:bg-muted/50"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {index + 1}
            </span>
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-accent text-accent-foreground">
                {agent.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{agent.name}</p>
              <p className="text-sm text-muted-foreground">{agent.sales} salg</p>
            </div>
            <div className="text-right">
              {agent.revenue !== undefined && agent.revenue > 0 && (
                <p className="font-semibold text-foreground">
                  {formatCurrency(agent.revenue)}
                </p>
              )}
              <p className="text-xs text-success">
                {formatCurrency(agent.commission)} prov.
              </p>
            </div>
          </div>
        ))}
        {agents.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-4">
            Ingen data tilgængelig
          </p>
        )}
      </div>
    </div>
  );
}
