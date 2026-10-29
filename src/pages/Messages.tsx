import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useConversations } from "@/hooks/useChat";
import { MainLayout } from "@/components/layout/MainLayout";
import { ConversationList } from "@/components/messages/ConversationList";
import { samtaleNavn } from "@/components/messages/samtaleTekst";
import { useCurrentEmployeeId } from "@/hooks/useCurrentEmployeeId";
import { Pille } from "@/components/cph";
import { ChatView } from "@/components/messages/ChatView";
import { NewConversationDialog } from "@/components/messages/NewConversationDialog";
import { BeskederInfoKnap } from "@/components/messages/BeskederInfo";
import { EmployeeSmsTab } from "@/components/messages/EmployeeSmsTab";
import { Button } from "@/components/ui/button";
import { Plus, MessageSquare, PenSquare, Phone } from "lucide-react";
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
  // Kun valg fra listevisningen uden allerede valgt samtale = ny historikpost med state.fraListe.
  // Skift mellem samtaler (A → B, også på bred skærm) erstatter posten og bevarer dens state, så Tilbage altid går til listen.
  const setSelectedConversationId = useCallback((id: string | null) => {
    const fraListevisning = !!id && !selectedConversationId;
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev);
      if (id) n.set("samtale", id); else n.delete("samtale");
      return n;
    }, fraListevisning ? { state: { fraListe: true } } : { replace: true, state: location.state });
  }, [setSearchParams, selectedConversationId, location.state]);
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
  // D2a: samtalens navn til tilbage-bjælken og trådens sidehoved (Messages kender samtalerne, ChatView kun id).
  const valgtSamtale = selectedConversationId ? samtaler?.find((x) => x.id === selectedConversationId) : undefined;
  const migId = useCurrentEmployeeId().data ?? null;
  const valgtNavn = valgtSamtale ? samtaleNavn(valgtSamtale, migId) : undefined;
  const { canSendEmployeeSms } = usePermissions();
  const { data: smsUnreadCount = 0 } = useEmployeeSmsUnreadCount();

  // If user has SMS permission, show tabs; otherwise show just chat
  if (canSendEmployeeSms) {
    return (
      <MainLayout>
        <div className="flex flex-col h-[calc(100dvh-88px-64px-16px-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] md:h-[calc(100vh-6rem)]">
          <Tabs defaultValue="chat" className="flex flex-col h-full">
            {/* Header with tabs */}
            <div className="mb-3 flex items-center justify-between gap-3 px-1 md:mb-4 md:px-0">
              <div className="min-w-0">
                <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-foreground md:text-[32px]">Beskeder</h1>
                <p className="hidden text-[14px] text-muted-foreground sm:block">Kommuniker med dine kollegaer</p>
              </div>
              <div className="flex items-center gap-2">
                <BeskederInfoKnap />
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
                titel={valgtNavn}
                nyKnapIListe
              />
            </TabsContent>

            {/* SMS Tab */}
            <TabsContent value="sms" className="flex-1 min-h-0 mt-0">
              <div className="h-full overflow-hidden rounded-3xl bg-card">
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
          "mb-3 flex items-center justify-between gap-3 px-1 md:mb-4 md:px-0",
          selectedConversationId && "hidden md:flex"
        )}>
          <div className="min-w-0">
            <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-foreground md:text-[32px]">Beskeder</h1>
            <p className="hidden text-[14px] text-muted-foreground sm:block">Kommuniker med dine kollegaer</p>
          </div>
          <div className="flex items-center gap-1">
            <BeskederInfoKnap />
            <Pille onClick={() => setShowNewDialog(true)} aria-label="Ny samtale" ikon={<PenSquare />} className="max-sm:h-11 max-sm:w-11 max-sm:px-0">
              <span className="hidden sm:inline">Ny samtale</span>
            </Pille>
          </div>
        </div>

        <ChatTabContent
          selectedConversationId={selectedConversationId}
          setSelectedConversationId={setSelectedConversationId}
          onTilbage={tilbage}
          showNewDialog={showNewDialog}
          setShowNewDialog={setShowNewDialog}
          titel={valgtNavn}
        />
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
  /** Samtalens navn (tilbage-bjælke på telefon, sidehoved på pc). */
  titel?: string;
  /** Vis »Ny samtale« i listens hoved (fane-varianten; standardvarianten har den i sidehovedet). */
  nyKnapIListe?: boolean;
}

/** D2a: listepanel og trådpanel som Storkbook-kort (24 px) på pc; fuld bredde uden rammer på telefon. Samme opbygning i begge varianter. */
function ChatTabContent({ 
  selectedConversationId, 
  setSelectedConversationId,
  onTilbage,
  showNewDialog,
  setShowNewDialog,
  titel,
  nyKnapIListe = false,
}: ChatTabContentProps) {
  return (
    <div className="flex-1 flex flex-col md:grid md:grid-cols-12 gap-0 md:gap-4 h-full min-h-0">
      {/* Conversation list */}
      <div className={cn(
        "flex h-full flex-col overflow-hidden md:col-span-4 md:rounded-3xl md:bg-card xl:col-span-3",
        selectedConversationId ? "hidden md:flex" : "flex"
      )}>
        <div className={cn("flex items-center justify-between px-1 pb-2 md:px-4 md:pt-4", !nyKnapIListe && "max-md:hidden")}>
          <h2 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Samtaler</h2>
          {nyKnapIListe && (
            <Pille variant="sekundaer" stoerrelse="ikon" onClick={() => setShowNewDialog(true)} aria-label="Ny samtale" ikon={<PenSquare />} />
          )}
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
        "flex h-full flex-col overflow-hidden rounded-3xl bg-card md:col-span-8 xl:col-span-9",
        !selectedConversationId ? "hidden md:flex" : "flex"
      )}>
        {selectedConversationId ? (
          <>
            <div className="flex-1 overflow-hidden">
              <ChatView conversationId={selectedConversationId} titel={titel} onTilbage={onTilbage} />
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-8 text-muted-foreground">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(var(--cph-emerald)/0.14)] text-[hsl(var(--cph-emerald))]">
              <MessageSquare className="h-10 w-10" aria-hidden="true" />
            </div>
            <h3 className="mb-2 text-[18px] font-extrabold text-foreground">Vælg en samtale</h3>
            <p className="max-w-sm text-center text-[15px]">
              Vælg en eksisterende samtale fra listen, eller start en ny for at begynde at chatte
            </p>
            <Pille variant="sekundaer" onClick={() => setShowNewDialog(true)} ikon={<Plus />} className="mt-6">Start ny samtale</Pille>
          </div>
        )}
      </div>
    </div>
  );
}
