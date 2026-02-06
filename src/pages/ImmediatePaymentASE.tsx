import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CreditCard, Loader2, FileX } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { CLIENT_IDS } from "@/utils/clientIds";
import { MainLayout } from "@/components/layout/MainLayout";
import { toast } from "@/hooks/use-toast";

const ASE_CLIENT_ID = CLIENT_IDS["Ase"];

// Calculate payroll period (15th to 14th)
function getPayrollPeriod(): { start: Date; end: Date } {
  const today = new Date();
  const currentDay = today.getDate();
  const year = today.getFullYear();
  const month = today.getMonth();
  
  let start: Date;
  let end: Date;
  
  if (currentDay >= 15) {
    // Period: 15th of current month to 14th of next month
    start = new Date(year, month, 15, 0, 0, 0);
    end = new Date(year, month + 1, 14, 23, 59, 59);
  } else {
    // Period: 15th of previous month to 14th of current month
    start = new Date(year, month - 1, 15, 0, 0, 0);
    end = new Date(year, month, 14, 23, 59, 59);
  }
  
  return { start, end };
}

interface ImmediatePaymentSale {
  id: string;
  sale_datetime: string;
  customer_company: string | null;
  customer_phone: string | null;
  rule_name: string;
  sale_item_id: string;
  matched_pricing_rule_id: string;
  is_immediate_payment: boolean;
}

