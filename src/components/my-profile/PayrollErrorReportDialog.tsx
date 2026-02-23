import { useState } from "react";
import { AlertTriangle, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { value: "Provision", label: "Provision" },
  { value: "Vagt", label: "Vagt" },
  { value: "Diet", label: "Diet" },
  { value: "Dagsbonus", label: "Dagsbonus" },
  { value: "Feriepenge", label: "Feriepenge" },
  { value: "Andet", label: "Andet" },
];

const MIN_DESC_LENGTH = 30;

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
  const [attempted, setAttempted] = useState(false);

  const [isRange, setIsRange] = useState(false);
  const [errorDateStart, setErrorDateStart] = useState<Date | undefined>();
  const [errorDateEnd, setErrorDateEnd] = useState<Date | undefined>();

  const categoryValid = category !== "";
  const dateValid = !!errorDateStart;
  const descValid = description.trim().length >= MIN_DESC_LENGTH;
  const allValid = categoryValid && dateValid && descValid;

  const handleSubmit = async () => {
    setAttempted(true);
    if (!allValid) return;
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
        error_date_start: errorDateStart ? format(errorDateStart, "yyyy-MM-dd") : null,
        error_date_end: isRange && errorDateEnd ? format(errorDateEnd, "yyyy-MM-dd") : null,
      });

    setSubmitting(false);

    if (error) {
      toast({ title: "Fejl", description: "Kunne ikke sende indberetning. Prøv igen.", variant: "destructive" });
      return;
    }

    toast({ title: "Indberetning sendt", description: "Din fejlindberetning er modtaget." });
    setCategory("");
    setDescription("");
    setErrorDateStart(undefined);
    setErrorDateEnd(undefined);
    setIsRange(false);
    setAttempted(false);
    setOpen(false);
  };

  const disableDate = (date: Date) =>
    date < payrollPeriodStart || date > payrollPeriodEnd;

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
          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Kategori <span className="text-destructive">*</span></Label>
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
            {attempted && !categoryValid && (
              <p className="text-sm text-destructive">Vælg en kategori</p>
            )}
          </div>

          {/* Date picker */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Dato <span className="text-destructive">*</span></Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Periode</span>
                <Switch checked={isRange} onCheckedChange={(v) => { setIsRange(v); setErrorDateEnd(undefined); }} />
              </div>
            </div>

            <div className={cn("flex gap-2", isRange ? "flex-row" : "")}>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("justify-start text-left font-normal flex-1", !errorDateStart && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {errorDateStart ? format(errorDateStart, "d. MMM yyyy", { locale: da }) : (isRange ? "Fra dato" : "Vælg dato")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={errorDateStart}
                    onSelect={setErrorDateStart}
                    disabled={disableDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>

              {isRange && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("justify-start text-left font-normal flex-1", !errorDateEnd && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {errorDateEnd ? format(errorDateEnd, "d. MMM yyyy", { locale: da }) : "Til dato"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={errorDateEnd}
                      onSelect={setErrorDateEnd}
                      disabled={(d) => disableDate(d) || (errorDateStart ? d < errorDateStart : false)}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>
            {attempted && !dateValid && (
              <p className="text-sm text-destructive">Vælg en dato</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Beskrivelse <span className="text-destructive">*</span></Label>
            <Textarea
              id="description"
              placeholder="Forklar fejlen (minimum 30 tegn)..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
            <p className={cn("text-xs", attempted && !descValid ? "text-destructive" : "text-muted-foreground")}>
              {description.trim().length}/{MIN_DESC_LENGTH} tegn (minimum)
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Sender..." : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
