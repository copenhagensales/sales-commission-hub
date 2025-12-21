import { useConversations, Conversation } from "@/hooks/useChat";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { da } from "date-fns/locale";
import { Users, User } from "lucide-react";

interface ConversationListProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ConversationList({ selectedId, onSelect }: ConversationListProps) {
  const { data: conversations, isLoading } = useConversations();

  if (isLoading) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Indlæser samtaler...
      </div>
    );
  }

  if (!conversations?.length) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Ingen samtaler endnu
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="divide-y">
        {conversations.map((conversation) => (
          <ConversationItem
            key={conversation.id}
            conversation={conversation}
            isSelected={selectedId === conversation.id}
            onClick={() => onSelect(conversation.id)}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
}

function ConversationItem({ conversation, isSelected, onClick }: ConversationItemProps) {
  const displayName = conversation.is_group
    ? conversation.name || "Gruppe"
    : conversation.members
        ?.filter((m) => m.employee)
        ?.map((m) => m.employee?.full_name)
        .join(", ") || "Samtale";

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full p-4 flex items-center gap-3 text-left hover:bg-accent/50 transition-colors",
        isSelected && "bg-accent"
      )}
    >
      <Avatar>
        <AvatarFallback className="bg-primary/10">
          {conversation.is_group ? (
            <Users className="h-4 w-4" />
          ) : (
            initials || <User className="h-4 w-4" />
          )}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{displayName}</div>
        <div className="text-sm text-muted-foreground">
          {formatDistanceToNow(new Date(conversation.updated_at), {
            addSuffix: true,
            locale: da,
          })}
        </div>
      </div>
    </button>
  );
}
