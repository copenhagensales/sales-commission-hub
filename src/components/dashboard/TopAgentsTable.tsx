import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Agent {
  id: string;
  name: string;
  sales: number;
  commission: number;
}

interface TopAgentsTableProps {
  agents: Agent[];
}

export function TopAgentsTable({ agents }: TopAgentsTableProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold text-foreground">Top 5 Agenter</h3>
      <div className="space-y-4">
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
            <div className="flex-1">
              <p className="font-medium text-foreground">{agent.name}</p>
              <p className="text-sm text-muted-foreground">{agent.sales} salg</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-success">
                {agent.commission.toLocaleString("da-DK")} kr
              </p>
              <p className="text-xs text-muted-foreground">provision</p>
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
