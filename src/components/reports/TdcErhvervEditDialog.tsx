import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
  useTdcErhvervProducts,
  useUpdateTdcErhvervOpp,
  type TdcOppGroup,
} from "@/hooks/useTdcErhvervSales";

interface EditLine {
  key: string;
  saleItemId?: string;
  saleId?: string;
  productId: string;
  quantity: number;
}

interface Props {
  group: TdcOppGroup | null;
  onOpenChange: (open: boolean) => void;
}

function ProductPicker({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (id: string) => void;
  options: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.name : "Vælg produkt"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Søg produkt..." />
          <CommandList>
            <CommandEmpty>Ingen produkter fundet.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.id}
                  value={o.name}
                  onSelect={() => {
                    onChange(o.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      o.id === value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {o.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function TdcErhvervEditDialog({ group, onOpenChange }: Props) {
  const { data: products } = useTdcErhvervProducts(!!group);
  const update = useUpdateTdcErhvervOpp();

  const [opp, setOpp] = useState("");
  const [lines, setLines] = useState<EditLine[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);

  useEffect(() => {
    if (!group) return;
    setOpp(group.opp);
    setRemoved([]);
    setLines(
      group.items.map((item) => ({
        key: item.saleItemId,
        saleItemId: item.saleItemId,
        saleId: item.saleId,
        productId: item.productId || "",
        quantity: item.quantity || 1,
      }))
    );
  }, [group]);

  const options = useMemo(() => products || [], [products]);

  const updateLine = (key: string, patch: Partial<EditLine>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const removeLine = (line: EditLine) => {
    if (line.saleItemId) setRemoved((prev) => [...prev, line.saleItemId!]);
    setLines((prev) => prev.filter((l) => l.key !== line.key));
  };

  const addLine = () =>
    setLines((prev) => [
      ...prev,
      { key: `new-${Date.now()}-${prev.length}`, productId: "", quantity: 1 },
    ]);

  const handleSubmit = async () => {
    if (!group) return;
    if (lines.length === 0) {
      toast.error("Salget skal have mindst én produktlinje – brug Slet for at fjerne salget");
      return;
    }
    if (lines.some((l) => !l.productId)) {
      toast.error("Vælg et produkt på alle linjer");
      return;
    }
    if (lines.some((l) => !Number.isFinite(l.quantity) || l.quantity < 1)) {
      toast.error("Antal skal være mindst 1");
      return;
    }

    try {
      const result = await update.mutateAsync({
        saleIds: group.saleIds,
        primarySaleId: group.saleIds[0],
        originalOpp: group.opp,
        opp,
        lines: lines.map((l) => ({
          saleItemId: l.saleItemId,
          saleId: l.saleId,
          productId: l.productId,
          quantity: l.quantity,
        })),
        removedSaleItemIds: removed,
      });

      if (result?.zeroCommission) {
        toast.warning(
          `Rettelsen er gemt, men ${result.zeroCommission} produktlinje(r) har 0 kr. i provision – tjek prisreglerne.`
        );
      } else {
        toast.success("Rettelsen er gemt");
      }
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Kunne ikke gemme rettelsen"
      );
    }
  };

  return (
    <Dialog open={!!group} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Ret salg {group?.opp || "uden OPP"}
          </DialogTitle>
          <DialogDescription>
            {group?.sellerName} – rettelsen gælder salget i hele Stork, og provision og
            omsætning genberegnes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="tdc-opp">OPP nr.</Label>
            <Input
              id="tdc-opp"
              value={opp}
              onChange={(e) => setOpp(e.target.value)}
              placeholder="OPP-1234567"
            />
          </div>

          <div className="space-y-2">
            <Label>Produkter</Label>
            <div className="space-y-2">
              {lines.map((line) => (
                <div key={line.key} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <ProductPicker
                      value={line.productId}
                      onChange={(id) => updateLine(line.key, { productId: id })}
                      options={options}
                    />
                  </div>
                  <Input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) =>
                      updateLine(line.key, { quantity: Number(e.target.value) })
                    }
                    className="w-20 text-right tabular-nums"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLine(line)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    aria-label="Slet produktlinje"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {lines.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Ingen produktlinjer – tilføj mindst én.
                </p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={addLine} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Tilføj produkt
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={update.isPending}
          >
            Annuller
          </Button>
          <Button onClick={handleSubmit} disabled={update.isPending}>
            {update.isPending ? "Gemmer..." : "Bekræft rettelse"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
