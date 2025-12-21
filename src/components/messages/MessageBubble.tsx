import { useState, useEffect } from "react";
import { Message, useEditMessage, useDeleteMessage, useToggleReaction, useMarkMessageAsRead } from "@/hooks/useChat";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MoreVertical, Reply, Pencil, Trash2, SmilePlus, Check, X, FileIcon } from "lucide-react";
import { ReadReceipts } from "./ReadReceipts";
import { MessageWithLinks } from "./LinkPreview";
import { renderMentions } from "./MentionInput";

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  currentEmployeeId?: string;
  conversationId: string;
  onReply: (message: Message) => void;
}

const EMOJI_OPTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "👏", "🎉"];

export function MessageBubble({ message, isOwn, currentEmployeeId, conversationId, onReply }: MessageBubbleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  
  const editMessage = useEditMessage();
  const deleteMessage = useDeleteMessage();
  const toggleReaction = useToggleReaction();
  const markAsRead = useMarkMessageAsRead();

  // Mark message as read when viewed (only for messages from others)
  useEffect(() => {
    if (!isOwn && currentEmployeeId) {
      const hasRead = message.read_receipts?.some(r => r.employee_id === currentEmployeeId);
      if (!hasRead) {
        markAsRead.mutate({ messageId: message.id, conversationId });
      }
    }
  }, [message.id, isOwn, currentEmployeeId]);

  const handleSaveEdit = async () => {
    if (!editContent.trim()) return;
    await editMessage.mutateAsync({ 
      messageId: message.id, 
      content: editContent,
      conversationId 
    });
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (confirm("Er du sikker på at du vil slette denne besked?")) {
      await deleteMessage.mutateAsync({ messageId: message.id, conversationId });
    }
  };

  const handleReaction = async (emoji: string) => {
    await toggleReaction.mutateAsync({ messageId: message.id, emoji, conversationId });
  };

  // Group reactions by emoji
  const groupedReactions = (message.reactions || []).reduce((acc, r) => {
    if (!acc[r.emoji]) {
      acc[r.emoji] = { count: 0, users: [], hasOwn: false };
    }
    acc[r.emoji].count++;
    acc[r.emoji].users.push(r.employee?.full_name || "Ukendt");
    if (r.employee_id === currentEmployeeId) {
      acc[r.emoji].hasOwn = true;
    }
    return acc;
  }, {} as Record<string, { count: number; users: string[]; hasOwn: boolean }>);

  // Filter read receipts to exclude the sender
  const otherReadReceipts = (message.read_receipts || []).filter(r => r.employee_id !== message.sender_id);

  const isImage = message.attachment_type?.startsWith("image/");

  // Check if message contains URLs
  const hasUrls = /https?:\/\/[^\s]+/.test(message.content);

  return (
    <div className={cn("flex group", isOwn ? "justify-end" : "justify-start")}>
      <div className="flex flex-col max-w-[85%] md:max-w-[70%]">
        {/* Reply reference */}
        {message.reply_to && (
          <div className={cn(
            "text-xs px-2 md:px-3 py-1 rounded-t-lg border-l-2 mb-1",
            isOwn ? "bg-primary/10 border-primary ml-auto" : "bg-muted border-muted-foreground"
          )}>
            <span className="font-medium">{message.reply_to.sender?.full_name}</span>
            <p className="truncate text-muted-foreground">{message.reply_to.content}</p>
          </div>
        )}

        <div
          className={cn(
            "rounded-lg px-3 md:px-4 py-2 relative",
            isOwn
              ? "bg-primary text-primary-foreground"
              : "bg-muted"
          )}
        >
          {/* Sender name for group chats */}
          {!isOwn && message.sender && (
            <div className="text-xs font-medium mb-1 opacity-70">
              {message.sender.full_name}
            </div>
          )}

          {/* Message content or edit mode */}
          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[60px] bg-background text-foreground"
              />
              <div className="flex gap-1">
                <Button size="sm" onClick={handleSaveEdit} disabled={editMessage.isPending}>
                  <Check className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Attachment */}
              {message.attachment_url && (
                <div className="mb-2">
                  {isImage ? (
                    <a href={message.attachment_url} target="_blank" rel="noopener noreferrer">
                      <img 
                        src={message.attachment_url} 
                        alt={message.attachment_name || "Billede"} 
                        className="max-w-full rounded max-h-60 object-cover"
                      />
                    </a>
                  ) : (
                    <a 
                      href={message.attachment_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className={cn(
                        "flex items-center gap-2 p-2 rounded",
                        isOwn ? "bg-primary-foreground/10" : "bg-background"
                      )}
                    >
                      <FileIcon className="h-4 w-4" />
                      <span className="text-sm underline">{message.attachment_name || "Fil"}</span>
                    </a>
                  )}
                </div>
              )}

              {/* Message content with links and mentions */}
              {hasUrls ? (
                <MessageWithLinks content={message.content} />
              ) : (
                <div className="whitespace-pre-wrap break-words">
                  {renderMentions(message.content)}
                </div>
              )}
              
              <div className={cn(
                "text-xs mt-1 flex items-center gap-1",
                isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
              )}>
                {format(new Date(message.created_at), "HH:mm", { locale: da })}
                {message.edited_at && <span>(redigeret)</span>}
              </div>

              {/* Read receipts for own messages */}
              {isOwn && otherReadReceipts.length > 0 && (
                <ReadReceipts receipts={otherReadReceipts} isOwn={isOwn} />
              )}
            </>
          )}

          {/* Actions menu - always visible on mobile via long-press or inline buttons */}
          {!isEditing && (
            <div className={cn(
              "absolute top-1 transition-opacity",
              // Always visible on mobile, hover on desktop
              "opacity-100 md:opacity-0 md:group-hover:opacity-100",
              isOwn ? "left-0 -translate-x-full pr-1" : "right-0 translate-x-full pl-1"
            )}>
              <div className="flex items-center gap-0.5 md:gap-1 bg-background/80 backdrop-blur-sm rounded-lg p-0.5 shadow-sm border">
                {/* Quick reaction */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 md:h-6 md:w-6">
                      <SmilePlus className="h-3.5 w-3.5 md:h-3 md:w-3" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2" side={isOwn ? "left" : "right"}>
                    <div className="flex gap-1 flex-wrap max-w-[200px]">
                      {EMOJI_OPTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => handleReaction(emoji)}
                          className="text-xl md:text-lg hover:scale-125 active:scale-110 transition-transform p-1.5 md:p-1"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Reply */}
                <Button variant="ghost" size="icon" className="h-7 w-7 md:h-6 md:w-6" onClick={() => onReply(message)}>
                  <Reply className="h-3.5 w-3.5 md:h-3 md:w-3" />
                </Button>

                {/* More options (edit/delete for own messages) */}
                {isOwn && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 md:h-6 md:w-6">
                        <MoreVertical className="h-3.5 w-3.5 md:h-3 md:w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align={isOwn ? "start" : "end"}>
                      <DropdownMenuItem onClick={() => setIsEditing(true)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Rediger
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Slet
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Reactions display */}
        {Object.keys(groupedReactions).length > 0 && (
          <div className={cn("flex flex-wrap gap-1 mt-1", isOwn ? "justify-end" : "justify-start")}>
            {Object.entries(groupedReactions).map(([emoji, data]) => (
              <button
                key={emoji}
                onClick={() => handleReaction(emoji)}
                className={cn(
                  "text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1 border",
                  data.hasOwn ? "bg-primary/20 border-primary" : "bg-muted border-transparent"
                )}
                title={data.users.join(", ")}
              >
                <span>{emoji}</span>
                <span>{data.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
