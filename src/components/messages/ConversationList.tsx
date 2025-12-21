import { useState } from "react";
import { useConversations, useOnlineStatus, useDeleteConversation, Conversation } from "@/hooks/useChat";
import { ScrollArea } from "@/components/ui/scroll-area";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { da } from "date-fns/locale";
import { Users, MoreVertical, Trash2, LogOut, Loader2 } from "lucide-react";
import { OnlineIndicator } from "./OnlineIndicator";
import { toast } from "sonner";

interface ConversationListProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function ConversationList({ selectedId, onSelect }: ConversationListProps) {
  const { data: conversations, isLoading } = useConversations();
  const onlineUsers = useOnlineStatus();

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Indlæser...
      </div>
    );
  }

  if (!conversations?.length) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-6">
        <Users className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-center">Ingen samtaler endnu</p>
        <p className="text-sm text-center mt-1">Start en ny samtale for at komme i gang</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-2 space-y-1">
        {conversations.map((conversation) => (
          <ConversationItem
            key={conversation.id}
            conversation={conversation}
            isSelected={selectedId === conversation.id}
            onClick={() => onSelect(conversation.id)}
            onDelete={() => {
              if (selectedId === conversation.id) {
                onSelect(null);
              }
            }}
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
  onDelete: () => void;
  onlineUsers: Set<string>;
}

function ConversationItem({ conversation, isSelected, onClick, onDelete, onlineUsers }: ConversationItemProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const deleteConversation = useDeleteConversation();

  const displayName = conversation.is_group
    ? conversation.name || "Gruppe"
    : conversation.members
        ?.filter((m) => m.employee)
        ?.map((m) => m.employee?.full_name)
        .join(", ") || "Samtale";

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

  const handleDelete = async () => {
    try {
      await deleteConversation.mutateAsync(conversation.id);
      onDelete();
      toast.success(conversation.is_group ? "Du har forladt gruppen" : "Samtalen er slettet");
    } catch (error) {
      toast.error("Kunne ikke slette samtalen");
    }
    setShowDeleteDialog(false);
  };

  return (
    <>
      <div
        className={cn(
          "group relative flex items-center gap-3 p-3 md:p-3 rounded-xl cursor-pointer transition-all duration-200 active:scale-[0.98] touch-manipulation",
          isSelected 
            ? "bg-primary text-primary-foreground shadow-md" 
            : "hover:bg-accent/60 active:bg-accent/80"
        )}
        onClick={onClick}
      >
        {/* Online indicator for direct messages */}
        <div className="flex-shrink-0">
          {conversation.is_group ? (
            <div className={cn(
              "h-8 w-8 rounded-full flex items-center justify-center",
              isSelected ? "bg-primary-foreground/20" : "bg-primary/10"
            )}>
              <Users className={cn("h-4 w-4", isSelected ? "text-primary-foreground" : "text-primary")} />
            </div>
          ) : (
            <OnlineIndicator 
              isOnline={isOtherOnline} 
              className="h-3 w-3"
            />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={cn(
              "font-medium truncate",
              unreadCount > 0 && !isSelected && "font-bold"
            )}>
              {displayName}
            </span>
            <div className="flex items-center gap-2 flex-shrink-0">
              {unreadCount > 0 && !isSelected && (
                <Badge 
                  variant="default" 
                  className="h-5 min-w-5 flex items-center justify-center text-xs px-1.5 animate-in zoom-in-50"
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Badge>
              )}
            </div>
          </div>
          
          <div className={cn(
            "flex items-center gap-2 text-sm mt-0.5",
            isSelected ? "text-primary-foreground/70" : "text-muted-foreground"
          )}>
            <span className="truncate">
              {formatDistanceToNow(new Date(conversation.updated_at), {
                addSuffix: true,
                locale: da,
              })}
            </span>
            {conversation.is_group && onlineMemberCount > 0 && (
              <span className={cn(
                "flex items-center gap-1",
                isSelected ? "text-primary-foreground/70" : "text-green-600"
              )}>
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                {onlineMemberCount}
              </span>
            )}
          </div>
        </div>

        {/* Delete/Leave button - shows on hover */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0",
                isSelected ? "hover:bg-primary-foreground/20 text-primary-foreground" : "hover:bg-accent"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem 
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteDialog(true);
              }}
              className="text-destructive focus:text-destructive"
            >
              {conversation.is_group ? (
                <>
                  <LogOut className="h-4 w-4 mr-2" />
                  Forlad gruppe
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Slet samtale
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {conversation.is_group ? "Forlad gruppe?" : "Slet samtale?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {conversation.is_group 
                ? "Du vil ikke længere modtage beskeder fra denne gruppe. Du kan blive tilføjet igen af en administrator."
                : "Denne handling vil slette hele samtalen og kan ikke fortrydes."
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteConversation.isPending}
            >
              {deleteConversation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {conversation.is_group ? "Forlad" : "Slet"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
