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
import { Link2, ChevronLeft, ChevronRight, Sparkles, Check } from "lucide-react";

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
  product_id: string | null;
}

interface Props {
  campaignMappings: CampaignMapping[];
  products: Product[];
  onMappingChange: (mappingId: string, productId: string) => void;
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

function findSuggestedProduct(campaignName: string, products: Product[]): { product: Product; confidence: number } | null {
  let bestMatch: { product: Product; confidence: number } | null = null;
  
  for (const product of products) {
    if (!product.is_active) continue;
    
    // Check name similarity
    const nameSim = calculateSimilarity(campaignName, product.name);
    // Check code similarity
    const codeSim = calculateSimilarity(campaignName, product.code);
    
    const confidence = Math.max(nameSim, codeSim);
    
    if (confidence >= 0.5 && (!bestMatch || confidence > bestMatch.confidence)) {
      bestMatch = { product, confidence };
    }
  }
  
  return bestMatch;
}

export function CampaignMappingSection({ campaignMappings, products, onMappingChange }: Props) {
  const [currentPage, setCurrentPage] = useState(1);
  const [showOnlyUnmapped, setShowOnlyUnmapped] = useState(false);

  // Add suggestions to mappings
  const mappingsWithSuggestions = useMemo(() => {
    return campaignMappings.map(mapping => ({
      ...mapping,
      suggestion: !mapping.product_id ? findSuggestedProduct(mapping.adversus_campaign_name, products) : null
    }));
  }, [campaignMappings, products]);

  // Filter and group
  const filteredMappings = useMemo(() => {
    let filtered = mappingsWithSuggestions;
    if (showOnlyUnmapped) {
      filtered = filtered.filter(m => !m.product_id);
    }
    return filtered;
  }, [mappingsWithSuggestions, showOnlyUnmapped]);

  // Split into mapped and unmapped
  const mappedCampaigns = filteredMappings.filter(m => m.product_id);
  const unmappedCampaigns = filteredMappings.filter(m => !m.product_id);
  
  // Sort unmapped: suggestions first
  const sortedUnmapped = [...unmappedCampaigns].sort((a, b) => {
    if (a.suggestion && !b.suggestion) return -1;
    if (!a.suggestion && b.suggestion) return 1;
    if (a.suggestion && b.suggestion) return b.suggestion.confidence - a.suggestion.confidence;
    return 0;
  });

  const totalPages = Math.ceil(filteredMappings.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;

  // Combine: unmapped first (with suggestions at top), then mapped
  const displayOrder = [...sortedUnmapped, ...mappedCampaigns];
  const paginatedMappings = displayOrder.slice(startIndex, endIndex);

  const stats = {
    total: campaignMappings.length,
    mapped: mappedCampaigns.length,
    unmapped: unmappedCampaigns.length,
    withSuggestions: sortedUnmapped.filter(m => m.suggestion && m.suggestion.confidence >= 0.8).length
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
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1.5">
            <span className="font-normal text-muted-foreground">Total:</span> {stats.total}
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

      {/* Unmapped with Suggestions Section */}
      {!showOnlyUnmapped && stats.withSuggestions > 0 && currentPage === 1 && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-medium text-foreground">Foreslåede mappings</h3>
            <span className="text-xs text-muted-foreground">
              (baseret på navnesammenligning)
            </span>
          </div>
          <div className="space-y-2">
            {sortedUnmapped
              .filter(m => m.suggestion && m.suggestion.confidence >= 0.8)
              .slice(0, 5)
              .map(mapping => (
                <div 
                  key={mapping.id}
                  className="flex items-center justify-between gap-4 p-3 rounded-md bg-background border border-border"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {mapping.adversus_campaign_name}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      ID: {mapping.adversus_campaign_id}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">→</span>
                    <Badge variant="secondary" className="gap-1">
                      <Sparkles className="h-3 w-3" />
                      {mapping.suggestion!.product.name}
                    </Badge>
                    <Button
                      size="sm"
                      onClick={() => onMappingChange(mapping.id, mapping.suggestion!.product.id)}
                    >
                      Godkend
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent bg-muted/30">
              <TableHead className="text-muted-foreground">Kampagne</TableHead>
              <TableHead className="text-muted-foreground w-24">ID</TableHead>
              <TableHead className="text-muted-foreground w-[280px]">Produkt</TableHead>
              <TableHead className="text-muted-foreground w-24">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedMappings.map((mapping) => (
              <TableRow key={mapping.id} className="border-border">
                <TableCell>
                  <p className="font-medium text-foreground">
                    {mapping.adversus_campaign_name}
                  </p>
                </TableCell>
                <TableCell className="text-muted-foreground font-mono text-xs">
                  {mapping.adversus_campaign_id}
                </TableCell>
                <TableCell>
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
                      {mapping.suggestion && (
                        <SelectItem value={mapping.suggestion.product.id}>
                          <span className="flex items-center gap-2">
                            <Sparkles className="h-3 w-3 text-primary" />
                            {mapping.suggestion.product.name} (foreslået)
                          </span>
                        </SelectItem>
                      )}
                      {products.filter(p => p.is_active && p.id !== mapping.suggestion?.product.id).map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} ({product.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  {mapping.product_id ? (
                    <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
                      <Check className="h-3 w-3 mr-1" />
                      Mappet
                    </Badge>
                  ) : mapping.suggestion ? (
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
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Viser {startIndex + 1}-{Math.min(endIndex, filteredMappings.length)} af {filteredMappings.length} kampagner
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
