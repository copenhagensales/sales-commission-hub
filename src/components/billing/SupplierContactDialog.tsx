import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface SupplierContact {
  id?: string;
  location_type: string;
  name: string;
  email: string;
  phone: string | null;
  role: string | null;
  is_primary: boolean;
  is_active: boolean;
}

interface SupplierContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: SupplierContact | null;
  locationType: string;
  onSave: (contact: Omit<SupplierContact, "id">) => void;
  isPending: boolean;
}

export function SupplierContactDialog({
  open,
  onOpenChange,
  contact,
  locationType,
  onSave,
  isPending,
}: SupplierContactDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);

  useEffect(() => {
    if (contact) {
      setName(contact.name);
      setEmail(contact.email);
      setPhone(contact.phone || "");
      setRole(contact.role || "");
      setIsPrimary(contact.is_primary);
    } else {
      setName("");
      setEmail("");
      setPhone("");
      setRole("");
      setIsPrimary(false);
    }
  }, [contact, open]);

  const handleSubmit = () => {
    if (!name || !email) return;
    onSave({
      location_type: locationType,
      name,
      email,
      phone: phone || null,
      role: role || null,
      is_primary: isPrimary,
      is_active: true,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {contact ? "Rediger kontaktperson" : "Tilføj kontaktperson"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Navn *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Kontaktpersonens navn" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail *</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@eksempel.dk" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Telefon</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+45 12 34 56 78" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Rolle/stilling</Label>
            <Input id="role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="F.eks. Økonomiansvarlig" />
          </div>
          <div className="flex items-center gap-3">
            <Switch id="primary" checked={isPrimary} onCheckedChange={setIsPrimary} />
            <Label htmlFor="primary">Primær kontaktperson</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuller</Button>
          <Button onClick={handleSubmit} disabled={!name || !email || isPending}>
            {isPending ? "Gemmer..." : contact ? "Gem ændringer" : "Tilføj"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
