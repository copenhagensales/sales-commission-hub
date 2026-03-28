import { useState } from "react";
import { Loader2, Search, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface SyncSingleSaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integrationId: string;
  integrationName: string;
  provider: string;
}

interface SaleRecord {
  id: string;
  adversus_external_id: string | null;
  agent_name: string | null;
  agent_email: string | null;
  customer_company: string | null;
  customer_phone: string | null;
  sale_datetime: string | null;
  enrichment_status: string | null;
  internal_reference: string | null;
  integration_type: string | null;
}

interface SingleSaleResult {
  success?: boolean;
  healed?: number;
  failed?: number;
  skipped?: number;
  logs?: string[];
  message?: string;
}

type Step = "search" | "confirm";

export function SyncSingleSaleDialog({
  open,
  onOpenChange,
  integrationId,
  integrationName,
  provider,
}: SyncSingleSaleDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [step, setStep] = useState<Step>("search");
  const [isFetching, setIsFetching] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [searchResults, setSearchResults] = useState<SaleRecord[]>([]);
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null);
  const [result, setResult] = useState<SingleSaleResult | null>(null);

  const reset = () => {
    setSearchQuery("");
    setStep("search");
    setIsFetching(false);
    setIsRunning(false);
    setSearchResults([]);
    setSelectedSale(null);
    setResult(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  };

  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) {
      toast.error("Indtast en søgeværdi");
      return;
    }

    setIsFetching(true);
    setSearchResults([]);

    try {
      // Step 1: Search via RPC (includes raw_payload search)
      const { data: matchedIds, error: rpcError } = await supabase
        .rpc("search_sales", { search_query: q, max_results: 50 });
      if (rpcError) throw rpcError;
      if (!matchedIds?.length) {
        setSearchResults([]);
        toast.info("Ingen salg fundet for søgningen");
        setIsFetching(false);
        return;
      }

      // Step 2: Fetch full records filtered by provider
      const { data, error } = await supabase
        .from("sales")
        .select("id, adversus_external_id, agent_name, agent_email, customer_company, customer_phone, sale_datetime, enrichment_status, internal_reference, integration_type")
        .in("id", matchedIds)
        .eq("integration_type", provider)
        .order("sale_datetime", { ascending: false })
        .limit(10);

      if (error) throw error;

      setSearchResults((data as SaleRecord[]) || []);
      if (!data?.length) {
        toast.info("Ingen salg fundet for søgningen");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Søgning fejlede: ${message}`);
    } finally {
      setIsFetching(false);
    }
  };

  const handleSelectSale = (sale: SaleRecord) => {
    setSelectedSale(sale);
    setStep("confirm");
  };

  const runSync = async () => {
    if (!selectedSale?.adversus_external_id) {
      toast.error("Salget mangler external ID");
      return;
    }

    setIsRunning(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("enrichment-healer", {
        body: {
          integrationId,
          provider,
          saleExternalId: selectedSale.adversus_external_id,
          maxBatch: 1,
        },
      });

      if (error) throw error;

      setResult(data || {});
      toast.success(`${integrationName}: Single-sale sync kørt`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Single-sale sync fejlede: ${message}`);
      setResult({ success: false, message });
    } finally {
      setIsRunning(false);
    }
  };

  const formatDate = (dt: string | null) => {
    if (!dt) return "–";
    try {
      return format(new Date(dt), "dd-MM-yyyy HH:mm");
    } catch {
      return dt;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Sync enkelt salg</DialogTitle>
          <DialogDescription>
            Søg og vælg et salg for {integrationName} ({provider}), og kør enrichment/healing.
          </DialogDescription>
        </DialogHeader>

        {step === "search" && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Søg salg</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Lead ID, telefon, agent, kunde, OPP nr..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={isFetching} size="icon" className="shrink-0">
                  {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{searchResults.length} resultater</Label>
                <div className="max-h-60 overflow-y-auto rounded-md border divide-y">
                  {searchResults.map((sale) => (
                    <button
                      key={sale.id}
                      onClick={() => handleSelectSale(sale)}
                      className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors text-sm flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {sale.adversus_external_id || "–"} · {sale.agent_name || "Ukendt agent"}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {sale.customer_company || "Ingen firma"} · {sale.customer_phone || "Ingen tlf"} · {formatDate(sale.sale_datetime)}
                        </div>
                      </div>
                      {sale.enrichment_status && (
                        <Badge variant={sale.enrichment_status === "complete" ? "default" : "secondary"} className="shrink-0 text-xs">
                          {sale.enrichment_status}
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === "confirm" && selectedSale && (
          <div className="space-y-4 py-2">
            <div className="rounded-md border p-3 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">External ID</span>
                <span className="font-medium">{selectedSale.adversus_external_id || "–"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Agent</span>
                <span className="font-medium">{selectedSale.agent_name || "–"}</span>
              </div>
              {selectedSale.agent_email && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span className="text-xs">{selectedSale.agent_email}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kunde</span>
                <span className="font-medium">{selectedSale.customer_company || "–"} {selectedSale.customer_phone ? `(${selectedSale.customer_phone})` : ""}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dato</span>
                <span>{formatDate(selectedSale.sale_datetime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Enrichment</span>
                <Badge variant={selectedSale.enrichment_status === "complete" ? "default" : "secondary"}>
                  {selectedSale.enrichment_status || "–"}
                </Badge>
              </div>
              {selectedSale.internal_reference && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">OPP nr</span>
                  <span className="font-mono text-xs">{selectedSale.internal_reference}</span>
                </div>
              )}
            </div>

            {result && (
              <div className="rounded-md border p-3 text-sm space-y-1 bg-muted/30">
                <p>Status: {result.success === false ? "Fejl" : "Kørt"}</p>
                <p>Healed: {result.healed || 0}</p>
                <p>Failed: {result.failed || 0}</p>
                <p>Skipped: {result.skipped || 0}</p>
                {result.message ? <p>Besked: {result.message}</p> : null}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "search" && (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>Luk</Button>
          )}
          {step === "confirm" && (
            <>
              <Button variant="outline" onClick={() => { setStep("search"); setResult(null); setSelectedSale(null); }} disabled={isRunning}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Søg igen
              </Button>
              <Button onClick={runSync} disabled={isRunning}>
                {isRunning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Sync dette salg
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
