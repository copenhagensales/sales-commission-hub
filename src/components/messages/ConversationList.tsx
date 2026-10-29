import { useEffect, useRef, useState } from "react";
import { SkeletonList } from "@/components/mobile";
import { useConversations, useOnlineStatus, useDeleteConversation, kanSletteSamtale, ForaeldetSession, Conversation } from "@/hooks/useChat";
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
import { samtaleNavn, initialer, kortTid } from "./samtaleTekst";
import { useCurrentEmployeeId } from "@/hooks/useCurrentEmployeeId";
import { Users, MoreVertical, Trash2, LogOut, Loader2 } from "lucide-react";
import { OnlineIndicator } from "./OnlineIndicator";
import { toast } from "sonner";

interface ConversationListProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

/** Listens rulleposition overlever, mens en samtale er åben (telefon skjuler listen). */
let savedScrollTop = 0;

export function ConversationList({ selectedId, onSelect }: ConversationListProps) {
  const { data: conversations, isLoading } = useConversations();
  const onlineUsers = useOnlineStatus();
  const migId = useCurrentEmployeeId().data ?? null;
  const rootRef = useRef<HTMLDivElement>(null);
  const viewport = () => rootRef.current?.querySelector<HTMLElement>("[data-radix-scroll-area-viewport]") ?? null;

  useEffect(() => {
    if (selectedId === null) {
      const v = viewport();
      if (v) v.scrollTop = savedScrollTop;
    }
  }, [selectedId, isLoading]);

  const select = (id: string) => {
    savedScrollTop = viewport()?.scrollTop ?? 0;
    onSelect(id);
  };

  if (isLoading) {
    return (
      <div className="p-2">
        <SkeletonList count={5} />
      </div>
    );
  }

  if (!conversations?.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-muted-foreground">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--cph-emerald)/0.14)] text-[hsl(var(--cph-emerald))]"><Users className="h-8 w-8" aria-hidden="true" /></div>
        <p className="text-center text-[15px] font-extrabold text-foreground">Ingen samtaler endnu</p>
        <p className="mt-1 text-center text-[14px]">Start en ny samtale for at komme i gang</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full w-full [&_[data-radix-scroll-area-viewport]>div]:!block" ref={rootRef}>
      <div className="space-y-1 p-2 max-md:space-y-2 max-md:p-0">
        {conversations.map((conversation) => (
          <ConversationItem
            key={conversation.id}
            conversation={conversation}
            isSelected={selectedId === conversation.id}
            onClick={() => select(conversation.id)}
            onDelete={() => {
              if (selectedId === conversation.id) {
                onSelect(null);
              }
            }}
            onlineUsers={onlineUsers}
            migId={migId}
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
  migId?: string | null;
}

function ConversationItem({ conversation, isSelected, onClick, onDelete, onlineUsers, migId }: ConversationItemProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const deleteConversation = useDeleteConversation();

  const displayName = samtaleNavn(conversation, migId);

  // For direct messages, check if the other person is online
  const otherMember = !conversation.is_group
    ? conversation.members?.find((m) => m.employee && m.employee_id !== migId) ?? conversation.members?.find((m) => m.employee)
    : null;
  const isOtherOnline = otherMember ? onlineUsers.has(otherMember.employee_id) : false;

  // Count online members for group chats
  const onlineMemberCount = conversation.is_group
    ? conversation.members?.filter(m => onlineUsers.has(m.employee_id)).length || 0
    : 0;

  const unreadCount = conversation.unread_count || 0;

  const handleDelete = async () => {
    if (!kanSletteSamtale(conversation)) { setShowDeleteDialog(false); return; }
    try {
      // B2-6B §B: sessionen fastholdes ved klik; en sen afslutning efter logud/brugerskift viser intet og navigerer ikke.
      await deleteConversation.slet(conversation.id);
      onDelete();
      toast.success(conversation.is_group ? "Du har forladt gruppen" : "Samtalen er slettet");
    } catch (error) {
      if (error instanceof ForaeldetSession) return;
      toast.error(conversation.is_group ? "Kunne ikke forlade gruppen" : "Kunne ikke slette samtalen");
    }
    setShowDeleteDialog(false);
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
        aria-label={`${displayName}${unreadCount > 0 ? `, ${unreadCount} ulæste` : ""}`}
        className={cn(
          // D2a: række som i Storkbook – hvid flise på telefon, lys blå flade når valgt (pc), 64 px, ingen skalering ved tryk
          "group relative flex w-full min-w-0 max-w-full overflow-hidden min-h-[64px] items-center gap-3 rounded-2xl px-3 py-2.5 cursor-pointer transition-colors select-none touch-manipulation [-webkit-touch-callout:none] max-md:bg-card",
          isSelected
            ? "bg-[hsl(var(--cph-light-blue))] text-foreground"
            : "hover:bg-[hsl(var(--cph-light-blue)/0.6)] active:bg-[hsl(var(--cph-light-blue))]"
        )}
        onClick={onClick}
      >
        {/* Avatar: initialer (1:1) eller gruppeikon; online-prik i hjørnet */}
        <div className="relative flex-shrink-0">
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-full text-[14px] font-extrabold",
            conversation.is_group ? "bg-[hsl(var(--cph-emerald)/0.14)] text-[hsl(var(--cph-emerald))]" : isSelected ? "bg-card text-foreground" : "bg-[hsl(var(--cph-light-blue))] text-foreground")}>
            {conversation.is_group ? <Users className="h-5 w-5" aria-hidden="true" /> : initialer(displayName)}
          </div>
          {!conversation.is_group && (
            <OnlineIndicator isOnline={isOtherOnline} className="absolute -bottom-0.5 -right-0.5 h-3 w-3 ring-2 ring-card" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={cn("truncate text-[15px] leading-tight text-foreground", unreadCount > 0 && !isSelected ? "font-extrabold" : "font-semibold")}>
              {displayName}
            </span>
            <span className={cn("shrink-0 text-[12px] tabular-nums", unreadCount > 0 && !isSelected ? "font-extrabold text-foreground" : "text-muted-foreground")}>
              {kortTid(conversation.updated_at)}
            </span>
          </div>

          <div className="mt-0.5 flex items-center gap-2 text-[13px] text-muted-foreground">
            <span className="truncate">
              {conversation.is_group ? `${conversation.members?.length ?? 0} deltagere` : isOtherOnline ? "Online" : "Direkte samtale"}
            </span>
            {conversation.is_group && onlineMemberCount > 0 && (
              <span className="flex shrink-0 items-center gap-1 text-[hsl(var(--cph-emerald))]">
                <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--cph-emerald))]" />
                {onlineMemberCount} online
              </span>
            )}
            {unreadCount > 0 && !isSelected && (
              <Badge variant="default" className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full border-0 bg-[hsl(var(--cph-emerald))] px-1.5 text-[12px] font-extrabold text-[hsl(var(--cph-onyx))] animate-in zoom-in-50">
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            )}
          </div>
        </div>

        {/* Delete/Leave button - shows on hover */}
        {kanSletteSamtale(conversation) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 flex-shrink-0 rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-card group-hover:opacity-100 focus-visible:opacity-100 max-md:opacity-100"
              onClick={(e) => e.stopPropagation()}
              aria-label="Flere handlinger"
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
        )}
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
