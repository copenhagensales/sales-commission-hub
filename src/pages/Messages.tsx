import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { ConversationList } from "@/components/messages/ConversationList";
import { ChatView } from "@/components/messages/ChatView";
import { NewConversationDialog } from "@/components/messages/NewConversationDialog";
import { Button } from "@/components/ui/button";
import { Plus, MessageSquare, PenSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Messages() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);

  return (
    <MainLayout>
      <div className="flex flex-col h-[calc(100vh-6rem)]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Beskeder</h1>
            <p className="text-sm text-muted-foreground">Kommuniker med dine kollegaer</p>
          </div>
          <Button onClick={() => setShowNewDialog(true)} className="gap-2">
            <PenSquare className="h-4 w-4" />
            Ny samtale
          </Button>
        </div>

        {/* Main content */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
          {/* Conversation list - sidebar style */}
          <div className={cn(
            "lg:col-span-4 xl:col-span-3 border rounded-xl bg-card overflow-hidden flex flex-col",
            selectedConversationId ? "hidden lg:flex" : "flex"
          )}>
            <div className="p-4 border-b bg-muted/30">
              <h2 className="font-semibold text-lg">Samtaler</h2>
            </div>
            <div className="flex-1 overflow-hidden">
              <ConversationList
                selectedId={selectedConversationId}
                onSelect={setSelectedConversationId}
              />
            </div>
          </div>

          {/* Chat view - main area */}
          <div className={cn(
            "lg:col-span-8 xl:col-span-9 border rounded-xl bg-card overflow-hidden flex flex-col",
            !selectedConversationId ? "hidden lg:flex" : "flex"
          )}>
            {selectedConversationId ? (
              <>
                {/* Mobile back button */}
                <div className="lg:hidden p-2 border-b">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setSelectedConversationId(null)}
                  >
                    ← Tilbage
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
