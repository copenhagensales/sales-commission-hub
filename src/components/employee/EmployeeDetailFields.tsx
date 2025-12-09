import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, Pencil, Phone, Mail } from "lucide-react";

interface EditableRowProps {
  label: string;
  value: string | number | null | undefined;
  field: string;
  type?: "text" | "date" | "number" | "time" | "email";
  onSave: (field: string, value: string | number | null) => void;
  displayValue?: string | null;
  masked?: boolean;
}

export function EditableRow({ label, value, field, type = "text", onSave, displayValue, masked }: EditableRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value || ""));

  const handleSave = () => {
    let finalValue: string | number | null = editValue || null;
    if (type === "number" && editValue) {
      finalValue = parseFloat(editValue);
    }
    onSave(field, finalValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(String(value || ""));
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") handleCancel();
  };

  if (isEditing) {
    return (
      <tr className="border-b border-border/50 last:border-0">
        <td className="py-2 pr-4 text-sm text-muted-foreground w-1/3">{label}</td>
        <td className="py-1">
          <div className="flex items-center gap-1">
            <Input
              type={type}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-8 text-sm"
              autoFocus
            />
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleSave}>
              <Check className="h-3.5 w-3.5 text-green-600" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleCancel}>
              <X className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  const displayText = masked && value ? "••••••••" : (displayValue ?? value ?? "-");

  return (
    <tr 
      className="border-b border-border/50 last:border-0 cursor-pointer hover:bg-muted/30 transition-colors group"
      onClick={() => setIsEditing(true)}
    >
      <td className="py-2.5 pr-4 text-sm text-muted-foreground w-1/3">{label}</td>
      <td className="py-2.5 text-sm font-medium">
        <div className="flex items-center justify-between">
          <span>{displayText}</span>
          <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </td>
    </tr>
  );
}

interface ContactRowProps {
  label: string;
  value: string | null;
  field: string;
  type: "phone" | "email";
  onSave: (field: string, value: string | null) => void;
}

export function ContactRow({ label, value, field, type, onSave }: ContactRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || "");

  const handleSave = () => {
    onSave(field, editValue || null);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value || "");
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") handleCancel();
  };

  if (isEditing) {
    return (
      <tr className="border-b border-border/50 last:border-0">
        <td className="py-2 pr-4 text-sm text-muted-foreground w-1/3">{label}</td>
        <td className="py-1">
          <div className="flex items-center gap-1">
            <Input
              type={type === "email" ? "email" : "tel"}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-8 text-sm"
              autoFocus
            />
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleSave}>
              <Check className="h-3.5 w-3.5 text-green-600" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleCancel}>
              <X className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  const href = type === "phone" ? `tel:${value}` : `mailto:${value}`;
  const Icon = type === "phone" ? Phone : Mail;

  return (
    <tr className="border-b border-border/50 last:border-0 group">
      <td className="py-2.5 pr-4 text-sm text-muted-foreground w-1/3">{label}</td>
      <td className="py-2.5 text-sm font-medium">
        <div className="flex items-center justify-between">
          {value ? (
            <a 
              href={href} 
              className="text-primary hover:underline flex items-center gap-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              <Icon className="h-3.5 w-3.5" />
              {value}
            </a>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" 
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="h-3 w-3" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

interface SelectRowProps {
  label: string;
  value: string | null;
  field: string;
  options: { value: string; label: string }[];
  onSave: (field: string, value: string | null) => void;
  displayValue?: string | null;
  allowClear?: boolean;
}

export function SelectRow({ label, value, field, options, onSave, displayValue, allowClear = false }: SelectRowProps) {
  const [isEditing, setIsEditing] = useState(false);

  const handleChange = (newValue: string) => {
    if (newValue === "__clear__") {
      onSave(field, null);
    } else {
      onSave(field, newValue);
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <tr className="border-b border-border/50 last:border-0">
        <td className="py-2 pr-4 text-sm text-muted-foreground w-1/3">{label}</td>
        <td className="py-1">
          <div className="flex items-center gap-1">
            <Select value={value || ""} onValueChange={handleChange}>
              <SelectTrigger className="h-8 text-sm flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                {allowClear && (
                  <SelectItem value="__clear__" className="text-muted-foreground italic">Fjern</SelectItem>
                )}
                {options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setIsEditing(false)}>
              <X className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr 
      className="border-b border-border/50 last:border-0 cursor-pointer hover:bg-muted/30 transition-colors group"
      onClick={() => setIsEditing(true)}
    >
      <td className="py-2.5 pr-4 text-sm text-muted-foreground w-1/3">{label}</td>
      <td className="py-2.5 text-sm font-medium">
        <div className="flex items-center justify-between">
          <span>{displayValue ?? "-"}</span>
          <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </td>
    </tr>
  );
}

interface TableSectionProps {
  title: string;
  children: React.ReactNode;
}

export function TableSection({ title, children }: TableSectionProps) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="px-4 py-2.5 border-b border-border bg-muted/30">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <table className="w-full">
        <tbody className="divide-y divide-border/50">
          {children}
        </tbody>
      </table>
    </div>
  );
}
