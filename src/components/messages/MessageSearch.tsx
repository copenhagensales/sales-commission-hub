import { useState } from "react";
import { useSearchMessages } from "@/hooks/useChat";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, X, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";

interface MessageSearchProps {
  onClose: () => void;
  onSelectMessage: (message: any) => void;
}

export function MessageSearch({ onClose, onSelectMessage }: MessageSearchProps) {
  const [query, setQuery] = useState("");
  const searchMessages = useSearchMessages();

  const handleSearch = () => {
    if (query.trim()) {
      searchMessages.mutate(query);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="border-b p-4 bg-muted/30">
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Søg i beskeder..."
            className="pl-9"
          />
        </div>
        <Button onClick={handleSearch} disabled={searchMessages.isPending}>
          {searchMessages.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Søg"
          )}
        </Button>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {searchMessages.data && searchMessages.data.length > 0 && (
        <ScrollArea className="max-h-60">
          <div className="space-y-2">
            {searchMessages.data.map((msg: any) => (
              <button
                key={msg.id}
                onClick={() => onSelectMessage(msg)}
                className="w-full text-left p-2 rounded hover:bg-muted transition-colors"
              >
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span className="font-medium">{msg.sender?.full_name}</span>
                  <span>{format(new Date(msg.created_at), "d. MMM yyyy HH:mm", { locale: da })}</span>
                </div>
                <p className="text-sm truncate">{msg.content}</p>
                {msg.conversation && (
                  <p className="text-xs text-muted-foreground mt-1">
                    i: {msg.conversation.name || "Direkte besked"}
                  </p>
                )}
              </button>
            ))}
          </div>
        </ScrollArea>
      )}

      {searchMessages.data && searchMessages.data.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Ingen resultater fundet
        </p>
      )}
    </div>
  );
}
