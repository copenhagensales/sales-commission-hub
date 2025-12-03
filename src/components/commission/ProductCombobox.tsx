import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

interface Product {
  id: string;
  name: string;
}

interface ProductComboboxProps {
  products: Product[];
  value: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  allowNone?: boolean;
  className?: string;
  outcomeHint?: string | null; // Used to suggest a product
}

// Find best matching product based on outcome text
function findSuggestedProduct(outcome: string | null | undefined, products: Product[]): Product | null {
  if (!outcome || !products.length) return null;
  const outcomeLower = outcome.toLowerCase();
  
  // Score each product based on match quality
  let bestMatch: Product | null = null;
  let bestScore = 0;
  
  for (const product of products) {
    const productNameLower = product.name.toLowerCase();
    let score = 0;
    
    // Exact match
    if (outcomeLower === productNameLower) {
      score = 100;
    }
    // Outcome contains full product name
    else if (outcomeLower.includes(productNameLower)) {
      score = 80;
    }
    // Product name contains full outcome
    else if (productNameLower.includes(outcomeLower)) {
      score = 70;
    }
    // Check word matches
    else {
      const outcomeWords = outcomeLower.split(/[\s\-_]+/).filter(w => w.length > 2);
      const productWords = productNameLower.split(/[\s\-_]+/).filter(w => w.length > 2);
      
      for (const outcomeWord of outcomeWords) {
        for (const productWord of productWords) {
          if (outcomeWord === productWord) {
            score += 20;
          } else if (productWord.includes(outcomeWord) || outcomeWord.includes(productWord)) {
            score += 10;
          }
        }
      }
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = product;
    }
  }
  
  // Only return if we have a reasonable match
  return bestScore >= 10 ? bestMatch : null;
}

export function ProductCombobox({
  products,
  value,
  onValueChange,
  placeholder = "Vælg produkt...",
  allowNone = true,
  className,
  outcomeHint,
}: ProductComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const suggestedProduct = useMemo(() => 
    findSuggestedProduct(outcomeHint, products),
    [outcomeHint, products]
  );

  const filteredProducts = useMemo(() => {
    if (!search) return products;
    const searchLower = search.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(searchLower));
  }, [products, search]);

  // Remove suggested from main list to avoid duplicate
  const otherProducts = useMemo(() => {
    if (!suggestedProduct) return filteredProducts;
    return filteredProducts.filter(p => p.id !== suggestedProduct.id);
  }, [filteredProducts, suggestedProduct]);

  const selectedProduct = products.find(p => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          <span className="truncate">
            {selectedProduct?.name || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0 z-50" align="start">
        <Command>
          <CommandInput 
            placeholder="Søg efter produkt..." 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>Ingen produkter fundet.</CommandEmpty>
            
            {/* Suggested product based on outcome */}
            {suggestedProduct && !search && (
              <CommandGroup heading="Forslag">
                <CommandItem
                  value={`suggested-${suggestedProduct.name}`}
                  onSelect={() => {
                    onValueChange(suggestedProduct.id);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="bg-primary/5"
                >
                  <Sparkles className={cn(
                    "mr-2 h-4 w-4 text-primary",
                    value === suggestedProduct.id ? "opacity-0" : "opacity-100"
                  )} />
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 absolute left-2",
                      value === suggestedProduct.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="font-medium">{suggestedProduct.name}</span>
                </CommandItem>
              </CommandGroup>
            )}
            
            <CommandGroup heading={suggestedProduct && !search ? "Alle produkter" : undefined}>
              {allowNone && (
                <CommandItem
                  value="__none__"
                  onSelect={() => {
                    onValueChange(null);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      !value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="text-muted-foreground">Ingen produkt</span>
                </CommandItem>
              )}
              {otherProducts.map((product) => (
                <CommandItem
                  key={product.id}
                  value={product.name}
                  onSelect={() => {
                    onValueChange(product.id);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === product.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {product.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}