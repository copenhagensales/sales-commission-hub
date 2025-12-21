import { useConversations, useOnlineStatus, Conversation } from "@/hooks/useChat";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { da } from "date-fns/locale";
import { Users, User } from "lucide-react";
import { OnlineIndicator } from "./OnlineIndicator";

interface ConversationListProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ConversationList({ selectedId, onSelect }: ConversationListProps) {
  const { data: conversations, isLoading } = useConversations();
  const onlineUsers = useOnlineStatus();

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
            onlineUsers={onlineUsers}
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
  onlineUsers: Set<string>;
}

function ConversationItem({ conversation, isSelected, onClick, onlineUsers }: ConversationItemProps) {
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

  // For direct messages, check if the other person is online
  const otherMember = !conversation.is_group 
    ? conversation.members?.find(m => m.employee)
    : null;
  const isOtherOnline = otherMember ? onlineUsers.has(otherMember.employee_id) : false;

  // Count online members for group chats
  const onlineMemberCount = conversation.is_group
    ? conversation.members?.filter(m => onlineUsers.has(m.employee_id)).length || 0
    : 0;

  const unreadCount = conversation.unread_count || 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full p-4 flex items-center gap-3 text-left hover:bg-accent/50 transition-colors",
        isSelected && "bg-accent"
      )}
    >
      <div className="relative">
        <Avatar>
          <AvatarFallback className="bg-primary/10">
            {conversation.is_group ? (
              <Users className="h-4 w-4" />
            ) : (
              initials || <User className="h-4 w-4" />
            )}
          </AvatarFallback>
        </Avatar>
        {!conversation.is_group && (
          <OnlineIndicator 
            isOnline={isOtherOnline} 
            className="absolute -bottom-0.5 -right-0.5"
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={cn(
            "font-medium truncate",
            unreadCount > 0 && "font-bold"
          )}>
            {displayName}
          </span>
          {unreadCount > 0 && (
            <Badge variant="default" className="shrink-0 h-5 min-w-5 flex items-center justify-center">
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {formatDistanceToNow(new Date(conversation.updated_at), {
              addSuffix: true,
              locale: da,
            })}
          </span>
          {conversation.is_group && onlineMemberCount > 0 && (
            <span className="text-green-600">
              • {onlineMemberCount} online
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
