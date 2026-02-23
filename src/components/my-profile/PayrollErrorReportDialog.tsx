import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const CATEGORIES = [
  { value: "Provision", label: "Provision" },
  { value: "Vagt", label: "Vagt" },
  { value: "Diet", label: "Diet" },
  { value: "Dagsbonus", label: "Dagsbonus" },
  { value: "Feriepenge", label: "Feriepenge" },
  { value: "Andet", label: "Andet" },
];

interface Props {
  employeeId: string;
  payrollPeriodStart: Date;
  payrollPeriodEnd: Date;
}

export function PayrollErrorReportDialog({ employeeId, payrollPeriodStart, payrollPeriodEnd }: Props) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!category || !description.trim()) return;
    setSubmitting(true);

    const startStr = payrollPeriodStart.toISOString().split("T")[0];
    const endStr = payrollPeriodEnd.toISOString().split("T")[0];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("payroll_error_reports")
      .insert({
        employee_id: employeeId,
        payroll_period_start: startStr,
        payroll_period_end: endStr,
        category,
        description: description.trim(),
      });

    setSubmitting(false);

    if (error) {
      toast({ title: "Fejl", description: "Kunne ikke sende indberetning. Prøv igen.", variant: "destructive" });
      return;
    }

    toast({ title: "Indberetning sendt", description: "Din fejlindberetning er modtaget." });
    setCategory("");
    setDescription("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <AlertTriangle className="h-4 w-4" />
          Indberet fejl
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Indberet lønfejl</DialogTitle>
          <DialogDescription>
            Beskriv den fejl du har fundet i din løn for denne periode.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="category">Kategori</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Vælg kategori" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Beskrivelse</Label>
            <Textarea
              id="description"
              placeholder="Forklar fejlen..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={submitting || !category || !description.trim()}>
            {submitting ? "Sender..." : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
