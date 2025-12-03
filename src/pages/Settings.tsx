import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, RefreshCw, Save, CheckCircle2, AlertCircle, Link2, Package, Plus } from "lucide-react";
import { useState, useMemo } from "react";
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

interface SyncSummary {
  agents: { created: number; updated: number };
  sessions: { processed: number; salesCreated: number; salesUpdated: number; unmatchedSales?: number };
  campaigns?: { total: number };
  productMatches?: Record<string, number>;
  outcomeStats?: Record<string, number>;
}

export default function Settings() {
  const queryClient = useQueryClient();
  const [vacationPayPercentage, setVacationPayPercentage] = useState("12.5");
  const [defaultClawbackDays, setDefaultClawbackDays] = useState("30");
  const [isSyncing, setIsSyncing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isCreatingProducts, setIsCreatingProducts] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [scanResults, setScanResults] = useState<{
    campaigns: {campaignId: number; campaignName: string; products: Record<string, {count: number; commission?: number}>; outcomes: Record<string, number>}[]
    allCampaigns?: {id: number; name: string}[]
  } | null>(null);
  const [syncProgress, setSyncProgress] = useState<{
    current: number;
    total: number;
    currentPeriod: string;
  } | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<{
    success: boolean;
    summary?: SyncSummary;
  } | null>(null);

  // Extract unique products from scan results
  const uniqueProducts = useMemo(() => {
    if (!scanResults?.campaigns) return [];
    const productMap = new Map<string, { name: string; count: number; campaigns: string[] }>();
    
    for (const campaign of scanResults.campaigns) {
      for (const [productName, data] of Object.entries(campaign.products)) {
        const existing = productMap.get(productName);
        if (existing) {
          existing.count += data.count;
          existing.campaigns.push(campaign.campaignName);
        } else {
          productMap.set(productName, { 
            name: productName, 
            count: data.count, 
            campaigns: [campaign.campaignName] 
          });
        }
      }
    }
    
    return Array.from(productMap.values()).sort((a, b) => b.count - a.count);
  }, [scanResults]);

  const handleScanProducts = async () => {
    setIsScanning(true);
    setScanResults(null);
    setSelectedProducts(new Set());
    try {
      const { data, error } = await supabase.functions.invoke('sync-adversus', {
        body: { action: 'scan-all-products' }
      });
      if (error) throw error;
      setScanResults(data);
      toast.success(`Fundet ${data.campaigns?.length || 0} kampagner med produkter`);
    } catch (err) {
      console.error('Scan error:', err);
      toast.error('Scan fejlede');
    } finally {
      setIsScanning(false);
    }
  };

  const handleCreateSelectedProducts = async () => {
    if (selectedProducts.size === 0) {
      toast.error('Vælg mindst ét produkt');
      return;
    }
    
    setIsCreatingProducts(true);
    try {
      const productsToCreate = Array.from(selectedProducts).map(name => ({
        name,
        code: name.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 20).toUpperCase(),
        commission_type: 'fixed' as const,
        commission_value: 0,
        clawback_window_days: 30,
        is_active: true,
        revenue_amount: 0
      }));
      
      const { error } = await supabase.from('products').insert(productsToCreate);
      if (error) throw error;
      
      toast.success(`${productsToCreate.length} produkter oprettet`);
      setSelectedProducts(new Set());
      queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (err) {
      console.error('Create error:', err);
      toast.error('Fejl ved oprettelse af produkter');
    } finally {
      setIsCreatingProducts(false);
    }
  };

  const toggleProductSelection = (productName: string) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      if (next.has(productName)) {
        next.delete(productName);
      } else {
        next.add(productName);
      }
      return next;
    });
  };

  const selectAllProducts = () => {
    setSelectedProducts(new Set(uniqueProducts.map(p => p.name)));
  };

  const deselectAllProducts = () => {
    setSelectedProducts(new Set());
  };

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

  // Simple sync for short periods
  const handleAdversusSync = async (hours: number) => {
    setIsSyncing(true);
    setLastSyncResult(null);
    setSyncProgress(null);
    
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

  // Chunked sync for longer periods (30 days in 7-day chunks)
  const handleChunkedSync = async (totalDays: number, chunkDays: number = 7) => {
    setIsSyncing(true);
    setLastSyncResult(null);
    
    const now = new Date();
    const chunks: { startDate: Date; endDate: Date }[] = [];
    
    // Create chunks from oldest to newest
    for (let i = totalDays; i > 0; i -= chunkDays) {
      const daysBack = i;
      const daysEnd = Math.max(i - chunkDays, 0);
      
      chunks.push({
        startDate: new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000),
        endDate: new Date(now.getTime() - daysEnd * 24 * 60 * 60 * 1000)
      });
    }
    
    const totalChunks = chunks.length;
    const combinedSummary: SyncSummary = {
      agents: { created: 0, updated: 0 },
      sessions: { processed: 0, salesCreated: 0, salesUpdated: 0, unmatchedSales: 0 },
      campaigns: { total: 0 },
      productMatches: {},
      outcomeStats: {}
    };
    
    try {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const periodLabel = `${chunk.startDate.toLocaleDateString('da-DK')} - ${chunk.endDate.toLocaleDateString('da-DK')}`;
        
        setSyncProgress({
          current: i + 1,
          total: totalChunks,
          currentPeriod: periodLabel
        });
        
        console.log(`Syncing chunk ${i + 1}/${totalChunks}: ${periodLabel}`);
        
        const { data, error } = await supabase.functions.invoke('sync-adversus', {
          body: {
            startDate: chunk.startDate.toISOString(),
            endDate: chunk.endDate.toISOString()
          }
        });
        
        if (error) {
          console.error(`Chunk ${i + 1} sync error:`, error);
          toast.error(`Fejl i periode ${periodLabel}: ${error.message}`);
          continue; // Continue with next chunk instead of aborting
        }
        
        // Aggregate results
        if (data?.summary) {
          combinedSummary.agents.created += data.summary.agents?.created || 0;
          combinedSummary.agents.updated += data.summary.agents?.updated || 0;
          combinedSummary.sessions.processed += data.summary.sessions?.processed || 0;
          combinedSummary.sessions.salesCreated += data.summary.sessions?.salesCreated || 0;
          combinedSummary.sessions.salesUpdated += data.summary.sessions?.salesUpdated || 0;
          combinedSummary.sessions.unmatchedSales = (combinedSummary.sessions.unmatchedSales || 0) + (data.summary.sessions?.unmatchedSales || 0);
          combinedSummary.campaigns!.total = data.summary.campaigns?.total || combinedSummary.campaigns!.total;
          
          // Merge product matches
          if (data.summary.productMatches) {
            for (const [code, count] of Object.entries(data.summary.productMatches)) {
              combinedSummary.productMatches![code] = (combinedSummary.productMatches![code] || 0) + (count as number);
            }
          }
          
          // Merge outcome stats
          if (data.summary.outcomeStats) {
            for (const [outcome, count] of Object.entries(data.summary.outcomeStats)) {
              combinedSummary.outcomeStats![outcome] = (combinedSummary.outcomeStats![outcome] || 0) + (count as number);
            }
          }
        }
        
        toast.success(`Periode ${i + 1}/${totalChunks} fuldført: ${data?.summary?.sessions?.salesCreated || 0} salg`);
        
        // Wait between chunks to avoid rate limits
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      
      setLastSyncResult({ success: true, summary: combinedSummary });
      refetchMappings();
      
      toast.success(
        `Komplet synkronisering fuldført! ${combinedSummary.sessions.salesCreated} nye salg fra ${totalDays} dage`
      );
    } catch (err) {
      console.error('Chunked sync error:', err);
      toast.error('Synkronisering fejlede');
      setLastSyncResult({ success: false });
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
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

          <div className="space-y-4">
            <div className="flex items-start gap-2 flex-wrap">
              <Button 
                onClick={() => handleAdversusSync(12)} 
                disabled={isSyncing || isScanning}
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
                disabled={isSyncing || isScanning}
                variant="outline"
                className="gap-2"
              >
                Sidste 24 timer
              </Button>
              <Button 
                onClick={() => handleChunkedSync(30, 7)} 
                disabled={isSyncing || isScanning}
                className="gap-2"
              >
                Sidste 30 dage (i bidder)
              </Button>
              <Button 
                onClick={handleScanProducts} 
                disabled={isSyncing || isScanning}
                variant="secondary"
                className="gap-2"
              >
                {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
                Scan produkter fra sales
              </Button>
            </div>

            {/* Scan results - Unique products for creation */}
            {scanResults && uniqueProducts.length > 0 && (
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-foreground">
                    Fundet {uniqueProducts.length} unikke produkter
                  </p>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={selectAllProducts}>
                      Vælg alle
                    </Button>
                    <Button variant="ghost" size="sm" onClick={deselectAllProducts}>
                      Fravælg alle
                    </Button>
                  </div>
                </div>
                
                <div className="max-h-64 overflow-auto space-y-2">
                  {uniqueProducts.map((product) => (
                    <div 
                      key={product.name} 
                      className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleProductSelection(product.name)}
                    >
                      <Checkbox 
                        checked={selectedProducts.has(product.name)}
                        onCheckedChange={() => toggleProductSelection(product.name)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {product.count} salg • {product.campaigns.slice(0, 2).join(', ')}
                          {product.campaigns.length > 2 && ` +${product.campaigns.length - 2} mere`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <p className="text-sm text-muted-foreground">
                    {selectedProducts.size} produkter valgt
                  </p>
                  <Button 
                    onClick={handleCreateSelectedProducts}
                    disabled={selectedProducts.size === 0 || isCreatingProducts}
                    className="gap-2"
                  >
                    {isCreatingProducts ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Opret valgte produkter
                  </Button>
                </div>
              </div>
            )}

            {/* Campaign details (collapsed) */}
            {scanResults && scanResults.campaigns && (
              <details className="rounded-lg border border-border bg-muted/30 p-4">
                <summary className="cursor-pointer font-medium text-foreground">
                  Detaljer: {scanResults.campaigns.length} kampagner med data
                </summary>
                <div className="mt-3 space-y-3 max-h-64 overflow-auto">
                  {scanResults.campaigns.map((c) => (
                    <div key={c.campaignId} className="text-sm border-b border-border pb-2">
                      <p className="font-medium">{c.campaignName} <span className="text-muted-foreground text-xs">({c.campaignId})</span></p>
                      {Object.keys(c.products).length > 0 && (
                        <ul className="pl-4 text-muted-foreground text-xs mt-1">
                          {Object.entries(c.products).map(([product, data]) => (
                            <li key={product} className="text-green-600">{product}: {data.count}</li>
                          ))}
                        </ul>
                      )}
                      {Object.keys(c.outcomes || {}).length > 0 && (
                        <ul className="pl-4 text-muted-foreground text-xs mt-1">
                          {Object.entries(c.outcomes).map(([outcome, count]) => (
                            <li key={outcome} className="text-blue-600">{outcome}: {count}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* Progress indicator */}
            {syncProgress && (
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Synkroniserer periode {syncProgress.current} af {syncProgress.total}
                  </span>
                  <span className="font-medium text-foreground">
                    {Math.round((syncProgress.current / syncProgress.total) * 100)}%
                  </span>
                </div>
                <Progress value={(syncProgress.current / syncProgress.total) * 100} />
                <p className="text-xs text-muted-foreground">
                  Nuværende periode: {syncProgress.currentPeriod}
                </p>
              </div>
            )}

            {lastSyncResult && !syncProgress && (
              <div className={`rounded-lg p-4 ${
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
                      {lastSyncResult.summary.outcomeStats && Object.keys(lastSyncResult.summary.outcomeStats).length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                            Vis outcome-statistik ({Object.keys(lastSyncResult.summary.outcomeStats).length} unikke outcomes)
                          </summary>
                          <ul className="mt-1 pl-4 text-xs max-h-48 overflow-y-auto">
                            {Object.entries(lastSyncResult.summary.outcomeStats)
                              .sort(([, a], [, b]) => (b as number) - (a as number))
                              .map(([outcome, count]) => (
                                <li key={outcome} className="flex justify-between gap-2">
                                  <span className="truncate">{outcome}</span>
                                  <span className="text-muted-foreground">{count}</span>
                                </li>
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
