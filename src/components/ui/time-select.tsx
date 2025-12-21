import { useState, useRef, useEffect } from "react";
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

// Validate time format (HH:MM)
const isValidTime = (time: string): boolean => {
  const regex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
  return regex.test(time);
};

// Format time to HH:MM
const formatTimeInput = (input: string): string => {
  // Remove non-digit and non-colon characters
  let cleaned = input.replace(/[^\d:]/g, "");
  
  // Auto-add colon after 2 digits if not present
  if (cleaned.length >= 2 && !cleaned.includes(":")) {
    cleaned = cleaned.slice(0, 2) + ":" + cleaned.slice(2);
  }
  
  // Limit to 5 characters (HH:MM)
  return cleaned.slice(0, 5);
};

export function TimeSelect({ value, onChange, placeholder = "Vælg tid", className }: TimeSelectProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatTimeInput(e.target.value);
    setInputValue(formatted);
    
    if (isValidTime(formatted)) {
      onChange(formatted);
    }
  };

  const handleInputBlur = () => {
    // On blur, validate and format
    if (inputValue && isValidTime(inputValue)) {
      // Ensure proper format (pad with zeros)
      const [h, m] = inputValue.split(":");
      const formatted = `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
      setInputValue(formatted);
      onChange(formatted);
    } else if (inputValue && !isValidTime(inputValue)) {
      // Reset to previous valid value
      setInputValue(value || "");
    }
  };

  const handleOptionClick = (time: string) => {
    setInputValue(time);
    onChange(time);
    setOpen(false);
  };

  // Filter options based on input
  const filteredOptions = inputValue
    ? timeOptions.filter((t) => t.startsWith(inputValue.split(":")[0] || ""))
    : timeOptions;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className={cn("relative", className)}>
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="pl-9 pr-8"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-full w-8 hover:bg-transparent"
            onClick={() => setOpen(!open)}
          >
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
          </Button>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[120px] p-0" align="start">
        <ScrollArea className="h-60">
          <div className="p-1">
            {filteredOptions.map((time) => (
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
  );
}
