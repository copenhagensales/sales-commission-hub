import { MainLayout } from "@/components/layout/MainLayout";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Loader2, Search, UserPlus } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Agent {
  id: string;
  name: string;
  email: string;
  base_salary_monthly: number;
  is_active: boolean;
  external_adversus_id: string | null;
}

interface AgentWithStats extends Agent {
  salesCount: number;
  totalCommission: number;
}

export default function Agents() {
  const [search, setSearch] = useState("");
  
  // Fetch agents from database
  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['agents-with-stats'],
    queryFn: async () => {
      // Fetch all agents
      const { data: agentsData, error: agentsError } = await supabase
        .from('agents')
        .select('*')
        .order('name');
      
      if (agentsError) throw agentsError;
      
      // Fetch sales counts and commission totals for each agent
      const agentsWithStats: AgentWithStats[] = await Promise.all(
        (agentsData || []).map(async (agent) => {
          // Get sales count for this month
          const startOfMonth = new Date();
          startOfMonth.setDate(1);
          startOfMonth.setHours(0, 0, 0, 0);
          
          const { count: salesCount } = await supabase
            .from('sales')
            .select('*', { count: 'exact', head: true })
            .eq('agent_id', agent.id)
            .gte('sale_date', startOfMonth.toISOString());
          
          // Get total commission for this month
          const { data: commissions } = await supabase
            .from('commission_transactions')
            .select('amount')
            .eq('agent_id', agent.id)
            .gte('created_at', startOfMonth.toISOString());
          
          const totalCommission = (commissions || []).reduce(
            (sum, c) => sum + (Number(c.amount) || 0), 
            0
          );
          
          return {
            ...agent,
            salesCount: salesCount || 0,
            totalCommission
          };
        })
      );
      
      return agentsWithStats;
    }
  });
  
  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(search.toLowerCase()) ||
    agent.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Agenter</h1>
            <p className="mt-1 text-muted-foreground">
              {agents.length} agenter synkroniseret fra Adversus
            </p>
          </div>
          <Button className="gap-2">
            <UserPlus className="h-4 w-4" />
            Tilføj agent
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Søg efter navn eller email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Agent</TableHead>
                  <TableHead className="text-muted-foreground">Grundløn</TableHead>
                  <TableHead className="text-muted-foreground">Salg (måned)</TableHead>
                  <TableHead className="text-muted-foreground">Provision</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAgents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {search ? 'Ingen agenter matcher søgningen' : 'Ingen agenter fundet'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAgents.map((agent) => (
                    <TableRow 
                      key={agent.id} 
                      className="border-border cursor-pointer hover:bg-muted/50"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-accent text-accent-foreground">
                              {agent.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground">{agent.name}</p>
                            <p className="text-sm text-muted-foreground">{agent.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-foreground">
                        {(agent.base_salary_monthly || 0).toLocaleString("da-DK")} kr
                      </TableCell>
                      <TableCell className="text-foreground">
                        {agent.salesCount}
                      </TableCell>
                      <TableCell className="font-semibold text-success">
                        {agent.totalCommission.toLocaleString("da-DK")} kr
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={agent.is_active ? "active" : "cancelled"} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
