import { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimeSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

// Generate time options in 15-minute intervals
const generateTimeOptions = () => {
  const options: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const h = hour.toString().padStart(2, "0");
      const m = minute.toString().padStart(2, "0");
      options.push(`${h}:${m}`);
    }
  }
  return options;
};

const timeOptions = generateTimeOptions();

// Auto-format time input
const formatTimeInput = (input: string): string => {
  // Remove everything except digits
  const digits = input.replace(/\D/g, "");
  
  if (digits.length === 0) return "";
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  }
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
};

export function TimeSelect({ value, onChange, placeholder = "HH:MM", className }: TimeSelectProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || "");

  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const formatted = formatTimeInput(raw);
    setInputValue(formatted);
    onChange(formatted);
  };

  const handleOptionClick = (time: string) => {
    setInputValue(time);
    onChange(time);
    setOpen(false);
  };

  return (
    <div className={cn("flex gap-1", className)}>
      <div className="relative flex-1">
        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="pl-9"
        />
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[100px] p-0" align="end">
          <ScrollArea className="h-60">
            <div className="p-1">
              {timeOptions.map((time) => (
                <button
                  key={time}
                  type="button"
                  onClick={() => handleOptionClick(time)}
                  className={cn(
                    "w-full text-left px-3 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                    value === time && "bg-accent text-accent-foreground font-medium"
                  )}
                >
                  {time}
                </button>
              ))}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}
