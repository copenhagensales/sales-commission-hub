import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";

interface EditableCellProps {
  value: number | null | undefined;
  onSave: (value: number) => void;
  formatDisplay?: (value: number | null | undefined) => string;
  suffix?: string;
  disabled?: boolean;
}

export function EditableCell({ value, onSave, formatDisplay, suffix = "", disabled = false }: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = () => {
    if (disabled) return;
    setEditValue(value?.toString() || "0");
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    const numValue = parseFloat(editValue) || 0;
    if (numValue !== value) {
      onSave(numValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleBlur();
    } else if (e.key === "Escape") {
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        type="number"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="h-8 w-24"
      />
    );
  }

  const displayValue = formatDisplay ? formatDisplay(value) : (value?.toString() || "-");

  return (
    <span 
      onClick={handleClick}
      className={disabled ? "text-muted-foreground" : "cursor-pointer hover:bg-muted px-2 py-1 rounded transition-colors"}
    >
      {displayValue}{suffix}
    </span>
  );
}
