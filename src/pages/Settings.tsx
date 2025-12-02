import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Edit2, Loader2, Plus, RefreshCw, Save, Trash2, CheckCircle2, AlertCircle, Link2 } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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

  const getProductName = (productId: string | null) => {
    if (!productId) return 'Ingen (bruger auto-match)';
    const product = products.find(p => p.id === productId);
    return product ? `${product.name} (${product.code})` : 'Ukendt';
  };

  return (
    <MainLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Indstillinger</h1>
          <p className="mt-1 text-muted-foreground">
            Administrer produkter, provisionsregler og systemindstillinger
          </p>
        </div>

        {/* Products Section */}
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Produkter</h2>
              <p className="text-sm text-muted-foreground">
                {products.length} produkter konfigureret
              </p>
            </div>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Tilføj produkt
            </Button>
          </div>

          <div className="max-h-96 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Navn</TableHead>
                  <TableHead className="text-muted-foreground">Kode</TableHead>
                  <TableHead className="text-muted-foreground">Provision</TableHead>
                  <TableHead className="text-muted-foreground">Clawback</TableHead>
                  <TableHead className="text-muted-foreground">Aktiv</TableHead>
                  <TableHead className="text-muted-foreground text-right">Handlinger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.slice(0, 20).map((product) => (
                  <TableRow key={product.id} className="border-border">
                    <TableCell className="font-medium text-foreground">{product.name}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{product.code}</TableCell>
                    <TableCell className="text-foreground">
                      {product.commission_type === "fixed" 
                        ? `${product.commission_value} kr` 
                        : `${product.commission_value}%`}
                    </TableCell>
                    <TableCell className="text-foreground">{product.clawback_window_days} dage</TableCell>
                    <TableCell>
                      <Switch checked={product.is_active} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-danger hover:text-danger">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {products.length > 20 && (
            <p className="text-xs text-muted-foreground mt-2">
              Viser 20 af {products.length} produkter
            </p>
          )}
        </section>

        {/* Campaign Mapping Section */}
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Kampagne-Produkt Mapping
              </h2>
              <p className="text-sm text-muted-foreground">
                Tilknyt Adversus kampagner til specifikke produkter. Kør sync for at opdatere kampagnelisten.
              </p>
            </div>
          </div>

          {campaignMappings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Link2 className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>Ingen kampagner fundet.</p>
              <p className="text-sm">Kør en synkronisering for at hente kampagner fra Adversus.</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Adversus Kampagne</TableHead>
                    <TableHead className="text-muted-foreground">Kampagne ID</TableHead>
                    <TableHead className="text-muted-foreground w-[300px]">Tilknyttet Produkt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaignMappings.map((mapping) => (
                    <TableRow key={mapping.id} className="border-border">
                      <TableCell className="font-medium text-foreground">
                        {mapping.adversus_campaign_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {mapping.adversus_campaign_id}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={mapping.product_id || 'none'}
                          onValueChange={(value) => handleMappingChange(mapping.id, value)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Vælg produkt..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              <span className="text-muted-foreground">Ingen (bruger auto-match)</span>
                            </SelectItem>
                            {products.filter(p => p.is_active).map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name} ({product.code}) - {product.commission_value} kr
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
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
                  : 'bg-danger/10 border border-danger/20'
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
                    <AlertCircle className="h-5 w-5 text-danger" />
                    <p className="text-sm text-foreground">Synkronisering fejlede</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground mt-4">
            Synkroniseringen henter de seneste 30 dages data fra Adversus
          </p>
        </section>
      </div>
    </MainLayout>
  );
}
