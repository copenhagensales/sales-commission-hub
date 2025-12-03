import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { Badge } from "@/components/ui/badge";
import { Link2, ChevronDown, ChevronRight, Sparkles, Check, Zap, Building2, Trash2, MoveRight } from "lucide-react";

interface Product {
  id: string;
  code: string;
  name: string;
  commission_type: string;
  commission_value: number;
  is_active: boolean;
}

interface CampaignMapping {
  id: string;
  adversus_campaign_id: string;
  adversus_campaign_name: string;
  adversus_outcome: string | null;
  product_id: string | null;
}

interface Props {
  campaignMappings: CampaignMapping[];
  products: Product[];
  onMappingChange: (mappingId: string, productId: string) => void;
  onBulkApprove?: (mappings: { id: string; productId: string }[]) => void;
  onDeleteMapping?: (mappingId: string) => void;
  onBulkDelete?: (mappingIds: string[]) => void;
}

// Customer keywords for extraction and reassignment
const CUSTOMER_KEYWORDS = [
  'Codan', 'Finansforbundet', 'TDC', 'Tryg', 'Business Danmark', 
  'Eesy', 'Hiper', 'Relatel', 'YouSee', 'AKA', 'ASE', 'Min A-kasse', 'SIXT', 'Øvrige'
];

// Extract customer name from campaign name or outcome
function extractCustomerName(campaignName: string, outcome: string | null): string {
  if (outcome) {
    const outcomeMatch = outcome.match(/\s-\s([^-]+)$/);
    if (outcomeMatch) {
      return outcomeMatch[1].trim();
    }
  }
  
  const nameLower = campaignName.toLowerCase();
  
  for (const keyword of CUSTOMER_KEYWORDS) {
    if (nameLower.includes(keyword.toLowerCase())) {
      return keyword;
    }
  }
  
  const dashMatch = campaignName.match(/^([^-–]+)/);
  if (dashMatch && dashMatch[1].trim().length > 2) {
    return dashMatch[1].trim();
  }
  
  return 'Øvrige';
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().replace(/[^a-z0-9æøå]/g, '');
  const s2 = str2.toLowerCase().replace(/[^a-z0-9æøå]/g, '');
  
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;
  
  const words1 = str1.toLowerCase().split(/\s+/);
  const words2 = str2.toLowerCase().split(/\s+/);
  
  let matchCount = 0;
  for (const word of words1) {
    if (word.length > 2 && words2.some(w => w.includes(word) || word.includes(w))) {
      matchCount++;
    }
  }
  
  return matchCount / Math.max(words1.length, 1);
}

function findSuggestedProduct(campaignName: string, outcome: string | null, products: Product[]): { product: Product; confidence: number } | null {
  let bestMatch: { product: Product; confidence: number } | null = null;
  
  const searchString = outcome ? `${campaignName} ${outcome}` : campaignName;
  
  for (const product of products) {
    if (!product.is_active) continue;
    
    const nameSim = calculateSimilarity(searchString, product.name);
    const codeSim = calculateSimilarity(searchString, product.code);
    
    const confidence = Math.max(nameSim, codeSim);
    
    if (confidence >= 0.5 && (!bestMatch || confidence > bestMatch.confidence)) {
      bestMatch = { product, confidence };
    }
  }
  
  return bestMatch;
}

interface MappingWithMeta extends CampaignMapping {
  suggestion: { product: Product; confidence: number } | null;
  customerName: string;
}

