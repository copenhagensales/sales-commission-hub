import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useEmployeesForChat } from "@/hooks/useChat";
import { cn } from "@/lib/utils";

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  className?: string;
  onTyping?: () => void;
}

interface Employee {
  id: string;
  full_name: string;
}

export function MentionInput({ 
  value, 
  onChange, 
  onKeyDown,
  placeholder,
  className,
  onTyping
}: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const { data: employees = [] } = useEmployeesForChat();

  // Memoize filtered employees to avoid recalculation on every render
  const filteredEmployees = useMemo(() => 
    employees.filter((emp: Employee) =>
      emp.full_name.toLowerCase().includes(mentionSearch.toLowerCase())
    ).slice(0, 5),
    [employees, mentionSearch]
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    onChange(newValue);
    onTyping?.();
    
    // Check for @ mentions
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      // Check if there's a space before @
      const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : " ";
      
      if ((charBeforeAt === " " || charBeforeAt === "\n" || lastAtIndex === 0) && !textAfterAt.includes(" ")) {
        setMentionSearch(textAfterAt);
        setMentionStartIndex(lastAtIndex);
        setShowSuggestions(true);
        setSelectedIndex(0);
        return;
      }
    }
    
    setShowSuggestions(false);
    setMentionStartIndex(null);
  };

  const insertMention = useCallback((employee: Employee) => {
    if (mentionStartIndex === null) return;
    
    const beforeMention = value.slice(0, mentionStartIndex);
    const cursorPos = textareaRef.current?.selectionStart || value.length;
    const afterMention = value.slice(cursorPos);
    
    const newValue = `${beforeMention}@${employee.full_name} ${afterMention}`;
    onChange(newValue);
    setShowSuggestions(false);
    setMentionStartIndex(null);
    
    // Focus back to textarea
    setTimeout(() => {
      textareaRef.current?.focus();
      const newCursorPos = mentionStartIndex + employee.full_name.length + 2;
      textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, [mentionStartIndex, value, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions && filteredEmployees.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredEmployees.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredEmployees.length) % filteredEmployees.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filteredEmployees[selectedIndex]);
        return;
      }
      if (e.key === "Escape") {
        setShowSuggestions(false);
        return;
      }
    }
    
    onKeyDown?.(e);
  };

  // Close suggestions on click outside
  useEffect(() => {
    const handleClickOutside = () => setShowSuggestions(false);
    if (showSuggestions) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showSuggestions]);

  return (
    <div className="relative flex-1">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn("min-h-[60px] resize-none", className)}
      />
      
      {showSuggestions && filteredEmployees.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1 w-64 bg-popover border rounded-md shadow-lg z-50 overflow-hidden">
          {filteredEmployees.map((emp: Employee, index: number) => (
            <button
              key={emp.id}
              onClick={(e) => {
                e.stopPropagation();
                insertMention(emp);
              }}
              className={cn(
                "w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors",
                index === selectedIndex && "bg-accent"
              )}
            >
              <span className="font-medium">@{emp.full_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper to render mentions in message content
export function renderMentions(content: string, onMentionClick?: (name: string) => void) {
  const mentionRegex = /@([a-zA-ZæøåÆØÅ\s]+?)(?=\s|$|@)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    // Add text before mention
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    
    // Add mention
    const mentionName = match[1].trim();
    parts.push(
      <span
        key={match.index}
        className="bg-primary/20 text-primary px-1 rounded cursor-pointer hover:bg-primary/30"
        onClick={() => onMentionClick?.(mentionName)}
      >
        @{mentionName}
      </span>
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }
  
  return parts.length > 0 ? parts : content;
}
