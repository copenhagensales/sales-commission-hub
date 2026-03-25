import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Wand2, Check, Loader2 } from "lucide-react";

interface Product {
  id: string;
  name: string;
}

interface MatchSuggestion {
  excelName: string;
  productId: string;
  productName: string;
  score: number;
  level: "Eksakt" | "Høj" | "Medium";
}

interface ProductAutoMatchProps {
  clientId: string;
  availableExcelNames: string[];
  products: Product[];
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-zæøå0-9\s+]/g, "").replace(/\s+/g, " ").trim();
}

function findBestMatch(excelName: string, products: Product[]): MatchSuggestion | null {
  const normalized = normalize(excelName);
  if (!normalized) return null;

  // 1. Exact
  const exact = products.find(p => normalize(p.name) === normalized);
  if (exact) return { excelName, productId: exact.id, productName: exact.name, score: 1.0, level: "Eksakt" };

  // 2. Substring containment
  for (const p of products) {
    const pn = normalize(p.name);
    if (pn && (normalized.includes(pn) || pn.includes(normalized))) {
      return { excelName, productId: p.id, productName: p.name, score: 0.8, level: "Høj" };
    }
  }

  // 3. Token overlap (Jaccard)
  const tokens = normalized.split(/\s+/).filter(Boolean);
  let best: { product: Product | null; score: number } = { product: null, score: 0 };
  for (const p of products) {
    const pTokens = normalize(p.name).split(/\s+/).filter(Boolean);
    const intersection = tokens.filter(t => pTokens.includes(t)).length;
    const union = new Set([...tokens, ...pTokens]).size;
    if (union === 0) continue;
    const score = intersection / union;
    if (score > best.score) best = { product: p, score };
  }
  if (best.product && best.score > 0.5) {
    return {
      excelName,
      productId: best.product.id,
      productName: best.product.name,
      score: best.score,
      level: best.score > 0.7 ? "Høj" : "Medium",
    };
  }
  return null;
}

const levelVariant: Record<string, "default" | "secondary" | "outline"> = {
  "Eksakt": "default",
  "Høj": "secondary",
  "Medium": "outline",
};

export function ProductAutoMatch({ clientId, availableExcelNames, products }: ProductAutoMatchProps) {
  const queryClient = useQueryClient();
  const [suggestions, setSuggestions] = useState<MatchSuggestion[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showSuggestions, setShowSuggestions] = useState(false);

  const runMatch = () => {
    const results: MatchSuggestion[] = [];
    for (const name of availableExcelNames) {
      const match = findBestMatch(name, products);
      if (match) results.push(match);
    }
    setSuggestions(results);
    setSelected(new Set(results.map(r => r.excelName)));
    setShowSuggestions(true);
  };

  const toggleSelect = (name: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === suggestions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(suggestions.map(s => s.excelName)));
    }
  };

  const approveMutation = useMutation({
    mutationFn: async () => {
      const toSave = suggestions.filter(s => selected.has(s.excelName));
      if (toSave.length === 0) return;
      const { error } = await supabase
        .from("cancellation_product_mappings")
        .upsert(
          toSave.map(s => ({ client_id: clientId, excel_product_name: s.excelName, product_id: s.productId })),
          { onConflict: "client_id,excel_product_name" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Godkendt", description: `${selected.size} mappings oprettet.` });
      setShowSuggestions(false);
      setSuggestions([]);
      queryClient.invalidateQueries({ queryKey: ["cancellation-product-mappings", clientId] });
    },
    onError: (err: Error) => {
      toast({ title: "Fejl", description: err.message, variant: "destructive" });
    },
  });

  if (!showSuggestions) {
    return (
      <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={runMatch} disabled={availableExcelNames.length === 0 || products.length === 0}>
        <Wand2 className="h-4 w-4" /> Auto-match
      </Button>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground space-y-2">
        <p>Ingen automatiske matches fundet.</p>
        <Button variant="ghost" size="sm" onClick={() => setShowSuggestions(false)}>Luk</Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Auto-match forslag ({suggestions.length})</h4>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowSuggestions(false)}>Annuller</Button>
          <Button size="sm" className="gap-1.5" onClick={() => approveMutation.mutate()} disabled={selected.size === 0 || approveMutation.isPending}>
            {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Godkend valgte ({selected.size})
          </Button>
        </div>
      </div>
      <div className="rounded-md border max-h-80 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={selected.size === suggestions.length} onCheckedChange={toggleAll} />
              </TableHead>
              <TableHead>Excel-produktnavn</TableHead>
              <TableHead>Foreslået internt produkt</TableHead>
              <TableHead className="w-24">Match</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suggestions.map(s => (
              <TableRow key={s.excelName} className={selected.has(s.excelName) ? "" : "opacity-50"}>
                <TableCell>
                  <Checkbox checked={selected.has(s.excelName)} onCheckedChange={() => toggleSelect(s.excelName)} />
                </TableCell>
                <TableCell className="text-xs max-w-[250px] truncate">{s.excelName}</TableCell>
                <TableCell className="text-xs font-medium max-w-[250px] truncate">{s.productName}</TableCell>
                <TableCell>
                  <Badge variant={levelVariant[s.level]}>{s.level}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
