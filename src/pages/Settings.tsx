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
import { Edit2, Loader2, Plus, RefreshCw, Save, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Mock data
const mockProducts = [
  { id: "1", name: "Premium Abonnement", code: "PREM", commissionType: "fixed", commissionValue: 500, clawbackDays: 30, isActive: true },
  { id: "2", name: "Standard Abonnement", code: "STD", commissionType: "fixed", commissionValue: 250, clawbackDays: 30, isActive: true },
  { id: "3", name: "Basis Abonnement", code: "BAS", commissionType: "percentage", commissionValue: 15, clawbackDays: 14, isActive: true },
];

export default function Settings() {
  const [vacationPayPercentage, setVacationPayPercentage] = useState("12.5");
  const [defaultClawbackDays, setDefaultClawbackDays] = useState("30");
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<{
    success: boolean;
    summary?: {
      agents: { created: number; updated: number };
      sessions: { processed: number; salesCreated: number; salesUpdated: number };
    };
  } | null>(null);

  const handleAdversusSync = async () => {
    setIsSyncing(true);
    setLastSyncResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('sync-adversus', {
        body: {
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
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
              <p className="text-sm text-muted-foreground">Administrer produkter og provisionsregler</p>
            </div>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Tilføj produkt
            </Button>
          </div>

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
              {mockProducts.map((product) => (
                <TableRow key={product.id} className="border-border">
                  <TableCell className="font-medium text-foreground">{product.name}</TableCell>
                  <TableCell className="text-muted-foreground font-mono">{product.code}</TableCell>
                  <TableCell className="text-foreground">
                    {product.commissionType === "fixed" 
                      ? `${product.commissionValue} kr` 
                      : `${product.commissionValue}%`}
                  </TableCell>
                  <TableCell className="text-foreground">{product.clawbackDays} dage</TableCell>
                  <TableCell>
                    <Switch checked={product.isActive} />
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

          <div className="flex items-start gap-6">
            <Button 
              onClick={handleAdversusSync} 
              disabled={isSyncing}
              className="gap-2"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Synkroniserer...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Synkroniser nu
                </>
              )}
            </Button>

            {lastSyncResult && (
              <div className={`rounded-lg p-4 ${
                lastSyncResult.success 
                  ? 'bg-success/10 border border-success/20' 
                  : 'bg-danger/10 border border-danger/20'
              }`}>
                {lastSyncResult.success && lastSyncResult.summary ? (
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-success mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-foreground">Synkronisering fuldført</p>
                      <ul className="mt-1 space-y-0.5 text-muted-foreground">
                        <li>Agenter: {lastSyncResult.summary.agents.created} oprettet, {lastSyncResult.summary.agents.updated} opdateret</li>
                        <li>Sessions: {lastSyncResult.summary.sessions.processed} behandlet</li>
                        <li>Salg: {lastSyncResult.summary.sessions.salesCreated} oprettet, {lastSyncResult.summary.sessions.salesUpdated} opdateret</li>
                      </ul>
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
