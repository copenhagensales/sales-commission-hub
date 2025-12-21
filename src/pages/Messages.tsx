import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { ConversationList } from "@/components/messages/ConversationList";
import { ChatView } from "@/components/messages/ChatView";
import { NewConversationDialog } from "@/components/messages/NewConversationDialog";
import { Button } from "@/components/ui/button";
import { Plus, MessageSquare, PenSquare, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Messages() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);

  return (
    <MainLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-6rem)]">
        {/* Header - simplified on mobile */}
        <div className={cn(
          "flex items-center justify-between mb-2 md:mb-4 px-2 md:px-0",
          selectedConversationId && "hidden md:flex"
        )}>
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Beskeder</h1>
            <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
              Kommuniker med dine kollegaer
            </p>
          </div>
          <Button 
            onClick={() => setShowNewDialog(true)} 
            size="sm"
            className="gap-2"
          >
            <PenSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Ny samtale</span>
          </Button>
        </div>

        {/* Main content - full screen on mobile */}
        <div className="flex-1 flex flex-col md:grid md:grid-cols-12 gap-0 md:gap-4 min-h-0">
          {/* Conversation list - full width on mobile when no conversation selected */}
          <div className={cn(
            "md:col-span-4 xl:col-span-3 border-0 md:border rounded-none md:rounded-xl bg-card overflow-hidden flex flex-col h-full",
            selectedConversationId ? "hidden md:flex" : "flex"
          )}>
            <div className="p-3 md:p-4 border-b bg-muted/30">
              <h2 className="font-semibold text-base md:text-lg">Samtaler</h2>
            </div>
            <div className="flex-1 overflow-hidden">
              <ConversationList
                selectedId={selectedConversationId}
                onSelect={setSelectedConversationId}
              />
            </div>
          </div>

          {/* Chat view - full screen on mobile when conversation selected */}
          <div className={cn(
            "md:col-span-8 xl:col-span-9 border-0 md:border rounded-none md:rounded-xl bg-card overflow-hidden flex flex-col h-full",
            !selectedConversationId ? "hidden md:flex" : "flex"
          )}>
            {selectedConversationId ? (
              <>
                {/* Mobile back button - sticky header */}
                <div className="md:hidden p-2 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 sticky top-0 z-10">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setSelectedConversationId(null)}
                    className="gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Tilbage
                  </Button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <ChatView conversationId={selectedConversationId} />
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                  <MessageSquare className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">Vælg en samtale</h3>
                <p className="text-center max-w-sm">
                  Vælg en eksisterende samtale fra listen, eller start en ny for at begynde at chatte
                </p>
                <Button 
                  onClick={() => setShowNewDialog(true)} 
                  variant="outline" 
                  className="mt-6 gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Start ny samtale
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <NewConversationDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        onCreated={(id) => {
          setSelectedConversationId(id);
          setShowNewDialog(false);
        }}
      />
    </MainLayout>
  );
}