export default function ImmediatePaymentASE() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [convertingSaleId, setConvertingSaleId] = useState<string | null>(null);
  
  // Calculate current payroll period
  const payrollPeriod = useMemo(() => getPayrollPeriod(), []);

  // Mutation for converting to immediate payment
  const convertMutation = useMutation({
    mutationFn: async (sale: ImmediatePaymentSale) => {
      // 1. Get pricing rule with immediate_payment values and use_rule_name_as_display
      const { data: rule, error: ruleError } = await supabase
        .from("product_pricing_rules")
        .select("immediate_payment_commission_dkk, immediate_payment_revenue_dkk, name, use_rule_name_as_display")
        .eq("id", sale.matched_pricing_rule_id)
        .single();
      
      if (ruleError || !rule) {
        throw new Error("Kunne ikke hente prisregel");
      }
      
      // Determine display name: use rule name if configured
      const displayName = rule.use_rule_name_as_display ? rule.name : null;
      
      // 2. Update sale_item with new values
      const { error: updateError } = await supabase
        .from("sale_items")
        .update({
          is_immediate_payment: true,
          mapped_commission: rule.immediate_payment_commission_dkk,
          mapped_revenue: rule.immediate_payment_revenue_dkk,
          display_name: displayName,
        })
        .eq("id", sale.sale_item_id);
      
      if (updateError) {
        throw new Error("Kunne ikke opdatere salget");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["immediate-payment-ase-sales"] });
      toast({ title: "Straksbetaling tilføjet", description: "Salget er nu konverteret til straksbetaling." });
      setConvertingSaleId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
      setConvertingSaleId(null);
    },
  });

  // Mutation for cancelling immediate payment
  const cancelMutation = useMutation({
    mutationFn: async (sale: ImmediatePaymentSale) => {
      // 1. Get pricing rule with standard values and use_rule_name_as_display
      const { data: rule, error: ruleError } = await supabase
        .from("product_pricing_rules")
        .select("commission_dkk, revenue_dkk, name, use_rule_name_as_display")
        .eq("id", sale.matched_pricing_rule_id)
        .single();
      
      if (ruleError || !rule) {
        throw new Error("Kunne ikke hente prisregel");
      }
      
      // Determine display name: use rule name if configured (same as non-immediate)
      const displayName = rule.use_rule_name_as_display ? rule.name : null;
      
      // 2. Update sale_item with standard values
      const { error: updateError } = await supabase
        .from("sale_items")
        .update({
          is_immediate_payment: false,
          mapped_commission: rule.commission_dkk,
          mapped_revenue: rule.revenue_dkk,
          display_name: displayName,
        })
        .eq("id", sale.sale_item_id);
      
      if (updateError) {
        throw new Error("Kunne ikke annullere straksbetaling");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["immediate-payment-ase-sales"] });
      toast({ title: "Straksbetaling annulleret", description: "Salget er nu tilbageført til standard provision." });
      setConvertingSaleId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
      setConvertingSaleId(null);
    },
  });

  const { data: agentEmails = [] } = useQuery({
    queryKey: ["employee-agent-emails", user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      
      const lowerEmail = user.email.toLowerCase();
      
      // Find employee
      const { data: employee } = await supabase
        .from("employee_master_data")
        .select("id")
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .maybeSingle();
      
      if (!employee) return [];
      
      // Get agent mappings
      const { data: mappings } = await supabase
        .from("employee_agent_mapping")
        .select("agent_id, agents(email)")
        .eq("employee_id", employee.id);
      
      if (!mappings) return [];
      
      return mappings
        .map(m => (m.agents as any)?.email)
        .filter(Boolean)
        .map((e: string) => e.toLowerCase());
    },
    enabled: !!user?.email,
  });

  // Get ASE sales with immediate payment pricing rules for current payroll period
  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["immediate-payment-ase-sales", agentEmails, payrollPeriod.start.toISOString()],
    queryFn: async () => {
      if (agentEmails.length === 0) return [];

      // Get ASE campaigns
      const { data: aseCampaigns } = await supabase
        .from("client_campaigns")
        .select("id")
        .eq("client_id", ASE_CLIENT_ID);

      if (!aseCampaigns || aseCampaigns.length === 0) return [];
      
      const campaignIds = aseCampaigns.map(c => c.id);

      // Get sales for this agent with ASE campaigns within payroll period
      const { data: salesData } = await supabase
        .from("sales")
        .select(`
          id,
          sale_datetime,
          customer_company,
          customer_phone,
          agent_email,
          sale_items!inner(
            id,
            matched_pricing_rule_id,
            is_immediate_payment,
            product_id,
            products(name)
          )
        `)
        .in("client_campaign_id", campaignIds)
        .gte("sale_datetime", payrollPeriod.start.toISOString())
        .lte("sale_datetime", payrollPeriod.end.toISOString())
        .order("sale_datetime", { ascending: false });

      if (!salesData) return [];

      // Filter to only sales where agent_email matches (case-insensitive)
      const filteredSales = salesData.filter(s => 
        agentEmails.includes(s.agent_email?.toLowerCase?.() || "")
      );

      // Get pricing rules with allows_immediate_payment = true
      const pricingRuleIds = filteredSales
        .flatMap(s => s.sale_items.map((si: any) => si.matched_pricing_rule_id))
        .filter(Boolean);

      if (pricingRuleIds.length === 0) return [];

      const { data: pricingRules } = await supabase
        .from("product_pricing_rules")
        .select("id, name")
        .in("id", pricingRuleIds)
        .eq("allows_immediate_payment", true);

      if (!pricingRules || pricingRules.length === 0) return [];

      const immediatePaymentRules = new Map(pricingRules.map(r => [r.id, r.name]));
      const immediatePaymentRuleIds = new Set(pricingRules.map(r => r.id));

      // Filter sales to only those with immediate payment rules
      const result: ImmediatePaymentSale[] = [];
      for (const sale of filteredSales) {
        const matchingItem = sale.sale_items.find((si: any) => 
          si.matched_pricing_rule_id && immediatePaymentRuleIds.has(si.matched_pricing_rule_id)
        );
        if (matchingItem) {
          result.push({
            id: sale.id,
            sale_datetime: sale.sale_datetime,
            customer_company: sale.customer_company,
            customer_phone: sale.customer_phone,
            rule_name: immediatePaymentRules.get((matchingItem as any).matched_pricing_rule_id) || "Ukendt regel",
            sale_item_id: (matchingItem as any).id,
            matched_pricing_rule_id: (matchingItem as any).matched_pricing_rule_id,
            is_immediate_payment: (matchingItem as any).is_immediate_payment || false,
          });
        }
      }

      return result;
    },
    enabled: agentEmails.length > 0,
  });

  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center gap-3">
          <CreditCard className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Tilføj straksbetaling (ASE)</h1>
            <p className="text-muted-foreground">
              Lønperiode: {format(payrollPeriod.start, "d. MMM", { locale: da })} – {format(payrollPeriod.end, "d. MMM yyyy", { locale: da })}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Dine salg med straksbetaling</CardTitle>
            <CardDescription>
              Salg med mulighed for straksbetaling i nuværende lønperiode
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : sales.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileX className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-medium text-lg">Ingen salg fundet</h3>
                <p className="text-muted-foreground text-sm max-w-md mt-1">
                  Du har ingen ASE-salg med mulighed for straksbetaling i denne lønperiode.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dato</TableHead>
                    <TableHead>Regel</TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Handling</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell>
                        {format(new Date(sale.sale_datetime), "d. MMM yyyy", { locale: da })}
                      </TableCell>
                      <TableCell>{sale.rule_name}</TableCell>
                      <TableCell>
                        {sale.customer_company || sale.customer_phone || "Ukendt"}
                      </TableCell>
                      <TableCell>
                        {sale.is_immediate_payment ? (
                          <Badge variant="default">Aktiveret</Badge>
                        ) : (
                          <Badge variant="outline">Afventer</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {sale.is_immediate_payment ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                size="sm" 
                                variant="destructive"
                                disabled={cancelMutation.isPending && convertingSaleId === sale.sale_item_id}
                              >
                                {cancelMutation.isPending && convertingSaleId === sale.sale_item_id 
                                  ? "Behandler..." 
                                  : "Annuller straksbetaling"}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Annuller straksbetaling?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Ved at annullere straksbetaling reduceres din provision for dette salg 
                                  til standardsatsen.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Behold straksbetaling</AlertDialogCancel>
                                <AlertDialogAction 
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => {
                                    setConvertingSaleId(sale.sale_item_id);
                                    cancelMutation.mutate(sale);
                                  }}
                                >
                                  Annuller straksbetaling
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                size="sm" 
                                disabled={convertMutation.isPending && convertingSaleId === sale.sale_item_id}
                              >
                                {convertMutation.isPending && convertingSaleId === sale.sale_item_id 
                                  ? "Behandler..." 
                                  : "Tilføj straksbetaling"}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Ved at tilføje straksbetaling øges din provision for dette salg.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuller</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => {
                                    setConvertingSaleId(sale.sale_item_id);
                                    convertMutation.mutate(sale);
                                  }}
                                >
                                  Bekræft
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
