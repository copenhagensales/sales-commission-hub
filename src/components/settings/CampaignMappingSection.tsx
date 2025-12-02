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
import { Badge } from "@/components/ui/badge";
import { Link2, ChevronLeft, ChevronRight, Sparkles, Check, Zap } from "lucide-react";

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
}

const ITEMS_PER_PAGE = 10;

// Function to calculate similarity between two strings (simple)
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().replace(/[^a-z0-9æøå]/g, '');
  const s2 = str2.toLowerCase().replace(/[^a-z0-9æøå]/g, '');
  
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;
  
  // Check for word matches
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
  
  // Combine campaign name and outcome for matching
  const searchString = outcome ? `${campaignName} ${outcome}` : campaignName;
  
  for (const product of products) {
    if (!product.is_active) continue;
    
    // Check name similarity
    const nameSim = calculateSimilarity(searchString, product.name);
    // Check code similarity
    const codeSim = calculateSimilarity(searchString, product.code);
    
    const confidence = Math.max(nameSim, codeSim);
    
    if (confidence >= 0.5 && (!bestMatch || confidence > bestMatch.confidence)) {
      bestMatch = { product, confidence };
    }
  }
  
  return bestMatch;
}

// Group mappings by campaign
function groupByCampaign(mappings: CampaignMapping[]) {
  const groups = new Map<string, CampaignMapping[]>();
  
  for (const mapping of mappings) {
    const key = mapping.adversus_campaign_id;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(mapping);
  }
  
  return groups;
}

export function CampaignMappingSection({ campaignMappings, products, onMappingChange, onBulkApprove }: Props) {
  const [currentPage, setCurrentPage] = useState(1);
  const [showOnlyUnmapped, setShowOnlyUnmapped] = useState(false);

  // Add suggestions to mappings
  const mappingsWithSuggestions = useMemo(() => {
    return campaignMappings.map(mapping => ({
      ...mapping,
      suggestion: !mapping.product_id ? findSuggestedProduct(mapping.adversus_campaign_name, mapping.adversus_outcome, products) : null
    }));
  }, [campaignMappings, products]);

  // Filter
  const filteredMappings = useMemo(() => {
    let filtered = mappingsWithSuggestions;
    if (showOnlyUnmapped) {
      filtered = filtered.filter(m => !m.product_id);
    }
    return filtered;
  }, [mappingsWithSuggestions, showOnlyUnmapped]);

  // Group by campaign for display
  const groupedMappings = useMemo(() => groupByCampaign(filteredMappings), [filteredMappings]);
  const campaignIds = Array.from(groupedMappings.keys());
  
  // Pagination by campaign groups
  const totalPages = Math.ceil(campaignIds.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedCampaignIds = campaignIds.slice(startIndex, endIndex);

  // Stats
  const mappedCount = campaignMappings.filter(m => m.product_id).length;
  const unmappedCount = campaignMappings.filter(m => !m.product_id).length;
  const withSuggestions = mappingsWithSuggestions.filter(m => !m.product_id && m.suggestion && m.suggestion.confidence >= 0.8);

  const stats = {
    total: campaignMappings.length,
    campaigns: new Set(campaignMappings.map(m => m.adversus_campaign_id)).size,
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
            <span className="font-normal text-muted-foreground">Kampagner:</span> {stats.campaigns}
          </Badge>
          <Badge variant="outline" className="gap-1.5">
            <span className="font-normal text-muted-foreground">Kombinationer:</span> {stats.total}
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
            <Button
              size="sm"
              onClick={handleBulkApprove}
              className="gap-2"
            >
              <Zap className="h-4 w-4" />
              Godkend alle forslag ({stats.withSuggestions})
            </Button>
          )}
          <Button
            variant={showOnlyUnmapped ? "secondary" : "outline"}
            size="sm"
            onClick={() => {
              setShowOnlyUnmapped(!showOnlyUnmapped);
              setCurrentPage(1);
            }}
          >
            {showOnlyUnmapped ? "Vis alle" : "Vis kun umappede"}
          </Button>
        </div>
      </div>

      {/* Campaigns grouped with outcomes */}
      <div className="space-y-4">
        {paginatedCampaignIds.map(campaignId => {
          const mappings = groupedMappings.get(campaignId)!;
          const campaignName = mappings[0].adversus_campaign_name;
          const hasMultipleOutcomes = mappings.length > 1 || mappings.some(m => m.adversus_outcome);
          
          return (
            <div key={campaignId} className="rounded-lg border border-border overflow-hidden">
              {/* Campaign Header */}
              <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="font-medium text-foreground">{campaignName}</h3>
                  <span className="text-xs text-muted-foreground font-mono">ID: {campaignId}</span>
                </div>
                {hasMultipleOutcomes && (
                  <Badge variant="outline" className="text-xs">
                    {mappings.length} afslutningskode{mappings.length !== 1 ? 'r' : ''}
                  </Badge>
                )}
              </div>
              
              {/* Outcomes/Mappings */}
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Afslutningskode</TableHead>
                    <TableHead className="text-muted-foreground w-[300px]">Produkt</TableHead>
                    <TableHead className="text-muted-foreground w-24">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappings.map((mapping) => {
                    const mappingWithSuggestion = mappingsWithSuggestions.find(m => m.id === mapping.id);
                    const suggestion = mappingWithSuggestion?.suggestion;
                    
                    return (
                      <TableRow key={mapping.id} className="border-border">
                        <TableCell>
                          {mapping.adversus_outcome ? (
                            <span className="font-medium text-foreground">{mapping.adversus_outcome}</span>
                          ) : (
                            <span className="text-muted-foreground italic">(ingen afslutningskode)</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Select
                              value={mapping.product_id || 'none'}
                              onValueChange={(value) => onMappingChange(mapping.id, value)}
                            >
                              <SelectTrigger className="w-full">
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
                                    {product.name} ({product.code})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {suggestion && suggestion.confidence >= 0.8 && !mapping.product_id && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="shrink-0"
                                onClick={() => onMappingChange(mapping.id, suggestion.product.id)}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {mapping.product_id ? (
                            <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
                              <Check className="h-3 w-3 mr-1" />
                              Mappet
                            </Badge>
                          ) : suggestion ? (
                            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                              <Sparkles className="h-3 w-3 mr-1" />
                              Forslag
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
                              Mangler
                            </Badge>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Viser {startIndex + 1}-{Math.min(endIndex, campaignIds.length)} af {campaignIds.length} kampagner
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Forrige
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "ghost"}
                    size="sm"
                    className="w-8 h-8 p-0"
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Næste
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
