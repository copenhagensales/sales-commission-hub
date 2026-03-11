import { useState } from "react";
import { useCandidateSources } from "@/hooks/useCandidateSources";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CandidateSourceSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function CandidateSourceSelect({
  value,
  onValueChange,
  placeholder = "Vælg kilde...",
  className,
}: CandidateSourceSelectProps) {
  const { sources, addSourceMutation } = useCandidateSources();
  const [showAddNew, setShowAddNew] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  const handleAddNew = async () => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    if (sources.some((s) => s.label.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Denne kilde findes allerede");
      return;
    }
    try {
      const result = await addSourceMutation.mutateAsync(trimmed);
      onValueChange(result.label);
      setNewLabel("");
      setShowAddNew(false);
    } catch {
      toast.error("Kunne ikke tilføje kilde");
    }
  };

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="bg-popover border-border">
        {sources.map((source) => (
          <SelectItem key={source.id} value={source.label}>
            {source.label}
          </SelectItem>
        ))}
        <div className="border-t border-border mt-1 pt-1 px-1">
          {showAddNew ? (
            <div className="flex items-center gap-1 p-1">
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Ny kilde..."
                className="h-7 text-xs"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddNew();
                  }
                  if (e.key === "Escape") setShowAddNew(false);
                }}
              />
              <Button
                size="sm"
                className="h-7 px-2"
                onClick={handleAddNew}
                disabled={addSourceMutation.isPending}
              >
                {addSourceMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Plus className="h-3 w-3" />
                )}
              </Button>
            </div>
          ) : (
            <button
              className="w-full text-left text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 flex items-center gap-1"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowAddNew(true);
              }}
            >
              <Plus className="h-3 w-3" />
              Tilføj ny kilde
            </button>
          )}
        </div>
      </SelectContent>
    </Select>
  );
}
