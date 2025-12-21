import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { ConversationList } from "@/components/messages/ConversationList";
import { ChatView } from "@/components/messages/ChatView";
import { NewConversationDialog } from "@/components/messages/NewConversationDialog";
import { Button } from "@/components/ui/button";
import { Plus, MessageSquare } from "lucide-react";

export default function Messages() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);

  return (
    <MainLayout>
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Beskeder</h1>
          <Button onClick={() => setShowNewDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Ny samtale
          </Button>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 min-h-0">
          <div className="md:col-span-1 border rounded-lg bg-card overflow-hidden">
            <ConversationList
              selectedId={selectedConversationId}
              onSelect={setSelectedConversationId}
            />
          </div>

          <div className="md:col-span-2 border rounded-lg bg-card overflow-hidden">
            {selectedConversationId ? (
              <ChatView conversationId={selectedConversationId} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mb-4" />
                <p>Vælg en samtale for at starte</p>
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
