import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2, RefreshCw, Save, CheckCircle2, AlertCircle, Link2, Package } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ProductsSection } from "@/components/settings/ProductsSection";
import { CampaignMappingSection } from "@/components/settings/CampaignMappingSection";

interface Product {
  id: string;
  code: string;
  name: string;
  commission_type: string;
  commission_value: number;
  clawback_window_days: number;
  is_active: boolean;
}

interface CampaignMapping {
  id: string;
  adversus_campaign_id: string;
  adversus_campaign_name: string;
  adversus_outcome: string | null;
  product_id: string | null;
}

export default function Settings() {
  const queryClient = useQueryClient();
  const [vacationPayPercentage, setVacationPayPercentage] = useState("12.5");
  const [defaultClawbackDays, setDefaultClawbackDays] = useState("30");
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<{
    success: boolean;
    summary?: {
      agents: { created: number; updated: number };
      sessions: { processed: number; salesCreated: number; salesUpdated: number; unmatchedSales?: number };
      campaigns?: { total: number };
      productMatches?: Record<string, number>;
    };
  } | null>(null);

  // Fetch products
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Product[];
    }
  });

  // Fetch campaign mappings
  const { data: campaignMappings = [], refetch: refetchMappings } = useQuery({
    queryKey: ['campaign-mappings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaign_product_mappings')
        .select('*')
        .order('adversus_campaign_name');
      if (error) throw error;
      return data as CampaignMapping[];
    }
  });

  // Update campaign mapping mutation
  const updateMappingMutation = useMutation({
    mutationFn: async ({ id, product_id }: { id: string; product_id: string | null }) => {
      const { error } = await supabase
        .from('campaign_product_mappings')
        .update({ product_id })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-mappings'] });
      toast.success('Kampagne-mapping opdateret');
    },
    onError: (error) => {
      toast.error('Kunne ikke opdatere mapping: ' + error.message);
    }
  });

  const handleAdversusSync = async (hours: number = 30 * 24) => {
    setIsSyncing(true);
    setLastSyncResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('sync-adversus', {
        body: {
          startDate: new Date(Date.now() - hours * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        }
      });

      if (error) {
        console.error('Sync error:', error);
        toast.error('Synkronisering fejlede: ' + error.message);
        setLastSyncResult({ success: false });
        return;
      }

      setLastSyncResult(data);
      
      // Refetch campaign mappings after sync
      refetchMappings();
      
      toast.success(
        `Synkronisering fuldført! ${data.summary.agents.created} nye agenter, ${data.summary.sessions.salesCreated} nye salg`
      );
    } catch (err) {
      console.error('Sync error:', err);
      toast.error('Synkronisering fejlede');
      setLastSyncResult({ success: false });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleMappingChange = (mappingId: string, productId: string) => {
    updateMappingMutation.mutate({ 
      id: mappingId, 
      product_id: productId === 'none' ? null : productId 
    });
  };

  const handleBulkApprove = async (mappings: { id: string; productId: string }[]) => {
    for (const mapping of mappings) {
      await supabase
        .from('campaign_product_mappings')
        .update({ product_id: mapping.productId })
        .eq('id', mapping.id);
    }
    queryClient.invalidateQueries({ queryKey: ['campaign-mappings'] });
    toast.success(`${mappings.length} mappings godkendt`);
  };

  return (
    <MainLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Indstillinger</h1>
          <p className="mt-1 text-muted-foreground">
            Administrer produkter, kampagne-mappings og systemindstillinger
          </p>
        </div>

        {/* Products Section */}
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">Produkter</h2>
              <p className="text-sm text-muted-foreground">
                Administrer dine produkter og provisionsindstillinger
              </p>
            </div>
          </div>
          <ProductsSection products={products} />
        </section>

        {/* Campaign Mapping Section */}
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-primary/10">
              <Link2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">Kampagne-Produkt Mapping</h2>
              <p className="text-sm text-muted-foreground">
                Tilknyt Adversus kampagner til produkter for automatisk provisions-beregning
              </p>
            </div>
          </div>
          <CampaignMappingSection 
            campaignMappings={campaignMappings}
            products={products}
            onMappingChange={handleMappingChange}
            onBulkApprove={handleBulkApprove}
          />
        </section>

        {/* General Settings */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-xl font-semibold text-foreground mb-6">Generelle indstillinger</h2>
          
          <div className="grid gap-6 md:grid-cols-2 max-w-2xl">
            <div className="space-y-2">
              <Label htmlFor="vacation">Feriepengeprocent (%)</Label>
              <Input
                id="vacation"
                type="number"
                step="0.1"
                value={vacationPayPercentage}
                onChange={(e) => setVacationPayPercentage(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Bruges til beregning af feriepengeberettiget grundlag
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clawback">Standard clawback-vindue (dage)</Label>
              <Input
                id="clawback"
                type="number"
                value={defaultClawbackDays}
                onChange={(e) => setDefaultClawbackDays(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Standardværdi for nye produkter
              </p>
            </div>
          </div>

          <Separator className="my-6" />

          <Button className="gap-2">
            <Save className="h-4 w-4" />
            Gem indstillinger
          </Button>
        </section>

        {/* API Configuration */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-xl font-semibold text-foreground mb-2">Adversus Integration</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Synkroniser salgsdata og agenter fra Adversus
          </p>

          <div className="grid gap-6 md:grid-cols-2 max-w-2xl">
            <div className="space-y-2">
              <Label htmlFor="api-url">API URL</Label>
              <Input
                id="api-url"
                type="text"
                value="https://api.adversus.io/v1"
                disabled
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="api-status">API Status</Label>
              <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-background">
                <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                <span className="text-sm text-foreground">Konfigureret</span>
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          <div className="flex items-start gap-6 flex-wrap">
            <div className="flex gap-2">
              <Button 
                onClick={() => handleAdversusSync(12)} 
                disabled={isSyncing}
                variant="outline"
                className="gap-2"
              >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Sidste 12 timer
              </Button>
              <Button 
                onClick={() => handleAdversusSync(24)} 
                disabled={isSyncing}
                variant="outline"
                className="gap-2"
              >
                Sidste 24 timer
              </Button>
              <Button 
                onClick={() => handleAdversusSync(30 * 24)} 
                disabled={isSyncing}
                className="gap-2"
              >
                Sidste 30 dage
              </Button>
            </div>

            {lastSyncResult && (
              <div className={`rounded-lg p-4 flex-1 ${
                lastSyncResult.success 
                  ? 'bg-success/10 border border-success/20' 
                  : 'bg-destructive/10 border border-destructive/20'
              }`}>
                {lastSyncResult.success && lastSyncResult.summary ? (
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-foreground">Synkronisering fuldført</p>
                      <ul className="mt-1 space-y-0.5 text-muted-foreground">
                        <li>Agenter: {lastSyncResult.summary.agents.created} oprettet, {lastSyncResult.summary.agents.updated} opdateret</li>
                        <li>Sessions: {lastSyncResult.summary.sessions.processed} behandlet</li>
                        <li>Salg: {lastSyncResult.summary.sessions.salesCreated} oprettet, {lastSyncResult.summary.sessions.salesUpdated} opdateret</li>
                        {lastSyncResult.summary.sessions.unmatchedSales !== undefined && lastSyncResult.summary.sessions.unmatchedSales > 0 && (
                          <li className="text-warning">Umatched: {lastSyncResult.summary.sessions.unmatchedSales} salg uden produkt</li>
                        )}
                        {lastSyncResult.summary.campaigns && (
                          <li>Kampagner: {lastSyncResult.summary.campaigns.total} fundet</li>
                        )}
                      </ul>
                      {lastSyncResult.summary.productMatches && Object.keys(lastSyncResult.summary.productMatches).length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                            Vis produkt-statistik
                          </summary>
                          <ul className="mt-1 pl-4 text-xs">
                            {Object.entries(lastSyncResult.summary.productMatches).map(([code, count]) => (
                              <li key={code}>{code}: {count} salg</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <p className="text-sm text-foreground">Synkronisering fejlede</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </MainLayout>
  );
}
