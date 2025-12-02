import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";

interface Agent {
  id: string;
  name: string;
  email: string;
  base_salary_monthly: number;
  is_active: boolean;
  external_adversus_id: string | null;
  employment_type?: string | null;
}

interface AgentDetailDrawerProps {
  agent: Agent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AgentDetailDrawer({ agent, open, onOpenChange }: AgentDetailDrawerProps) {
  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ['agent-sales', agent?.id],
    queryFn: async () => {
      if (!agent) return [];
      const { data, error } = await supabase
        .from('sales')
        .select(`
          id,
          sale_date,
          status,
          campaign_name,
          outcome,
          products!sales_product_id_fkey(name, revenue_amount, commission_value)
        `)
        .eq('agent_id', agent.id)
        .order('sale_date', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!agent && open
  });

  const { data: commissions = [], isLoading: commissionsLoading } = useQuery({
    queryKey: ['agent-commissions', agent?.id],
    queryFn: async () => {
      if (!agent) return [];
      const { data, error } = await supabase
        .from('commission_transactions')
        .select('*')
        .eq('agent_id', agent.id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!agent && open
  });

  const { data: absences = [], isLoading: absencesLoading } = useQuery({
    queryKey: ['agent-absences', agent?.id],
    queryFn: async () => {
      if (!agent) return [];
      const { data, error } = await supabase
        .from('absences')
        .select('*')
        .eq('agent_id', agent.id)
        .order('date', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!agent && open
  });

  // Calculate stats
  const totalEarned = commissions
    .filter(c => c.type === 'earn')
    .reduce((sum, c) => sum + (c.amount || 0), 0);
  
  const totalClawbacks = commissions
    .filter(c => c.type === 'clawback')
    .reduce((sum, c) => sum + Math.abs(c.amount || 0), 0);

  const netCommission = totalEarned - totalClawbacks;

  if (!agent) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-border">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                {agent.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <SheetTitle className="text-xl">{agent.name}</SheetTitle>
              <p className="text-sm text-muted-foreground">{agent.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={agent.is_active ? "active" : "cancelled"} />
                {agent.employment_type && (
                  <span className="text-xs text-muted-foreground capitalize">
                    {agent.employment_type === 'monthly' ? 'Månedsløn' : 'Timeløn'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* Stats Overview */}
        <div className="grid grid-cols-3 gap-3 py-4 border-b border-border">
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{sales.length}</p>
            <p className="text-xs text-muted-foreground">Salg total</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-success">
              {netCommission.toLocaleString('da-DK')} kr
            </p>
            <p className="text-xs text-muted-foreground">Netto provision</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">
              {(agent.base_salary_monthly || 0).toLocaleString('da-DK')} kr
            </p>
            <p className="text-xs text-muted-foreground">Grundløn</p>
          </div>
        </div>

        <Tabs defaultValue="sales" className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="sales" className="flex-1">Salg</TabsTrigger>
            <TabsTrigger value="commissions" className="flex-1">Provision</TabsTrigger>
            <TabsTrigger value="absences" className="flex-1">Fravær</TabsTrigger>
          </TabsList>

          <TabsContent value="sales" className="mt-4 space-y-2">
            {salesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : sales.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Ingen salg fundet</p>
            ) : (
              sales.map((sale: any) => (
                <div key={sale.id} className="p-3 rounded-lg bg-muted/50 border border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{sale.products?.name || sale.outcome || 'Ukendt produkt'}</p>
                      <p className="text-xs text-muted-foreground">
                        {sale.campaign_name || 'Ingen kampagne'}
                      </p>
                    </div>
                    <div className="text-right">
                      <StatusBadge status={sale.status} />
                      <p className="text-xs text-muted-foreground mt-1">
                        {sale.sale_date ? format(new Date(sale.sale_date), 'd. MMM yyyy', { locale: da }) : '-'}
                      </p>
                    </div>
                  </div>
                  {sale.products?.revenue_amount && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Omsætning: {sale.products.revenue_amount.toLocaleString('da-DK')} kr
                    </p>
                  )}
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="commissions" className="mt-4 space-y-2">
            {commissionsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : commissions.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Ingen provision fundet</p>
            ) : (
              <>
                <div className="flex justify-between text-sm mb-3 p-2 bg-muted/30 rounded">
                  <span>Optjent: <span className="text-success font-medium">{totalEarned.toLocaleString('da-DK')} kr</span></span>
                  <span>Clawbacks: <span className="text-destructive font-medium">-{totalClawbacks.toLocaleString('da-DK')} kr</span></span>
                </div>
                {commissions.map((commission: any) => (
                  <div key={commission.id} className="p-3 rounded-lg bg-muted/50 border border-border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`font-medium text-sm ${commission.type === 'clawback' ? 'text-destructive' : 'text-success'}`}>
                          {commission.type === 'earn' ? '+' : '-'}{Math.abs(commission.amount || 0).toLocaleString('da-DK')} kr
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {commission.type === 'earn' ? 'Optjent' : commission.type === 'clawback' ? 'Clawback' : 'Manuel justering'}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {commission.created_at ? format(new Date(commission.created_at), 'd. MMM yyyy', { locale: da }) : '-'}
                      </p>
                    </div>
                    {commission.reason && (
                      <p className="text-xs text-muted-foreground mt-1">{commission.reason}</p>
                    )}
                  </div>
                ))}
              </>
            )}
          </TabsContent>

          <TabsContent value="absences" className="mt-4 space-y-2">
            {absencesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : absences.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Intet fravær registreret</p>
            ) : (
              absences.map((absence: any) => (
                <div key={absence.id} className="p-3 rounded-lg bg-muted/50 border border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm capitalize">
                        {absence.type === 'sick' ? 'Syg' : absence.type === 'vacation' ? 'Ferie' : 'Andet'}
                      </p>
                      {absence.comment && (
                        <p className="text-xs text-muted-foreground">{absence.comment}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{absence.hours || 0} timer</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(absence.date), 'd. MMM yyyy', { locale: da })}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
