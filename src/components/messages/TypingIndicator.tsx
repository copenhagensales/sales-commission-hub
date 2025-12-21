interface TypingIndicatorProps {
  users: { id: string; name: string }[];
}

export function TypingIndicator({ users }: TypingIndicatorProps) {
  if (users.length === 0) return null;

  const names = users.map(u => u.name);
  let text = "";
  
  if (names.length === 1) {
    text = `${names[0]} skriver...`;
  } else if (names.length === 2) {
    text = `${names[0]} og ${names[1]} skriver...`;
  } else {
    text = `${names.length} personer skriver...`;
  }

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
      <span>{text}</span>
    </div>
  );
}
