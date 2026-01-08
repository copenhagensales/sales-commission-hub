import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface AddToWinbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (category: string, contactDate: Date) => void;
  isLoading?: boolean;
}

const winbackCategories = [
  { value: "ghostet", label: "Ghostet" },
  { value: "takket_nej", label: "Takket nej" },
  { value: "interesseret_i_kundeservice", label: "Interesseret i kundeservice" },
];

export function AddToWinbackDialog({ open, onOpenChange, onSave, isLoading }: AddToWinbackDialogProps) {
  const [category, setCategory] = useState<string>("");
  const [contactDate, setContactDate] = useState<Date | undefined>();

  const handleSave = () => {
    if (category && contactDate) {
      onSave(category, contactDate);
      setCategory("");
      setContactDate(undefined);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setCategory("");
      setContactDate(undefined);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tilføj til Winback</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Kategori</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Vælg kategori" />
              </SelectTrigger>
              <SelectContent>
                {winbackCategories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Kontaktdato</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !contactDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {contactDate ? format(contactDate, "PPP", { locale: da }) : "Vælg dato"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={contactDate}
                  onSelect={setContactDate}
                  locale={da}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Annuller
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!category || !contactDate || isLoading}
          >
            {isLoading ? "Gemmer..." : "Gem"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
