import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ClientRow {
  id: string;
  name: string;
  logo_url: string | null;
}

interface CampaignMapping {
  id: string;
  adversus_campaign_id: string;
  adversus_campaign_name: string | null;
  client_campaign_id: string | null;
  source?: string | null;
}

interface ClientCampaignRow {
  id: string;
  name: string;
  client_id: string;
  clients: { id: string; name: string | null } | null;
}

export interface CampaignSuggestion {
  mappingId: string;
  campaignName: string;
  suggestedClientId: string;
  suggestedClientName: string;
  confidence: "Høj" | "Medium" | "Lav";
  reason: string;
}

interface CampaignSuggestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestions: CampaignSuggestion[];
  onApprove: (approved: CampaignSuggestion[]) => Promise<void>;
  isApproving: boolean;
}

export function CampaignSuggestionDialog({
  open,
  onOpenChange,
  suggestions,
  onApprove,
  isApproving,
}: CampaignSuggestionDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleAll = () => {
    if (selected.size === suggestions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(suggestions.map((s) => s.mappingId)));
    }
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApprove = async () => {
    const approved = suggestions.filter((s) => selected.has(s.mappingId));
    if (approved.length === 0) {
      toast.error("Vælg mindst ét forslag");
      return;
    }
    await onApprove(approved);
    setSelected(new Set());
  };

  const confidenceColor = (c: string) => {
    switch (c) {
      case "Høj": return "bg-green-100 text-green-800 border-green-200";
      case "Medium": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "Lav": return "bg-red-100 text-red-800 border-red-200";
      default: return "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Foreslåede kundetilknytninger
          </DialogTitle>
          <DialogDescription>
            Gennemgå forslagene og godkend dem du vil tildele. Kun afkrydsede forslag gemmes.
          </DialogDescription>
        </DialogHeader>

        {suggestions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Ingen forslag fundet – alle kampagner har allerede en kunde tilknyttet.
          </p>
        ) : (
          <>
            <div className="rounded-md border overflow-x-auto max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selected.size === suggestions.length && suggestions.length > 0}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>Kampagne</TableHead>
                    <TableHead>Foreslået kunde</TableHead>
                    <TableHead className="w-24">Konfidens</TableHead>
                    <TableHead>Begrundelse</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suggestions.map((s) => (
                    <TableRow key={s.mappingId}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(s.mappingId)}
                          onCheckedChange={() => toggle(s.mappingId)}
                        />
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {s.campaignName}
                      </TableCell>
                      <TableCell className="text-sm">
                        {s.suggestedClientName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={confidenceColor(s.confidence)}>
                          {s.confidence}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px]">
                        {s.reason}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-sm text-muted-foreground">
                {selected.size} af {suggestions.length} valgt
              </span>
              <Button
                onClick={handleApprove}
                disabled={isApproving || selected.size === 0}
              >
                {isApproving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Godkend valgte ({selected.size})
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Generate client suggestions for unmapped campaigns using multiple signals:
 * 1. Product match: Look at sale_items for the campaign, match product titles to known products/clients
 * 2. Name match: Parse client name from campaign title
 * 3. Agent overlap: Check which clients the campaign's agents typically sell for
 */
export async function generateClientSuggestions(
  campaignMappings: CampaignMapping[],
  clientCampaigns: ClientCampaignRow[],
  clients: ClientRow[],
  parseClientFromTitle: (title: string | null, clientList?: ClientRow[]) => ClientRow | null,
): Promise<CampaignSuggestion[]> {
  // Find unmapped campaigns
  const unmapped = campaignMappings.filter((m) => {
    const existingClientId = clientCampaigns.find((c) => c.id === m.client_campaign_id)?.client_id;
    return !existingClientId;
  });

  if (unmapped.length === 0) return [];

  // Build maps
  const clientMap = new Map(clients.map((c) => [c.id, c]));
  const clientCampaignToClient = new Map<string, string>();
  clientCampaigns.forEach((cc) => {
    clientCampaignToClient.set(cc.id, cc.client_id);
  });

  // Signal 1: Product match — batch fetch sale_items for unmapped campaigns
  const unmappedCampaignIds = unmapped.map((m) => m.adversus_campaign_id);

  // Get sales for unmapped campaigns
  const { data: salesData } = await supabase
    .from("sales")
    .select("id, dialer_campaign_id")
    .in("dialer_campaign_id", unmappedCampaignIds);

  const saleIdsByCampaign = new Map<string, string[]>();
  salesData?.forEach((s) => {
    if (!s.dialer_campaign_id) return;
    const arr = saleIdsByCampaign.get(s.dialer_campaign_id) || [];
    arr.push(s.id);
    saleIdsByCampaign.set(s.dialer_campaign_id, arr);
  });

  // Get all sale_items for these sales (batch)
  const allSaleIds = Array.from(saleIdsByCampaign.values()).flat();
  let saleItemsByProduct = new Map<string, Map<string, number>>(); // campaignId -> { clientId -> count }

  if (allSaleIds.length > 0) {
    // Fetch in batches of 500
    const saleItemProductTitles: { sale_id: string; adversus_product_title: string | null }[] = [];
    for (let i = 0; i < allSaleIds.length; i += 500) {
      const batch = allSaleIds.slice(i, i + 500);
      const { data: items } = await supabase
        .from("sale_items")
        .select("sale_id, adversus_product_title")
        .in("sale_id", batch);
      if (items) saleItemProductTitles.push(...items);
    }

    // Get all product mappings
    const { data: productMappings } = await supabase
      .from("adversus_product_mappings")
      .select("adversus_product_title, product_id")
      .not("product_id", "is", null);

    const titleToProductId = new Map<string, string>();
    productMappings?.forEach((pm) => {
      if (pm.adversus_product_title && pm.product_id) {
        titleToProductId.set(pm.adversus_product_title, pm.product_id);
      }
    });

    // Get all products with client_campaign_id
    const productIds = [...new Set(titleToProductId.values())];
    const productToClientCampaign = new Map<string, string>();

    if (productIds.length > 0) {
      for (let i = 0; i < productIds.length; i += 500) {
        const batch = productIds.slice(i, i + 500);
        const { data: products } = await supabase
          .from("products")
          .select("id, client_campaign_id")
          .in("id", batch)
          .not("client_campaign_id", "is", null);
        products?.forEach((p) => {
          if (p.client_campaign_id) productToClientCampaign.set(p.id, p.client_campaign_id);
        });
      }
    }

    // Build sale_id -> campaign_id reverse map
    const saleIdToCampaign = new Map<string, string>();
    saleIdsByCampaign.forEach((saleIds, campaignId) => {
      saleIds.forEach((sid) => saleIdToCampaign.set(sid, campaignId));
    });

    // Count client hits per campaign
    saleItemProductTitles.forEach((item) => {
      const campaignId = saleIdToCampaign.get(item.sale_id);
      if (!campaignId || !item.adversus_product_title) return;

      const productId = titleToProductId.get(item.adversus_product_title);
      if (!productId) return;

      const ccId = productToClientCampaign.get(productId);
      if (!ccId) return;

      const clientId = clientCampaignToClient.get(ccId);
      if (!clientId) return;

      if (!saleItemsByProduct.has(campaignId)) {
        saleItemsByProduct.set(campaignId, new Map());
      }
      const clientCounts = saleItemsByProduct.get(campaignId)!;
      clientCounts.set(clientId, (clientCounts.get(clientId) || 0) + 1);
    });
  }

  // Signal 3: Agent overlap — which agents sell in this campaign and which clients do they usually sell for?
  // Use agent_external_id as agent identifier
  const { data: agentSalesData } = await supabase
    .from("sales")
    .select("agent_external_id, client_campaign_id")
    .not("client_campaign_id", "is", null)
    .not("agent_external_id", "is", null);

  const agentClientCounts = new Map<string, Map<string, number>>();
  agentSalesData?.forEach((s: any) => {
    if (!s.agent_external_id || !s.client_campaign_id) return;
    const clientId = clientCampaignToClient.get(s.client_campaign_id);
    if (!clientId) return;
    if (!agentClientCounts.has(s.agent_external_id)) agentClientCounts.set(s.agent_external_id, new Map());
    const m = agentClientCounts.get(s.agent_external_id)!;
    m.set(clientId, (m.get(clientId) || 0) + 1);
  });

  // Get agents per unmapped campaign
  const { data: unmappedAgentSales } = await supabase
    .from("sales")
    .select("agent_external_id, dialer_campaign_id")
    .in("dialer_campaign_id", unmappedCampaignIds)
    .not("agent_external_id", "is", null);

  const agentsByCampaign = new Map<string, Set<string>>();
  (unmappedAgentSales as any[])?.forEach((s) => {
    if (!s.dialer_campaign_id || !s.agent_external_id) return;
    if (!agentsByCampaign.has(s.dialer_campaign_id)) agentsByCampaign.set(s.dialer_campaign_id, new Set());
    agentsByCampaign.get(s.dialer_campaign_id)!.add(s.agent_external_id);
  });

  // Now score each unmapped campaign
  const suggestions: CampaignSuggestion[] = [];

  for (const mapping of unmapped) {
    const scores = new Map<string, { score: number; reasons: string[] }>();

    const addScore = (clientId: string, points: number, reason: string) => {
      if (!scores.has(clientId)) scores.set(clientId, { score: 0, reasons: [] });
      const entry = scores.get(clientId)!;
      entry.score += points;
      entry.reasons.push(reason);
    };

    // Signal 1: Product match (weight: 10 per product hit)
    const productCounts = saleItemsByProduct.get(mapping.adversus_campaign_id);
    if (productCounts) {
      productCounts.forEach((count, clientId) => {
        addScore(clientId, count * 10, `${count} produkter matcher`);
      });
    }

    // Signal 2: Name match (weight: 50)
    const parsedClient = parseClientFromTitle(mapping.adversus_campaign_name, clients);
    if (parsedClient) {
      addScore(parsedClient.id, 50, "Kundenavn i kampagnetitel");
    }

    // Signal 3: Agent overlap (weight: 3 per agent-client association)
    const campaignAgents = agentsByCampaign.get(mapping.adversus_campaign_id);
    if (campaignAgents) {
      const agentClientScores = new Map<string, number>();
      campaignAgents.forEach((agentId) => {
        const clientPrefs = agentClientCounts.get(agentId);
        if (!clientPrefs) return;
        clientPrefs.forEach((count, clientId) => {
          agentClientScores.set(clientId, (agentClientScores.get(clientId) || 0) + count);
        });
      });
      agentClientScores.forEach((count, clientId) => {
        addScore(clientId, Math.min(count, 30) * 3, `${campaignAgents.size} agenter sælger typisk for denne kunde`);
      });
    }

    // Find the winner
    let bestClientId: string | null = null;
    let bestScore = 0;
    let bestReasons: string[] = [];

    scores.forEach((entry, clientId) => {
      if (entry.score > bestScore) {
        bestScore = entry.score;
        bestClientId = clientId;
        bestReasons = entry.reasons;
      }
    });

    if (bestClientId) {
      const client = clientMap.get(bestClientId);
      if (!client) continue;

      let confidence: "Høj" | "Medium" | "Lav" = "Lav";
      if (bestScore >= 50) confidence = "Høj";
      else if (bestScore >= 20) confidence = "Medium";

      suggestions.push({
        mappingId: mapping.id,
        campaignName: mapping.adversus_campaign_name || mapping.adversus_campaign_id,
        suggestedClientId: bestClientId,
        suggestedClientName: client.name,
        confidence,
        reason: bestReasons.join(", "),
      });
    }
  }

  // Sort by confidence (Høj first)
  const order = { "Høj": 0, "Medium": 1, "Lav": 2 };
  suggestions.sort((a, b) => order[a.confidence] - order[b.confidence]);

  return suggestions;
}
