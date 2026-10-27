import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useConversations } from "@/hooks/useChat";
import { MainLayout } from "@/components/layout/MainLayout";
import { ConversationList } from "@/components/messages/ConversationList";
import { ChatView } from "@/components/messages/ChatView";
import { NewConversationDialog } from "@/components/messages/NewConversationDialog";
import { EmployeeSmsTab } from "@/components/messages/EmployeeSmsTab";
import { Button } from "@/components/ui/button";
import { Plus, MessageSquare, PenSquare, ArrowLeft, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/usePositionPermissions";
import { useEmployeeSmsUnreadCount } from "@/hooks/useEmployeeSmsConversations";
import { Badge } from "@/components/ui/badge";

export default function Messages() {
  // Valgt samtale ligger i adressen (?samtale=<id>), så push-links og tilbage-pil virker. Øvrige parametre bevares.
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedConversationId = searchParams.get("samtale");
  const { data: samtaler, isSuccess: samtalerHentet, refetch: hentSamtaler } = useConversations();
  const location = useLocation();
  const navigate = useNavigate();
  // Valg fra listen = ny historikpost med state.fraListe, så Tilbage går til listen.
  const setSelectedConversationId = useCallback((id: string | null) => {
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev);
      if (id) n.set("samtale", id); else n.delete("samtale");
      return n;
    }, id ? { state: { fraListe: true } } : undefined);
  }, [setSearchParams]);
  // Tilbage-pilen: intern navigation → navigate(-1); direkte deep link → replace til listen uden samtale.
  const tilbage = useCallback(() => {
    if ((location.state as { fraListe?: boolean } | null)?.fraListe) { navigate(-1); return; }
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev);
      n.delete("samtale");
      return n;
    }, { replace: true });
  }, [location.state, navigate, setSearchParams]);
  // Nyoprettet samtale: afvent ny samtaleliste før valg, så valideringen ikke afviser den.
  const vaelgOprettet = useCallback(async (id: string) => {
    await hentSamtaler();
    setSelectedConversationId(id);
  }, [hentSamtaler, setSelectedConversationId]);
  useEffect(() => {
    if (!selectedConversationId || !samtalerHentet) return;
    if (!(samtaler ?? []).some((c: { id: string }) => c.id === selectedConversationId)) {
      toast.error("Samtalen kunne ikke åbnes");
      setSearchParams((prev) => {
        const n = new URLSearchParams(prev);
        n.delete("samtale");
        return n;
      }, { replace: true });
    }
  }, [selectedConversationId, samtalerHentet, samtaler, setSearchParams]);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const { canSendEmployeeSms } = usePermissions();
  const { data: smsUnreadCount = 0 } = useEmployeeSmsUnreadCount();

  // If user has SMS permission, show tabs; otherwise show just chat
  if (canSendEmployeeSms) {
    return (
      <MainLayout>
        <div className="flex flex-col h-[calc(100dvh-88px-64px-16px-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] md:h-[calc(100vh-6rem)]">
          <Tabs defaultValue="chat" className="flex flex-col h-full">
            {/* Header with tabs */}
            <div className="flex items-center justify-between mb-2 md:mb-4 px-2 md:px-0">
              <div>
                <h1 className="text-xl md:text-2xl font-bold">Beskeder</h1>
                <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
                  Kommuniker med dine kollegaer
                </p>
              </div>
              <div className="flex items-center gap-2">
                <TabsList>
                  <TabsTrigger value="chat" className="gap-2 max-md:min-h-11" aria-label="Chat">
                    <MessageSquare className="h-4 w-4" />
                    <span className="hidden sm:inline">Chat</span>
                  </TabsTrigger>
                  <TabsTrigger value="sms" className="gap-2 max-md:min-h-11" aria-label="SMS">
                    <Phone className="h-4 w-4" />
                    <span className="hidden sm:inline">SMS</span>
                    {smsUnreadCount > 0 && (
                      <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs ml-1">
                        {smsUnreadCount > 99 ? "99+" : smsUnreadCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>

            {/* Chat Tab */}
            <TabsContent value="chat" className="flex-1 min-h-0 mt-0">
              <ChatTabContent 
                selectedConversationId={selectedConversationId}
                setSelectedConversationId={setSelectedConversationId}
                onTilbage={tilbage}
                showNewDialog={showNewDialog}
                setShowNewDialog={setShowNewDialog}
              />
            </TabsContent>

            {/* SMS Tab */}
            <TabsContent value="sms" className="flex-1 min-h-0 mt-0">
              <div className="h-full border rounded-xl bg-card overflow-hidden">
                <EmployeeSmsTab />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <NewConversationDialog
          open={showNewDialog}
          onOpenChange={setShowNewDialog}
          onCreated={(id) => {
            setShowNewDialog(false);
            void vaelgOprettet(id);
          }}
        />
      </MainLayout>
    );
  }

  // Original layout for users without SMS permission
  return (
    <MainLayout>
      <div className="flex flex-col h-[calc(100dvh-88px-64px-16px-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] md:h-[calc(100vh-6rem)]">
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
            className="gap-2 max-md:min-h-11"
            aria-label="Ny samtale"
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
                    onClick={tilbage}
                    className="gap-2 min-h-11"
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
          setShowNewDialog(false);
          void vaelgOprettet(id);
        }}
      />
    </MainLayout>
  );
}

// Extracted chat content for tabs layout
interface ChatTabContentProps {
  selectedConversationId: string | null;
  setSelectedConversationId: (id: string | null) => void;
  onTilbage: () => void;
  showNewDialog: boolean;
  setShowNewDialog: (show: boolean) => void;
}

function ChatTabContent({ 
  selectedConversationId, 
  setSelectedConversationId,
  onTilbage,
  showNewDialog,
  setShowNewDialog 
}: ChatTabContentProps) {
  return (
    <div className="flex-1 flex flex-col md:grid md:grid-cols-12 gap-0 md:gap-4 h-full min-h-0">
      {/* Conversation list */}
      <div className={cn(
        "md:col-span-4 xl:col-span-3 border-0 md:border rounded-none md:rounded-xl bg-card overflow-hidden flex flex-col h-full",
        selectedConversationId ? "hidden md:flex" : "flex"
      )}>
        <div className="p-3 md:p-4 border-b bg-muted/30 flex items-center justify-between">
          <h2 className="font-semibold text-base md:text-lg">Samtaler</h2>
          <Button 
            onClick={() => setShowNewDialog(true)} 
            size="sm"
            variant="ghost"
            className="gap-2 max-md:h-11 max-md:w-11"
            aria-label="Ny samtale"
          >
            <PenSquare className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-hidden">
          <ConversationList
            selectedId={selectedConversationId}
            onSelect={setSelectedConversationId}
          />
        </div>
      </div>

      {/* Chat view */}
      <div className={cn(
        "md:col-span-8 xl:col-span-9 border-0 md:border rounded-none md:rounded-xl bg-card overflow-hidden flex flex-col h-full",
        !selectedConversationId ? "hidden md:flex" : "flex"
      )}>
        {selectedConversationId ? (
          <>
            <div className="md:hidden p-2 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 sticky top-0 z-10">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={onTilbage}
                className="gap-2 min-h-11"
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
  );
}