export function CampaignMappingSection({ 
  campaignMappings, 
  products, 
  onMappingChange, 
  onBulkApprove,
  onDeleteMapping,
  onBulkDelete
}: Props) {
  const [showOnlyUnmapped, setShowOnlyUnmapped] = useState(false);
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [customerOverrides, setCustomerOverrides] = useState<Map<string, string>>(new Map());

  // Add suggestions and customer name to mappings
  const mappingsWithMeta = useMemo(() => {
    return campaignMappings.map(mapping => {
      const override = customerOverrides.get(mapping.adversus_campaign_id);
      return {
        ...mapping,
        suggestion: !mapping.product_id ? findSuggestedProduct(mapping.adversus_campaign_name, mapping.adversus_outcome, products) : null,
        customerName: override || extractCustomerName(mapping.adversus_campaign_name, mapping.adversus_outcome)
      };
    });
  }, [campaignMappings, products, customerOverrides]);

  // Filter
  const filteredMappings = useMemo(() => {
    let filtered = mappingsWithMeta;
    if (showOnlyUnmapped) {
      filtered = filtered.filter(m => !m.product_id);
    }
    return filtered;
  }, [mappingsWithMeta, showOnlyUnmapped]);

  // Group by customer, then by campaign
  const groupedByCustomer = useMemo(() => {
    const customerMap = new Map<string, Map<string, MappingWithMeta[]>>();
    
    for (const mapping of filteredMappings) {
      const customer = mapping.customerName;
      const campaignId = mapping.adversus_campaign_id;
      
      if (!customerMap.has(customer)) {
        customerMap.set(customer, new Map());
      }
      
      const campaignMap = customerMap.get(customer)!;
      if (!campaignMap.has(campaignId)) {
        campaignMap.set(campaignId, []);
      }
      campaignMap.get(campaignId)!.push(mapping);
    }
    
    return customerMap;
  }, [filteredMappings]);

  const customerNames = Array.from(groupedByCustomer.keys()).sort();

  // Stats
  const mappedCount = campaignMappings.filter(m => m.product_id).length;
  const unmappedCount = campaignMappings.filter(m => !m.product_id).length;
  const withSuggestions = mappingsWithMeta.filter(m => !m.product_id && m.suggestion && m.suggestion.confidence >= 0.8);

  const stats = {
    total: campaignMappings.length,
    campaigns: new Set(campaignMappings.map(m => m.adversus_campaign_id)).size,
    customers: customerNames.length,
    mapped: mappedCount,
    unmapped: unmappedCount,
    withSuggestions: withSuggestions.length
  };

  const handleBulkApprove = () => {
    if (onBulkApprove && withSuggestions.length > 0) {
      const mappingsToApprove = withSuggestions.map(m => ({
        id: m.id,
        productId: m.suggestion!.product.id
      }));
      onBulkApprove(mappingsToApprove);
    }
  };

  const toggleCustomer = (customer: string) => {
    const newExpanded = new Set(expandedCustomers);
    if (newExpanded.has(customer)) {
      newExpanded.delete(customer);
    } else {
      newExpanded.add(customer);
    }
    setExpandedCustomers(newExpanded);
  };

  const expandAll = () => setExpandedCustomers(new Set(customerNames));
  const collapseAll = () => setExpandedCustomers(new Set());

  const moveCampaignToCustomer = (campaignId: string, newCustomer: string) => {
    setCustomerOverrides(prev => {
      const next = new Map(prev);
      if (newCustomer === '') {
        next.delete(campaignId);
      } else {
        next.set(campaignId, newCustomer);
      }
      return next;
    });
  };

  const handleDeleteCampaign = (campaignId: string) => {
    if (!onBulkDelete) return;
    const mappingIds = campaignMappings
      .filter(m => m.adversus_campaign_id === campaignId)
      .map(m => m.id);
    onBulkDelete(mappingIds);
  };

  if (campaignMappings.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Link2 className="h-10 w-10 mx-auto mb-3 opacity-50" />
        <p>Ingen kampagner fundet.</p>
        <p className="text-sm">Kør en synkronisering for at hente kampagner fra Adversus.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="outline" className="gap-1.5">
            <Building2 className="h-3 w-3" />
            <span className="font-normal text-muted-foreground">Kunder:</span> {stats.customers}
          </Badge>
          <Badge variant="outline" className="gap-1.5">
            <span className="font-normal text-muted-foreground">Kampagner:</span> {stats.campaigns}
          </Badge>
          <Badge variant="outline" className="gap-1.5 border-success/30 bg-success/5">
            <Check className="h-3 w-3 text-success" />
            <span className="font-normal text-muted-foreground">Mappet:</span> {stats.mapped}
          </Badge>
          <Badge variant="outline" className="gap-1.5 border-warning/30 bg-warning/5">
            <span className="font-normal text-muted-foreground">Mangler:</span> {stats.unmapped}
          </Badge>
          {stats.withSuggestions > 0 && (
            <Badge variant="outline" className="gap-1.5 border-primary/30 bg-primary/5">
              <Sparkles className="h-3 w-3 text-primary" />
              <span className="font-normal text-muted-foreground">Auto-forslag:</span> {stats.withSuggestions}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {stats.withSuggestions > 0 && onBulkApprove && (
            <Button size="sm" onClick={handleBulkApprove} className="gap-2">
              <Zap className="h-4 w-4" />
              Godkend alle forslag ({stats.withSuggestions})
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={expandAll}>Udvid alle</Button>
          <Button variant="ghost" size="sm" onClick={collapseAll}>Luk alle</Button>
          <Button
            variant={showOnlyUnmapped ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowOnlyUnmapped(!showOnlyUnmapped)}
          >
            {showOnlyUnmapped ? "Vis alle" : "Vis kun umappede"}
          </Button>
        </div>
      </div>

      {/* Customers with campaigns */}
      <div className="space-y-3">
        {customerNames.map(customer => {
          const campaignMap = groupedByCustomer.get(customer)!;
          const campaignIds = Array.from(campaignMap.keys());
          const isExpanded = expandedCustomers.has(customer);
          
          const allMappings = campaignIds.flatMap(id => campaignMap.get(id)!);
          const customerMapped = allMappings.filter(m => m.product_id).length;
          const customerTotal = allMappings.length;
          
          return (
            <Collapsible key={customer} open={isExpanded} onOpenChange={() => toggleCustomer(customer)}>
              <div className="rounded-lg border border-border overflow-hidden">
                {/* Customer Header */}
                <CollapsibleTrigger asChild>
                  <button className="w-full px-4 py-3 bg-muted/50 border-b border-border flex items-center justify-between hover:bg-muted/70 transition-colors">
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <Building2 className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold text-foreground">{customer}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {campaignIds.length} kampagne{campaignIds.length !== 1 ? 'r' : ''}
                      </Badge>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${customerMapped === customerTotal ? 'border-success/30 bg-success/10 text-success' : 'border-warning/30 bg-warning/10 text-warning'}`}
                      >
                        {customerMapped}/{customerTotal} mappet
                      </Badge>
                    </div>
                  </button>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <div className="divide-y divide-border">
                    {campaignIds.map(campaignId => {
                      const mappings = campaignMap.get(campaignId)!;
                      const campaignName = mappings[0].adversus_campaign_name;
                      
                      return (
                        <div key={campaignId} className="bg-card">
                          {/* Campaign subheader with actions */}
                          <div className="px-4 py-2 bg-muted/20 border-b border-border/50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground">{campaignName}</span>
                              <span className="text-xs text-muted-foreground font-mono">ID: {campaignId}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {/* Move to customer */}
                              <Select
                                value=""
                                onValueChange={(value) => moveCampaignToCustomer(campaignId, value)}
                              >
                                <SelectTrigger className="h-7 w-[140px] text-xs">
                                  <div className="flex items-center gap-1">
                                    <MoveRight className="h-3 w-3" />
                                    <span>Flyt til...</span>
                                  </div>
                                </SelectTrigger>
                                <SelectContent>
                                  {CUSTOMER_KEYWORDS.filter(c => c !== customer).map(c => (
                                    <SelectItem key={c} value={c} className="text-xs">
                                      {c}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              
                              {/* Delete campaign */}
                              {onBulkDelete && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Slet kampagne?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Er du sikker på at du vil slette alle {mappings.length} mappings for kampagnen "{campaignName}"?
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Annuller</AlertDialogCancel>
                                      <AlertDialogAction 
                                        onClick={() => handleDeleteCampaign(campaignId)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Slet
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                          </div>
                          
                          {/* Mappings table */}
                          <Table>
                            <TableHeader>
                              <TableRow className="border-border hover:bg-transparent">
                                <TableHead className="text-muted-foreground text-xs">Produkt/Outcome</TableHead>
                                <TableHead className="text-muted-foreground text-xs w-[280px]">Internt produkt</TableHead>
                                <TableHead className="text-muted-foreground text-xs w-24">Status</TableHead>
                                <TableHead className="text-muted-foreground text-xs w-10"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {mappings.map((mapping) => {
                                const suggestion = mapping.suggestion;
                                
                                return (
                                  <TableRow key={mapping.id} className="border-border/50 group">
                                    <TableCell className="py-2">
                                      {mapping.adversus_outcome ? (
                                        <span className="text-sm text-foreground">{mapping.adversus_outcome}</span>
                                      ) : (
                                        <span className="text-sm text-muted-foreground italic">(standard)</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="py-2">
                                      <div className="flex items-center gap-2">
                                        <Select
                                          value={mapping.product_id || 'none'}
                                          onValueChange={(value) => onMappingChange(mapping.id, value)}
                                        >
                                          <SelectTrigger className="h-8 text-xs">
                                            <SelectValue placeholder="Vælg produkt..." />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="none">
                                              <span className="text-muted-foreground">Ikke mappet</span>
                                            </SelectItem>
                                            {suggestion && (
                                              <SelectItem value={suggestion.product.id}>
                                                <span className="flex items-center gap-2">
                                                  <Sparkles className="h-3 w-3 text-primary" />
                                                  {suggestion.product.name} (foreslået)
                                                </span>
                                              </SelectItem>
                                            )}
                                            {products.filter(p => p.is_active && p.id !== suggestion?.product.id).map((product) => (
                                              <SelectItem key={product.id} value={product.id}>
                                                {product.name}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        {suggestion && suggestion.confidence >= 0.8 && !mapping.product_id && (
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 w-8 p-0 shrink-0"
                                            onClick={() => onMappingChange(mapping.id, suggestion.product.id)}
                                          >
                                            <Check className="h-3 w-3" />
                                          </Button>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="py-2">
                                      {mapping.product_id ? (
                                        <Badge variant="outline" className="text-xs border-success/30 bg-success/10 text-success">
                                          <Check className="h-2.5 w-2.5 mr-1" />
                                          OK
                                        </Badge>
                                      ) : suggestion ? (
                                        <Badge variant="outline" className="text-xs border-primary/30 bg-primary/10 text-primary">
                                          <Sparkles className="h-2.5 w-2.5 mr-1" />
                                          Forslag
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-xs border-warning/30 bg-warning/10 text-warning">
                                          Mangler
                                        </Badge>
                                      )}
                                    </TableCell>
                                    <TableCell className="py-2">
                                      {onDeleteMapping && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                                          onClick={() => onDeleteMapping(mapping.id)}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}