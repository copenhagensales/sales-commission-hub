import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown } from "lucide-react";

export interface MultiOption {
  id: string;
  label: string;
  /** Marks an option as outside the current scope (e.g. team filter excludes it).
   * Out-of-scope options are still rendered (greyed) if they are already selected,
   * so the user can deselect them. */
  outOfScope?: boolean;
}

interface MultiSelectFilterProps {
  label: string;
  options: MultiOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** Optional helper text shown above the list, e.g. "Filtreret efter teams". */
  scopeHint?: string | null;
}

export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  placeholder = "Alle",
  scopeHint = null,
}: MultiSelectFilterProps) {
  const toggle = (id: string) => {
    onChange(
      selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]
    );
  };

  // Render order: in-scope first, then out-of-scope (only if selected so user can deselect)
  const visibleOptions = useMemo(() => {
    const inScope = options.filter((o) => !o.outOfScope);
    const outOfScopeSelected = options.filter((o) => o.outOfScope && selected.includes(o.id));
    return [...inScope, ...outOfScopeSelected];
  }, [options, selected]);

  const triggerText = (() => {
    if (selected.length === 0) return placeholder;
    if (selected.length === 1) {
      return options.find((o) => o.id === selected[0])?.label ?? `${selected.length} valgt`;
    }
    return `${selected.length} valgt`;
  })();

  return (
    <div className="space-y-1.5">
      <label className="text-xs text-white/70 font-medium">{label}</label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
          >
            <span className="truncate text-left flex-1">{triggerText}</span>
            <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[290px] p-2" align="start">
          {(selected.length > 0 || scopeHint) && (
            <div className="flex justify-between items-center px-2 pb-2 mb-1 border-b gap-2">
              <span className="text-xs text-muted-foreground truncate">
                {scopeHint ?? `${selected.length} valgt`}
              </span>
              {selected.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs shrink-0"
                  onClick={() => onChange([])}
                >
                  Ryd
                </Button>
              )}
            </div>
          )}
          <div className="space-y-1 max-h-[280px] overflow-y-auto">
            {visibleOptions.length === 0 && (
              <div className="text-sm text-muted-foreground p-2">Ingen valgmuligheder</div>
            )}
            {visibleOptions.map((option) => (
              <div
                key={option.id}
                className="flex items-center space-x-3 p-2 rounded-md hover:bg-accent cursor-pointer"
                onClick={() => toggle(option.id)}
              >
                <Checkbox
                  checked={selected.includes(option.id)}
                  onCheckedChange={() => toggle(option.id)}
                />
                <span className={`text-sm ${option.outOfScope ? "text-muted-foreground italic" : ""}`}>
                  {option.label}
                  {option.outOfScope && <span className="ml-1 text-xs">(udenfor filter)</span>}
                </span>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
