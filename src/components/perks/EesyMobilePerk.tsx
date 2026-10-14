import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Smartphone, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useEesyMobileSubscriptions, useMyEesyMobileRequest, useSubmitEesyMobileRequest,
} from "@/hooks/useEesyMobileRequests";

const EMPTY = {
  subscription: "", fullName: "", street: "", houseNumber: "", postalCode: "", city: "", cpr: "", phone: "", icc: "",
};

export function EesyMobilePerk() {
  const { toast } = useToast();
  const { data: subs = [] } = useEesyMobileSubscriptions();
  const { data: mine, isLoading } = useMyEesyMobileRequest();
  const submit = useSubmitEesyMobileRequest();
  const [open, setOpen] = useState(false);
  const [customerType, setCustomerType] = useState<EesyCustomerType>("ny_kunde");
  const [form, setForm] = useState(EMPTY);
  const isNew = customerType === "ny_kunde";

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const digits = (s: string) => s.replace(/\D/g, "");
  const common =
    !!form.subscription && form.fullName.trim().length >= 2 &&
    digits(form.cpr).length === 10 && digits(form.phone).length === 8;
  const valid = isNew
    ? common && form.street.trim().length >= 2 && /^[0-9]{1,4}[A-Za-z]?([ ,.].{0,30})?$/.test(form.houseNumber.trim()) &&
      form.postalCode.length === 4 && form.city.trim().length >= 2 &&
      digits(form.icc).length >= 18 && digits(form.icc).length <= 22
    : common;

  const openAs = (t: EesyCustomerType) => { setCustomerType(t); setOpen(true); };

  const onSubmit = async () => {
    try {
      await submit.mutateAsync(form);
      setForm(EMPTY);
      setOpen(false);
      toast({ title: "Anmodning sendt", description: "Vi sender dine oplysninger videre til Eesy." });
    } catch (e) {
      toast({ title: "Kunne ikke sende", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <Card className="border-primary/40">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Smartphone className="h-5 w-5 text-primary" /> Eesy Mobil
          </CardTitle>
          <Badge variant="secondary">Nummerflytning</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xl font-bold text-primary">50%</p>
        <p className="text-sm text-muted-foreground">
          50 % rabat på et Eesy-abonnement, når du flytter dit nuværende nummer til Eesy.
          Gælder ikke nye numre. Tilbuddet gælder kun medarbejdere, ikke familie eller venner. Du kan få ét tilbud.
        </p>
        {isLoading ? null : mine ? (
          <p className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              Du har indsendt en anmodning: <b>{mine.subscription}</b>.{" "}
              {mine.status === "sendt" ? "Den er sendt videre til Eesy." : "Den afventer behandling."}
            </span>
          </p>
        ) : (
          <Button onClick={() => setOpen(true)}>Skift til Eesy</Button>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Skift til Eesy Mobil med 50 % rabat</DialogTitle>
            <DialogDescription>
              Dine oplysninger kan kun ses af ejerne. De bruges kun til oprettelsen hos Eesy, og CPR-nummer,
              ICC-nummer, adresse og telefonnummer slettes 30 dage efter, at anmodningen er sendt videre.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Abonnement</Label>
              <RadioGroup value={form.subscription} onValueChange={(v) => setForm((f) => ({ ...f, subscription: v }))}>
                {subs.map((s) => (
                  <label key={s} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm">
                    <RadioGroupItem value={s} /> {s}
                  </label>
                ))}
              </RadioGroup>
            </div>
            <div className="space-y-1"><Label htmlFor="ee-name">Fulde navn</Label><Input id="ee-name" value={form.fullName} onChange={set("fullName")} maxLength={120} /></div>
            {isNew && (
              <div className="grid grid-cols-4 gap-2">
                <div className="col-span-3 space-y-1"><Label htmlFor="ee-street">Vejnavn</Label><Input id="ee-street" value={form.street} onChange={set("street")} maxLength={120} autoComplete="address-line1" /></div>
                <div className="space-y-1"><Label htmlFor="ee-no">Nr.</Label><Input id="ee-no" value={form.houseNumber} onChange={set("houseNumber")} maxLength={20} placeholder="12B" /></div>
                <div className="space-y-1"><Label htmlFor="ee-pc">Postnr.</Label><Input id="ee-pc" value={form.postalCode} onChange={(e) => setForm((f) => ({ ...f, postalCode: digits(e.target.value).slice(0, 4) }))} inputMode="numeric" maxLength={4} autoComplete="postal-code" /></div>
                <div className="col-span-3 space-y-1"><Label htmlFor="ee-city">By</Label><Input id="ee-city" value={form.city} onChange={set("city")} maxLength={60} autoComplete="address-level2" /></div>
              </div>
            )}
            <div className="space-y-1"><Label htmlFor="ee-cpr">CPR-nummer</Label><Input id="ee-cpr" value={form.cpr} onChange={set("cpr")} inputMode="numeric" placeholder="DDMMÅÅ-XXXX" autoComplete="off" maxLength={11} /></div>
            <div className="space-y-1"><Label htmlFor="ee-phone">{isNew ? "Nuværende telefonnummer (som skal flyttes)" : "Dit Eesy-telefonnummer"}</Label><Input id="ee-phone" value={form.phone} onChange={set("phone")} inputMode="numeric" maxLength={11} /></div>
            {isNew && (
              <div className="space-y-1"><Label htmlFor="ee-icc">ICC-nummer (står på SIM-kortet)</Label><Input id="ee-icc" value={form.icc} onChange={set("icc")} inputMode="numeric" autoComplete="off" maxLength={26} /></div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annullér</Button>
            <Button onClick={onSubmit} disabled={!valid || submit.isPending}>Send anmodning</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
