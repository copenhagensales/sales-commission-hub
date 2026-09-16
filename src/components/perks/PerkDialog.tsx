import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  useCreatePerk,
  useUpdatePerk,
  type EmployeePerk,
  type PerkRedemptionType,
} from "@/hooks/useEmployeePerks";

interface PerkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  perk?: EmployeePerk | null;
}

export function PerkDialog({ open, onOpenChange, perk }: PerkDialogProps) {
  const { toast } = useToast();
  const createPerk = useCreatePerk();
  const updatePerk = useUpdatePerk();

  const [partnerName, setPartnerName] = useState("");
  const [description, setDescription] = useState("");
  const [redemptionType, setRedemptionType] = useState<PerkRedemptionType>("online");
  const [discountValue, setDiscountValue] = useState("");
  const [address, setAddress] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);

  useEffect(() => {
    if (!open) return;
    setPartnerName(perk?.partner_name ?? "");
    setDescription(perk?.description ?? "");
    setRedemptionType(perk?.redemption_type ?? "online");
    setDiscountValue(perk?.discount_value ?? "");
    setAddress(perk?.address ?? "");
    setDiscountCode(perk?.discount_code ?? "");
    setLinkUrl(perk?.link_url ?? "");
    setIsActive(perk?.is_active ?? true);
    setSortOrder(perk?.sort_order ?? 0);
  }, [open, perk]);

  const isSaving = createPerk.isPending || updatePerk.isPending;

  const handleSave = async () => {
    if (!partnerName.trim()) {
      toast({ title: "Udfyld partner", description: "Partnerens navn skal angives.", variant: "destructive" });
      return;
    }

    const payload = {
      partner_name: partnerName.trim(),
      description: description.trim() || null,
      redemption_type: redemptionType,
      discount_value: discountValue.trim() || null,
      address: redemptionType === "online" ? null : address.trim() || null,
      discount_code: discountCode.trim() || null,
      link_url: linkUrl.trim() || null,
      is_active: isActive,
      sort_order: sortOrder,
    };

    try {
      if (perk) {
        await updatePerk.mutateAsync({ id: perk.id, ...payload });
      } else {
        await createPerk.mutateAsync(payload);
      }
      toast({ title: perk ? "Aftale opdateret" : "Aftale oprettet" });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Kunne ikke gemme",
        description: error instanceof Error ? error.message : "Ukendt fejl",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{perk ? "Ret aftale" : "Tilføj aftale"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="perk-partner">Partner</Label>
            <Input
              id="perk-partner"
              value={partnerName}
              onChange={(e) => setPartnerName(e.target.value)}
              placeholder="Fx Suit Club"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="perk-description">Beskrivelse</Label>
            <Textarea
              id="perk-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Hvad giver aftalen, og hvordan bruges den?"
            />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={redemptionType} onValueChange={(v) => setRedemptionType(v as PerkRedemptionType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="fysisk">Fysisk</SelectItem>
                <SelectItem value="begge">Begge</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="perk-discount">Rabatsats</Label>
            <Input
              id="perk-discount"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              placeholder="Fx 20% eller 200 kr."
            />
          </div>

          {redemptionType !== "online" && (
            <div className="space-y-2">
              <Label htmlFor="perk-address">Adresse</Label>
              <Input
                id="perk-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Fx Vesterbrogade 1, 1620 København V"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="perk-code">Rabatkode</Label>
              <Input
                id="perk-code"
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value)}
                placeholder="Valgfri"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="perk-sort">Sortering</Label>
              <Input
                id="perk-sort"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="perk-link">Link</Label>
            <Input
              id="perk-link"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="Valgfri, fx https://..."
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label htmlFor="perk-active">Aktiv</Label>
              <p className="text-xs text-muted-foreground">Inaktive aftaler er skjult for medarbejdere.</p>
            </div>
            <Switch id="perk-active" checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Annuller
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Gemmer..." : "Gem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
